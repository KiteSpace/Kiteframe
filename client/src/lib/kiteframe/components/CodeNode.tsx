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
import { StatusBadge } from './StatusBadge';
import { Play, Square, Settings, ChevronDown, ChevronUp, ChevronRight, Loader2, Code2, Terminal, AlertCircle, CheckCircle, Table2, FileText, ArrowRight, Database, Copy, Check, HelpCircle, PanelRightOpen, PanelRightClose, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
const DATA_REFERENCE_PANEL_WIDTH = 224; // w-56 = 14rem = 224px

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
  isStatusEnabled = false,
  onStatusClick,
  readOnly = false,
  onStartDrag,
  onClick,
  onHandleConnect,
  viewport,
  connectedDataSources = [],
  onExecuteCode,
  onCreateRenderNode,
  showDragPlaceholder = false,
  isAnyDragActive = false,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(node.data.label || 'Code');
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDataReference, setShowDataReference] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
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
  
  const baseNodeWidth = node.style?.width || node.width || DEFAULT_CODE_WIDTH;
  const nodeWidth = showDataReference ? baseNodeWidth + DATA_REFERENCE_PANEL_WIDTH : baseNodeWidth;
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

  useEffect(() => {
    return () => {
      setShowHelpModal(false);
      setShowDataReference(false);
    };
  }, []);

  useEffect(() => {
    if (connectedDataSources.length > 0) {
      const firstSource = connectedDataSources[0];
      const varName = firstSource.variableName || firstSource.nodeName || 'data';
      setExpandedSections(prev => {
        if (!prev[`var-${varName}`]) {
          return { ...prev, [`var-${varName}`]: true };
        }
        return prev;
      });
    }
  }, [connectedDataSources]);

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
      
      // Auto-create RenderNode when HTML output is detected
      if (detectedHtmlMode && result.htmlOutput && onCreateRenderNode) {
        onCreateRenderNode(node.id);
      }
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

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedItem(id);
      setTimeout(() => setCopiedItem(null), 1500);
    } catch (err) {
      console.warn('Failed to copy to clipboard:', err);
    }
  }, []);

  const getDataSourceInfo = useMemo(() => {
    return connectedDataSources.map(source => {
      const varName = source.variableName || source.nodeName || 'data';
      const data = source.data[varName];
      const rows = Array.isArray(data) ? data : [];
      const providedColumns = source.data._columns as string[] | undefined;
      const columns = providedColumns && Array.isArray(providedColumns) 
        ? providedColumns.filter((c): c is string => typeof c === 'string')
        : (rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null
            ? Object.keys(rows[0])
            : []);
      const isPending = source.data._pending === true;
      return {
        ...source,
        varName,
        rows,
        columns,
        sampleRow: rows[0] || null,
        isPending,
      };
    });
  }, [connectedDataSources]);

  const getSnippetsForVariable = useCallback((varName: string, columns: string[]) => {
    const stringColumns = columns.filter((c): c is string => typeof c === 'string');
    const firstCol = stringColumns[0] || 'column';
    const numericCol = stringColumns.find(c => ['cost', 'price', 'amount', 'total', 'value', 'count', 'quantity'].some(n => c.toLowerCase().includes(n))) || stringColumns[0] || 'value';
    return [
      { label: 'All rows', code: varName, desc: 'Array of all rows' },
      { label: 'First row', code: `${varName}[0]`, desc: 'Object with all columns' },
      { label: 'Row count', code: `${varName}.length`, desc: 'Number of rows' },
      { label: 'Filter rows', code: `${varName}.filter(r => r.${firstCol} === 'value')`, desc: 'Returns matching rows' },
      { label: 'Map values', code: `${varName}.map(r => r.${firstCol})`, desc: `Array of ${firstCol}` },
      { label: 'Sum column', code: `${varName}.reduce((sum, r) => sum + r.${numericCol}, 0)`, desc: `Total of ${numericCol}` },
    ];
  }, []);

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
        "absolute rounded-lg overflow-hidden transition-all duration-200 flex flex-col",
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
        className="flex items-center justify-between px-3 py-2 cursor-move select-none flex-shrink-0"
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
      
      {/* Data toolbar - always shown for Data Reference toggle, badges only when connected */}
      <div 
        className="px-3 py-2 text-xs border-b flex flex-wrap items-center gap-2 flex-shrink-0"
        style={{ 
          backgroundColor: connectedDataSources.length > 0 ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)', 
          borderColor: borderColor,
        }}
      >
        {connectedDataSources.length > 0 ? (
          connectedDataSources.map((source, idx) => {
            const isPending = source.data._pending === true;
            return (
              <div 
                key={source.nodeId}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ring-1 ring-indigo-400/40"
                style={{
                  backgroundColor: isPending ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                  color: isPending ? '#fbbf24' : '#a5b4fc',
                }}
                data-testid={`code-linked-source-${idx}`}
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : source.nodeType === 'table' ? (
                  <Table2 className="w-3.5 h-3.5" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span className="font-medium">{source.nodeName || (source.nodeType === 'table' ? 'Table' : 'Form')}</span>
                {source.variableName && (
                  <>
                    <ArrowRight className="w-3 h-3 opacity-60" />
                    <code className="px-1 py-0.5 rounded text-[10px] font-mono" style={{ backgroundColor: isPending ? 'rgba(245, 158, 11, 0.25)' : 'rgba(99, 102, 241, 0.25)' }}>
                      {source.variableName}
                    </code>
                  </>
                )}
              </div>
            );
          })
        ) : (
          <span className="text-gray-500 text-xs">No linked data sources</span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDataReference(!showDataReference);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            "ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
            showDataReference 
              ? "bg-indigo-600 text-white" 
              : "bg-indigo-900/30 text-indigo-300 hover:bg-indigo-900/50"
          )}
          title={showDataReference ? "Hide Data Reference" : "Show Data Reference"}
          data-testid="code-node-toggle-data-reference"
        >
          {showDataReference ? (
            <PanelRightClose className="w-3.5 h-3.5" />
          ) : (
            <PanelRightOpen className="w-3.5 h-3.5" />
          )}
          <span>Ref</span>
        </button>
      </div>

      {/* Main content area - flex layout for editor + optional reference panel */}
      <div 
        className="flex flex-row overflow-hidden flex-1 min-h-0"
      >
        {/* Code Editor with CodeMirror */}
        <div 
          ref={contentRef}
          className="flex-1 flex flex-col overflow-hidden min-w-0"
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

        {/* Inline Data Reference Panel - always available when toggled */}
        {showDataReference && (
          <div
            className="w-56 bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            data-testid="code-node-data-reference-panel"
          >
            <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-gray-200">Data Reference</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDataReference(false);
                }}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
                data-testid="code-node-close-data-reference"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 min-h-0">
              {getDataSourceInfo.length > 0 ? (
                <>
                  {getDataSourceInfo.map((source, sourceIdx) => (
                    <div key={source.nodeId} className="mb-4">
                      <button 
                        onClick={() => toggleSection(`var-${source.varName}`)}
                        className="flex items-center gap-2 w-full text-left hover:bg-gray-800 rounded px-2 py-1.5 -mx-2"
                      >
                        {expandedSections[`var-${source.varName}`] ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <code className="text-yellow-300 text-sm font-mono">{source.varName}</code>
                        <span className="text-gray-500 text-xs ml-auto">
                          {source.isPending ? (
                            <span className="text-amber-400">Loading...</span>
                          ) : (
                            `Array[${source.rows.length}]`
                          )}
                        </span>
                      </button>
                      
                      {expandedSections[`var-${source.varName}`] && (
                        <div className="ml-4 mt-2 space-y-1">
                          {source.isPending ? (
                            <div className="text-xs text-amber-400 px-2 py-2 bg-amber-900/20 rounded">
                              Waiting for table data to load...
                            </div>
                          ) : (
                            <>
                              <button 
                                onClick={() => toggleSection(`cols-${source.varName}`)}
                                className="flex items-center gap-2 w-full text-left hover:bg-gray-800 rounded px-2 py-1 text-sm"
                              >
                                {expandedSections[`cols-${source.varName}`] ? (
                                  <ChevronDown className="w-3 h-3 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 text-gray-400" />
                                )}
                                <span className="text-gray-300">Columns</span>
                                <span className="text-gray-500 text-xs ml-auto">{source.columns.length}</span>
                              </button>
                              
                              {expandedSections[`cols-${source.varName}`] && (
                                <div className="ml-4 space-y-0.5">
                                  {source.columns.map((col) => (
                                    <div 
                                      key={col}
                                      onClick={() => copyToClipboard(`${source.varName}[0].${col}`, `${source.varName}-${col}`)}
                                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800 rounded cursor-pointer group"
                                    >
                                      <code className="text-green-300 text-xs font-mono">.{col}</code>
                                      <span className="text-gray-500 text-xs ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                        {copiedItem === `${source.varName}-${col}` ? (
                                          <Check className="w-3 h-3 text-green-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {source.sampleRow && (
                                <div className="mt-2 pt-2 border-t border-gray-700">
                                  <div className="text-xs text-gray-500 px-2 mb-1">Sample ({source.varName}[0]):</div>
                                  <div className="bg-gray-950 rounded p-2 text-xs font-mono overflow-x-auto max-h-24 overflow-y-auto">
                                    <pre className="text-gray-300 whitespace-pre-wrap">{JSON.stringify(source.sampleRow, null, 2)}</pre>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="border-t border-gray-700 pt-3 mt-3">
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-2 px-1">Quick Snippets</div>
                    <div className="space-y-1">
                      {getDataSourceInfo.filter(s => !s.isPending).slice(0, 1).map((source) => 
                        getSnippetsForVariable(source.varName, source.columns).map((snippet, idx) => (
                          <div
                            key={idx}
                            onClick={() => copyToClipboard(snippet.code, `snippet-${source.varName}-${idx}`)}
                            className="flex flex-col px-2 py-1.5 hover:bg-gray-800 rounded cursor-pointer group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-300">{snippet.label}</span>
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                {copiedItem === `snippet-${source.varName}-${idx}` ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-gray-500" />
                                )}
                              </span>
                            </div>
                            <code className="text-xs font-mono text-indigo-300 truncate">{snippet.code}</code>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <Database className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 mb-2">No data sources linked</p>
                  <p className="text-xs text-gray-500 px-2">
                    Connect a Table or Form node to this Code node to access its data through the <code className="text-indigo-400">inputs</code> object.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-700 px-3 py-2.5 bg-gray-800/50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHelpModal(true);
                }}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-indigo-300 transition-colors w-full justify-center"
                data-testid="code-node-how-this-works"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>How this works</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Output Panel */}
      {showOutput && (
        <div 
          className="border-t flex flex-col flex-shrink-0"
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
                Console
              </span>
              {lastResult && (
                lastResult.success ? (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-red-500" />
                )
              )}
            </div>
            <div className="flex items-center gap-1">
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
          </div>
          
          {/* Output content - console only (no UI preview) */}
          <div 
            className="flex-1 p-2 overflow-auto font-mono text-xs"
            style={{ 
              color: lastResult?.success === false ? '#f87171' : '#a3e635',
              cursor: 'text',
              userSelect: 'text',
            }}
          >
            {lastResult ? (
              <pre className="whitespace-pre-wrap break-words" style={{ cursor: 'text' }}>
                {lastResult.error || lastResult.output || (
                  lastResult.returnValue !== undefined 
                    ? JSON.stringify(lastResult.returnValue, null, 2)
                    : isHtmlOutput ? '(HTML output rendered in connected node)' : '(no output)'
                )}
              </pre>
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

      {/* How This Works Modal */}
      <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-400" />
              Using Table Data in Code
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <h3 className="font-medium mb-1">Link a Table to Your Code Node</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Draw an edge from any table node to your code node. You'll be asked to choose a variable name for the data.
                </p>
                <div className="bg-gray-950 rounded-lg p-3 flex items-center gap-3">
                  <div className="bg-blue-600/20 border border-blue-500/30 rounded px-3 py-2 text-sm">
                    <Table2 className="w-4 h-4 inline mr-2" />
                    Products Table
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-500" />
                  <div className="bg-gray-700 rounded px-3 py-2 text-sm">
                    Variable name: <code className="text-yellow-300">products</code>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <h3 className="font-medium mb-1">Access Your Data</h3>
                <p className="text-sm text-gray-400 mb-3">
                  The table data becomes available as an array of objects. Each row is an object with column names as keys.
                </p>
                <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm">
                  <div className="text-gray-500 mb-2">// Your table data looks like this:</div>
                  <div><span className="text-yellow-300">products</span><span className="text-white"> = [</span></div>
                  <div className="pl-4">
                    <span className="text-white">{'{ '}</span>
                    <span className="text-green-300">name</span><span className="text-white">: </span>
                    <span className="text-amber-300">"Widget"</span><span className="text-white">, </span>
                    <span className="text-green-300">price</span><span className="text-white">: </span>
                    <span className="text-blue-300">29.99</span>
                    <span className="text-white">{' },'}</span>
                  </div>
                  <div className="pl-4">
                    <span className="text-white">{'{ '}</span>
                    <span className="text-green-300">name</span><span className="text-white">: </span>
                    <span className="text-amber-300">"Gadget"</span><span className="text-white">, </span>
                    <span className="text-green-300">price</span><span className="text-white">: </span>
                    <span className="text-blue-300">49.99</span>
                    <span className="text-white">{' }'}</span>
                  </div>
                  <div><span className="text-white">];</span></div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">3</div>
              <div>
                <h3 className="font-medium mb-1">Write Your Code</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Use standard JavaScript to filter, map, or aggregate your data:
                </p>
                <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm space-y-2">
                  <div>
                    <span className="text-gray-500">// Get first item's name</span><br />
                    <span className="text-yellow-300">products</span><span className="text-white">[0].</span>
                    <span className="text-green-300">name</span>
                  </div>
                  <div>
                    <span className="text-gray-500">// Filter by condition</span><br />
                    <span className="text-yellow-300">products</span>
                    <span className="text-white">.filter(p =&gt; p.price &gt; 30)</span>
                  </div>
                  <div>
                    <span className="text-gray-500">// Calculate total</span><br />
                    <span className="text-yellow-300">products</span>
                    <span className="text-white">.reduce((sum, p) =&gt; sum + p.price, 0)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-indigo-900/30 border border-indigo-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-indigo-400 mt-0.5">💡</div>
                <div>
                  <div className="font-medium text-sm mb-1">Pro Tip</div>
                  <p className="text-sm text-gray-400">
                    Click any column name or snippet in the Data Reference panel to copy the code. 
                    You can link multiple tables to one code node - each gets its own variable name!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
