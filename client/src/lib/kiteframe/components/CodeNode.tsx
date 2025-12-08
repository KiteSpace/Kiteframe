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

const DEFAULT_CODE_WIDTH = 400;
const DEFAULT_CODE_HEIGHT = 350;
const MIN_CODE_WIDTH = 300;
const MIN_CODE_HEIGHT = 200;
const MAX_CODE_HEIGHT = 800;
const DEFAULT_OUTPUT_HEIGHT = 120;

const LANGUAGE_CONFIG: Record<CodeLanguage, { label: string; placeholder: string }> = {
  javascript: {
    label: 'JavaScript',
    placeholder: '// Write your JavaScript code here\n// Access form/table data via the `inputs` object\n\nconsole.log("Hello, World!");\nconsole.log("Available inputs:", inputs);'
  },
  python: {
    label: 'Python',
    placeholder: '# Write your Python code here\n# Access form/table data via the `inputs` dictionary\n\nprint("Hello, World!")\nprint("Available inputs:", inputs)'
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
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  useScrollIsolation(contentRef);
  
  const code = node.data.code || '';
  const language: CodeLanguage = node.data.language || 'javascript';
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
    const isInteractiveElement = target.closest('input, button, textarea, select, [contenteditable="true"]');
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

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    onUpdate?.(node.id, {
      data: { ...node.data, code: newCode },
    });
  }, [node.id, node.data, onUpdate]);

  const handleLanguageChange = useCallback((newLanguage: CodeLanguage) => {
    onUpdate?.(node.id, {
      data: { ...node.data, language: newLanguage },
    });
    setShowSettings(false);
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
      
      if (onExecuteCode) {
        result = await onExecuteCode(node.id, code, language, inputData);
      } else {
        result = await executeInSandbox(code, language, inputData);
      }
      
      onUpdate?.(node.id, {
        data: { 
          ...node.data, 
          lastResult: result,
          showOutput: true 
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
  }, [isRunning, code, language, inputData, node.id, node.data, onUpdate, onExecuteCode]);

  const handleResize = useCallback((width: number, height: number) => {
    onUpdate?.(node.id, {
      style: { width, height },
    });
  }, [node.id, onUpdate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunCode();
    }
    
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = code.substring(0, start) + '  ' + code.substring(end);
      onUpdate?.(node.id, {
        data: { ...node.data, code: newValue },
      });
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  }, [code, node.id, node.data, onUpdate, handleRunCode]);

  const dropShadow = '0 4px 16px rgba(0,0,0,0.2)';

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
              {LANGUAGE_CONFIG[language].label}
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

      {/* Code Editor */}
      <div 
        ref={contentRef}
        className="flex flex-col overflow-hidden"
        style={{ height: `calc(100% - ${showOutput ? 44 + outputHeight : 44}px)` }}
      >
        <textarea
          ref={editorRef}
          value={code}
          onChange={handleCodeChange}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder={LANGUAGE_CONFIG[language].placeholder}
          className={cn(
            "flex-1 w-full p-3 font-mono text-sm resize-none border-0 outline-none",
            "bg-transparent placeholder:text-gray-500"
          )}
          style={{ 
            color: '#d4d4d4',
            lineHeight: 1.5,
            tabSize: 2,
          }}
          spellCheck={false}
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
              <span className="text-xs font-medium text-gray-400">Output</span>
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
            style={{ color: lastResult?.success === false ? '#f87171' : '#a3e635' }}
          >
            {lastResult ? (
              <pre className="whitespace-pre-wrap break-words">
                {lastResult.error || lastResult.output || (
                  lastResult.returnValue !== undefined 
                    ? JSON.stringify(lastResult.returnValue, null, 2)
                    : '(no output)'
                )}
              </pre>
            ) : (
              <span className="text-gray-500 italic">Click Run to execute code</span>
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
