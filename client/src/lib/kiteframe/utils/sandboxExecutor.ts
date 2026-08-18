import type { CodeExecutionResult, CodeLanguage } from '../types';

const EXECUTION_TIMEOUT = 15000;
const SANDBOX_ORIGIN = 'null';

interface SandboxMessage {
  type: 'execute' | 'result';
  id: string;
  code?: string;
  inputs?: Record<string, unknown>;
  result?: CodeExecutionResult;
}

let sandboxFrame: HTMLIFrameElement | null = null;
let messageHandlers: Map<string, (result: CodeExecutionResult) => void> = new Map();

function getSandboxFrame(): HTMLIFrameElement {
  if (sandboxFrame && document.body.contains(sandboxFrame)) {
    return sandboxFrame;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden;';
  
  const sandboxHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <script>
        (function() {
          'use strict';
          
          const originalConsole = window.console;
          
          window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'execute') {
              const { id, code, inputs } = event.data;
              executeCode(id, code, inputs || {});
            }
          });
          
          function executeCode(id, code, inputs) {
            const logs = [];
            const startTime = Date.now();
            
            const mockConsole = {
              log: function() {
                logs.push(formatArgs(arguments));
              },
              error: function() {
                logs.push('[ERROR] ' + formatArgs(arguments));
              },
              warn: function() {
                logs.push('[WARN] ' + formatArgs(arguments));
              },
              info: function() {
                logs.push('[INFO] ' + formatArgs(arguments));
              },
              debug: function() {
                logs.push('[DEBUG] ' + formatArgs(arguments));
              },
              table: function(data) {
                try {
                  logs.push(JSON.stringify(data, null, 2));
                } catch (e) {
                  logs.push('[table] ' + String(data));
                }
              },
              clear: function() {
                logs.length = 0;
              },
              dir: function(obj) {
                try {
                  logs.push(JSON.stringify(obj, null, 2));
                } catch (e) {
                  logs.push(String(obj));
                }
              },
              time: function() {},
              timeEnd: function() {},
              timeLog: function() {},
              count: function() {},
              countReset: function() {},
              group: function() {},
              groupEnd: function() {},
              groupCollapsed: function() {},
              assert: function(condition, msg) {
                if (!condition) {
                  logs.push('[ASSERT FAILED] ' + (msg || 'Assertion failed'));
                }
              }
            };
            
            function formatArgs(args) {
              const parts = [];
              for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                if (arg === null) {
                  parts.push('null');
                } else if (arg === undefined) {
                  parts.push('undefined');
                } else if (typeof arg === 'object') {
                  try {
                    parts.push(JSON.stringify(arg, null, 2));
                  } catch (e) {
                    parts.push('[Circular or unserializable object]');
                  }
                } else {
                  parts.push(String(arg));
                }
              }
              return parts.join(' ');
            }
            
            try {
              const wrappedCode = '"use strict";\\n' + code;
              const fn = new Function('console', 'inputs', wrappedCode);
              const returnValue = fn(mockConsole, inputs);
              
              let serializedReturn = undefined;
              if (returnValue !== undefined) {
                try {
                  serializedReturn = JSON.parse(JSON.stringify(returnValue));
                } catch (e) {
                  serializedReturn = String(returnValue);
                }
              }
              
              sendResult(id, {
                success: true,
                output: logs.length > 0 ? logs.join('\\n') : undefined,
                returnValue: serializedReturn,
                executedAt: new Date().toISOString()
              });
            } catch (error) {
              sendResult(id, {
                success: false,
                output: logs.length > 0 ? logs.join('\\n') : undefined,
                error: error.name + ': ' + error.message,
                executedAt: new Date().toISOString()
              });
            }
          }
          
          function sendResult(id, result) {
            parent.postMessage({
              type: 'result',
              id: id,
              result: result
            }, '*');
          }
        })();
      <\/script>
    </head>
    <body></body>
    </html>
  `;

  iframe.srcdoc = sandboxHTML;
  document.body.appendChild(iframe);
  sandboxFrame = iframe;
  
  return iframe;
}

function initMessageListener() {
  if (typeof window === 'undefined') return;
  
  const handleMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'result') {
      const { id, result } = event.data as SandboxMessage;
      const handler = messageHandlers.get(id);
      if (handler) {
        messageHandlers.delete(id);
        handler(result!);
      }
    }
  };
  
  window.addEventListener('message', handleMessage);
}

if (typeof window !== 'undefined') {
  initMessageListener();
}

function isFullHtmlDocument(code: string): boolean {
  const trimmed = code.trim().toLowerCase();
  return trimmed.startsWith('<!doctype') || 
         trimmed.startsWith('<html') ||
         (trimmed.startsWith('<head') && trimmed.includes('<body'));
}

export function executeInSandbox(
  code: string,
  language: CodeLanguage,
  inputs: Record<string, unknown>,
  timeout: number = EXECUTION_TIMEOUT
): Promise<CodeExecutionResult> {
  return new Promise((resolve) => {
    if (language === 'python') {
      resolve({
        success: false,
        error: 'Python execution requires Pyodide integration (not yet implemented). Use JavaScript for now.',
        executedAt: new Date().toISOString(),
      });
      return;
    }

    if (!code.trim()) {
      resolve({
        success: true,
        output: undefined,
        executedAt: new Date().toISOString(),
      });
      return;
    }

    if (isFullHtmlDocument(code)) {
      resolve({
        success: true,
        output: code,
        htmlOutput: code,
        executedAt: new Date().toISOString(),
      });
      return;
    }

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const timeoutId = setTimeout(() => {
      messageHandlers.delete(executionId);
      resolve({
        success: false,
        error: `Execution timed out after ${timeout / 1000} seconds`,
        executedAt: new Date().toISOString(),
      });
    }, timeout);

    messageHandlers.set(executionId, (result) => {
      clearTimeout(timeoutId);
      resolve(result);
    });

    try {
      const frame = getSandboxFrame();
      
      const sendMessage = () => {
        if (frame.contentWindow) {
          let serializedInputs: Record<string, unknown> = {};
          try {
            serializedInputs = JSON.parse(JSON.stringify(inputs));
          } catch (e) {
            console.warn('Failed to serialize inputs for sandbox:', e);
          }
          
          frame.contentWindow.postMessage({
            type: 'execute',
            id: executionId,
            code,
            inputs: serializedInputs
          }, '*');
        } else {
          messageHandlers.delete(executionId);
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: 'Sandbox frame not ready',
            executedAt: new Date().toISOString(),
          });
        }
      };

      if (frame.contentWindow && frame.contentDocument?.readyState === 'complete') {
        sendMessage();
      } else {
        frame.addEventListener('load', sendMessage, { once: true });
      }
    } catch (error) {
      messageHandlers.delete(executionId);
      clearTimeout(timeoutId);
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute in sandbox',
        executedAt: new Date().toISOString(),
      });
    }
  });
}

export function cleanupSandbox() {
  if (sandboxFrame && document.body.contains(sandboxFrame)) {
    document.body.removeChild(sandboxFrame);
    sandboxFrame = null;
  }
  messageHandlers.clear();
}

export function executeCodeInSandbox(
  code: string,
  language: CodeLanguage,
  inputs: Record<string, unknown>
): CodeExecutionResult {
  if (language === 'python') {
    return {
      success: false,
      error: 'Python execution requires Pyodide integration (not yet implemented). Use JavaScript for now.',
      executedAt: new Date().toISOString(),
    };
  }
  
  const logs: string[] = [];
  const mockConsole = {
    log: (...args: unknown[]) => {
      logs.push(args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' '));
    },
    error: (...args: unknown[]) => {
      logs.push('[ERROR] ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' '));
    },
    warn: (...args: unknown[]) => {
      logs.push('[WARN] ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' '));
    },
    info: (...args: unknown[]) => {
      logs.push('[INFO] ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' '));
    },
  };

  try {
    const wrappedCode = `
      "use strict";
      ${code}
    `;
    
    const fn = new Function('console', 'inputs', wrappedCode);
    const returnValue = fn(mockConsole, inputs);
    
    return {
      success: true,
      output: logs.length > 0 ? logs.join('\n') : undefined,
      returnValue,
      executedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      output: logs.length > 0 ? logs.join('\n') : undefined,
      error: error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error',
      executedAt: new Date().toISOString(),
    };
  }
}
