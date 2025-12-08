import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { NodeHandles } from './NodeHandles';
import { ResizeHandle } from './ResizeHandle';
import { useScrollIsolation } from '../hooks/useScrollIsolation';
import type {
  Node,
  CodeNodeData,
  CodeNodeComponentProps,
  CodeExecutionResult,
  CodeLanguage,
  CodeNode as CodeNodeType,
  Position
} from '../types';
import { sanitizeText, validateColor } from '../utils/validation';
import { executeInSandbox } from '../utils/sandboxExecutor';
import { getBorderColorFromHeader } from '@/lib/themes';
import { Play, Square, Settings, ChevronDown, ChevronUp, Loader2, Code2, Terminal, AlertCircle, CheckCircle } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';

const DEFAULT_CODE_WIDTH = 400;
const DEFAULT_CODE_HEIGHT = 350;
const MIN_CODE_WIDTH = 300;
const MIN_CODE_HEIGHT = 200;
const MAX_CODE_HEIGHT = 800;
const DEFAULT_OUTPUT_HEIGHT = 120;

const containsHtml = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false;
  const htmlTagPattern = /<\/?[a-z][\s\S]*?>/i;
  return htmlTagPattern.test(text);
};

const LANGUAGE_CONFIG: Record<CodeLanguage, { label: string; placeholder: string }> = {
  javascript: {
    label: 'JavaScript',
    placeholder: '// Write your JavaScript code here\n// Access form/table data via the `inputs` object\n\nconsole.log("Hello, World!");\nconsole.log("Available inputs:", inputs);'
  },
  python: {
    label: 'Python',
    placeholder: '# Write your Python code here\n# Access form/table data via the `inputs` dictionary\n\nprint("Hello, World!")\nprint("Available inputs:", inputs)'
  },
  html: {
    label: 'HTML',
    placeholder: '<!-- Write your HTML here -->\n<div style="padding: 20px;">\n  <h1>Hello, World!</h1>\n  <p>This will render in the output panel.</p>\n</div>'
  }
};

const CodeNodeComponent: React.FC<CodeNodeComponentProps> = ({
  node,
  onUpdate,
  onDoubleClick,
  onFocusNode,
  className,
  style,
  showHandles = true,
  showResizeHandle = true,
  onStartDrag,
  onClick,
  onHandleConnect,
  viewport,
  connectedDataSources = [],
  onExecuteCode,
  showDragPlaceholder = false,
  isAnyDragActive = false,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(node.data.label || 'Code');
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const nodeRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  useScrollIsolation(contentRef);
  
  const code = node.data.code || '';
  const language: CodeLanguage = node.data.language || 'javascript';
  const outputType = node.data.outputType || 'console';
  const lastResult = node.data.lastResult;
  const showOutput = node.data.showOutput !== false;
  const outputHeight = node.data.outputHeight || DEFAULT_OUTPUT_HEIGHT;
  
  const nodeWidth = node.style?.width || node.width || DEFAULT_CODE_WIDTH;
  const nodeHeight = node.style?.height || node.height || DEFAULT_CODE_HEIGHT;
  
  const headerColor = node.data.colors?.headerBackground || '#1e1e1e';
  const bodyColor = node.data.colors?.bodyBackground || '#252526';
  const borderColor = node.data.colors?.borderColor || getBorderColorFromHeader(headerColor);
  const headerTextColor = node.data.colors?.headerTextColor || '#d4d4d4';

  const inputData = useMemo(() => {
    const inputs: Record<string, unknown> = {};
    connectedDataSources.forEach((source) => {
      Object.entries(source.data).forEach(([key, value]) => {
        inputs[key] = value;
      });
    });
    return inputs;
  }, [connectedDataSources]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('input, button, textarea, select, [contenteditable="true"], .cm-editor');
    if (isInteractiveElement) return;
    e.stopPropagation();
    onStartDrag?.(e, node);
  }, [onStartDrag, node]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e, node);
  }, [onClick, node]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(e);
  }, [onDoubleClick]);

  const handleTitleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
    setEditTitleValue(node.data.label || 'Code');
  }, [node.data.label]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditTitleValue(e.target.value);
  }, []);

  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false);
    const sanitized = sanitizeText(editTitleValue.trim()) || 'Code';
    if (sanitized !== node.data.label) {
      onUpdate?.(node.id, {
        data: { ...node.data, label: sanitized },
      });
    }
  }, [editTitleValue, node.id, node.data, onUpdate]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setEditTitleValue(node.data.label || 'Code');
    }
  }, [handleTitleBlur, node.data.label]);

  const handleCodeChange = useCallback((value: string) => {
    onUpdate?.(node.id, {
      data: { ...node.data, code: value },
    });
  }, [node.id, node.data, onUpdate]);

  const handleLanguageChange = useCallback((newLanguage: CodeLanguage) => {
    onUpdate?.(node.id, {
      data: { ...node.data, language: newLanguage },
    });
    setShowSettings(false);
  }, [node.id, node.data, onUpdate]);

  const handleOutputTypeChange = useCallback((newOutputType: 'console' | 'html') => {
    onUpdate?.(node.id, {
      data: { ...node.data, outputType: newOutputType },
    });
  }, [node.id, node.data, onUpdate]);

  const handleToggleOutput = useCallback(() => {
    onUpdate?.(node.id, {
      data: { ...node.data, showOutput: !showOutput },
    });
  }, [node.id, node.data, showOutput, onUpdate]);

  const handleRunCode = useCallback(async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    
    try {
      let result: CodeExecutionResult;
      
      // HTML language: render code directly as HTML (no execution needed)
      if (language === 'html') {
        result = {
          success: true,
          output: code,
          htmlOutput: code,
          executedAt: new Date().toISOString(),
        };
      } else if (onExecuteCode) {
        // Use external executor if provided
        result = await onExecuteCode(node.id, code, language, inputData);
      } else {
        // Execute in sandbox
        result = await executeInSandbox(code, language, inputData);
      }
      
      // Auto-detect HTML in output and enable HTML rendering
      let detectedHtmlMode = outputType === 'html';
      if (result.success && result.output && !detectedHtmlMode) {
        if (containsHtml(result.output)) {
          detectedHtmlMode = true;
          result = { ...result, htmlOutput: result.output };
        }
      }
      
      // If HTML mode is enabled (manual or auto-detected), set htmlOutput
      if (detectedHtmlMode && result.success && result.output && !result.htmlOutput) {
        result = { ...result, htmlOutput: result.output };
      }
      
      onUpdate?.(node.id, {
        data: { 
          ...node.data, 
          lastResult: result,
          showOutput: true,
          outputType: detectedHtmlMode ? 'html' : outputType
        },
      });
    } catch (error) {
      const result: CodeExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        executedAt: new Date().toISOString(),
      };
      onUpdate?.(node.id, {
        data: { 
          ...node.data, 
          lastResult: result,
          showOutput: true 
        },
      });
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, code, language, outputType, inputData, node.id, node.data, onUpdate, onExecuteCode]);

  const handleResize = useCallback((width: number, height: number) => {
    onUpdate?.(node.id, {
      style: { width, height },
    });
  }, [node.id, onUpdate]);

  const getLanguageExtension = useCallback(() => {
    switch (language) {
      case 'javascript':
        return javascript({ jsx: true, typescript: false });
      case 'html':
        return html({ matchClosingTags: true, autoCloseTags: true });
      case 'python':
        return python();
      default:
        return javascript();
    }
  }, [language]);

  const editorExtensions = useMemo(() => [
    getLanguageExtension(),
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    indentOnInput(),
    highlightSelectionMatches(),
    EditorView.lineWrapping,
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...completionKeymap,
    ]),
    EditorView.theme({
      '&': {
        height: '100%',
        fontSize: '13px',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      },
      '.cm-content': {
        caretColor: '#fff',
        padding: '8px 0',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        borderRight: '1px solid #333',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 8px',
        minWidth: '32px',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
      },
    }),
  ], [getLanguageExtension]);

  const dropShadow = '0 4px 16px rgba(0,0,0,0.2)';

  const isHtmlOutput = language === 'html' || outputType === 'html';

  return (
    <div
      ref={nodeRef}
      className={cn(
        "absolute rounded-lg overflow-hidden transition-shadow duration-200",
        node.selected && "ring-2 ring-blue-500 ring-offset-1",
        className
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: nodeWidth,
        height: nodeHeight,
        backgroundColor: bodyColor,
        borderColor: borderColor,
        borderWidth: 1,
        borderStyle: 'solid',
        boxShadow: dropShadow,
        zIndex: node.zIndex || 1,
        ...style,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      data-testid={`code-node-${node.id}`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-move select-none"
        style={{ backgroundColor: headerColor }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Code2 className="w-4 h-4 flex-shrink-0" style={{ color: headerTextColor }} />
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editTitleValue}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 px-1 py-0.5 text-sm font-medium bg-black/20 rounded border-none outline-none"
              style={{ color: headerTextColor }}
              data-testid="code-node-title-input"
            />
          ) : (
            <span
              className="text-sm font-medium truncate cursor-text"
              style={{ color: headerTextColor }}
              onDoubleClick={handleTitleDoubleClick}
              data-testid="code-node-title"
            >
              {node.data.label || 'Code'}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {/* Output type toggle for JS */}
          {language === 'javascript' && (
            <div className="flex items-center mr-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOutputTypeChange(outputType === 'console' ? 'html' : 'console');
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors",
                  outputType === 'html' 
                    ? "bg-purple-600 text-white" 
                    : "bg-black/20 text-gray-400 hover:bg-black/30"
                )}
                title={outputType === 'html' ? 'HTML Output Mode' : 'Console Output Mode'}
                data-testid="code-node-output-type-btn"
              >
                {outputType === 'html' ? 'HTML' : 'Console'}
              </button>
            </div>
          )}
          
          {/* Language badge */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSettings(!showSettings);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="px-2 py-0.5 text-xs font-mono rounded bg-black/20 hover:bg-black/30 transition-colors"
              style={{ color: headerTextColor }}
              data-testid="code-node-language-btn"
            >
              {LANGUAGE_CONFIG[language]?.label || 'JavaScript'}
            </button>
            
            {showSettings && (
              <div 
                className="absolute right-0 top-full mt-1 bg-gray-800 rounded-md shadow-lg border border-gray-700 overflow-hidden z-50"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {Object.entries(LANGUAGE_CONFIG).map(([lang, config]) => (
                  <button
                    key={lang}
                    onClick={() => handleLanguageChange(lang as CodeLanguage)}
                    className={cn(
                      "block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-700 transition-colors",
                      language === lang ? "bg-blue-600 text-white" : "text-gray-300"
                    )}
                    data-testid={`code-node-lang-${lang}`}
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Run button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRunCode();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={isRunning}
            className={cn(
              "p-1.5 rounded transition-colors",
              isRunning 
                ? "bg-yellow-600/50 cursor-wait" 
                : "bg-green-600 hover:bg-green-500"
            )}
            title={isRunning ? "Running..." : "Run code (Cmd/Ctrl + Enter)"}
            data-testid="code-node-run-btn"
          >
            {isRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Play className="w-3.5 h-3.5 text-white" />
            )}
          </button>
        </div>
      </div>
      
      {/* Input variables indicator */}
      {connectedDataSources.length > 0 && (
        <div 
          className="px-3 py-1.5 text-xs border-b flex items-center gap-2"
          style={{ 
            backgroundColor: 'rgba(59, 130, 246, 0.1)', 
            borderColor: borderColor,
            color: '#93c5fd'
          }}
        >
          <span className="font-medium">inputs:</span>
          <span className="font-mono text-gray-400 truncate">
            {Object.keys(inputData).slice(0, 3).join(', ')}
            {Object.keys(inputData).length > 3 && ` +${Object.keys(inputData).length - 3} more`}
          </span>
        </div>
      )}

      {/* Code Editor with CodeMirror */}
      <div 
        ref={contentRef}
        className="flex flex-col overflow-hidden"
        style={{ height: `calc(100% - ${showOutput ? 44 + outputHeight : 44}px)` }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <CodeMirror
          value={code}
          onChange={handleCodeChange}
          extensions={editorExtensions}
          theme={oneDark}
          placeholder={LANGUAGE_CONFIG[language]?.placeholder || LANGUAGE_CONFIG.javascript.placeholder}
          basicSetup={false}
          style={{ height: '100%', overflow: 'hidden' }}
          data-testid="code-node-editor"
        />
      </div>

      {/* Output Panel */}
      {showOutput && (
        <div 
          className="border-t flex flex-col"
          style={{ 
            borderColor: borderColor, 
            height: outputHeight,
            backgroundColor: '#1a1a1a'
          }}
        >
          {/* Output header */}
          <div 
            className="flex items-center justify-between px-2 py-1 border-b"
            style={{ borderColor: borderColor }}
          >
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-gray-500" />
              <span className="text-xs font-medium text-gray-400">
                {isHtmlOutput ? 'Preview' : 'Output'}
              </span>
              {lastResult && (
                lastResult.success ? (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-red-500" />
                )
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleOutput();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-0.5 hover:bg-gray-700 rounded transition-colors"
              data-testid="code-node-toggle-output"
            >
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
          
          {/* Output content */}
          <div 
            className="flex-1 p-2 overflow-auto font-mono text-xs"
            style={{ 
              color: lastResult?.success === false ? '#f87171' : '#a3e635',
              cursor: 'text',
              userSelect: 'text',
            }}
          >
            {lastResult ? (
              isHtmlOutput && lastResult.htmlOutput ? (
                <div 
                  className="bg-white rounded p-2 h-full overflow-auto"
                  style={{ color: 'initial', cursor: 'default' }}
                  dangerouslySetInnerHTML={{ __html: lastResult.htmlOutput }}
                />
              ) : (
                <pre className="whitespace-pre-wrap break-words" style={{ cursor: 'text' }}>
                  {lastResult.error || lastResult.output || (
                    lastResult.returnValue !== undefined 
                      ? JSON.stringify(lastResult.returnValue, null, 2)
                      : '(no output)'
                  )}
                </pre>
              )
            ) : (
              <span className="text-gray-500 italic" style={{ cursor: 'text' }}>Click Run to execute code</span>
            )}
          </div>
        </div>
      )}
      
      {/* Collapsed output toggle */}
      {!showOutput && lastResult && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleOutput();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 py-1 bg-gray-800/80 hover:bg-gray-700/80 transition-colors border-t"
          style={{ borderColor: borderColor }}
          data-testid="code-node-show-output"
        >
          <ChevronUp className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-400">Show Output</span>
          {lastResult.success ? (
            <CheckCircle className="w-3 h-3 text-green-500" />
          ) : (
            <AlertCircle className="w-3 h-3 text-red-500" />
          )}
        </button>
      )}

      {/* Handles */}
      {showHandles && node.showHandles !== false && !isAnyDragActive && (
        <NodeHandles
          node={node}
          scale={viewport?.zoom || 1}
          onHandleConnect={onHandleConnect}
        />
      )}

      {/* Resize Handle */}
      {showResizeHandle && node.resizable !== false && (
        <ResizeHandle
          position="bottom-right"
          nodeRef={nodeRef}
          onResize={handleResize}
          minWidth={MIN_CODE_WIDTH}
          minHeight={MIN_CODE_HEIGHT}
          maxWidth={800}
          maxHeight={MAX_CODE_HEIGHT}
          viewport={viewport}
        />
      )}
    </div>
  );
};

export const createCodeNode = (
  id: string,
  position: Position,
  data: Partial<CodeNodeData> = {}
): CodeNodeType => ({
  id,
  type: 'code',
  position,
  data: {
    label: data.label || 'Code',
    code: data.code || '',
    language: data.language || 'javascript',
    outputType: data.outputType || 'console',
    showOutput: data.showOutput !== false,
    outputHeight: data.outputHeight || DEFAULT_OUTPUT_HEIGHT,
    colors: data.colors || {
      headerBackground: '#1e1e1e',
      bodyBackground: '#252526',
      headerTextColor: '#d4d4d4',
    }
  },
  width: DEFAULT_CODE_WIDTH,
  height: DEFAULT_CODE_HEIGHT,
  draggable: true,
  selectable: true,
  doubleClickable: true,
  resizable: true,
  showHandles: true,
});

export default CodeNodeComponent;
