import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FlaskConical, Check, Trash2, ChevronDown, Loader2, AlertCircle, X, RefreshCw } from 'lucide-react';
import type { Node, ExperimentNodeData, ExperimentMode, ExperimentOption, WildCardNodeData } from '../types';
import { sanitizeText } from '../utils/validation';

const HEADER_H = 44;
const FOOTER_H = 48;
const NODE_HEIGHT = 480;
const NODE_WIDTH = 320;

// Purple theme colors
const PURPLE = {
  stroke: '#9333ea', // purple-600
  header: '#f3e8ff', // purple-100
  footer: '#f3e8ff', // purple-100
  accent: '#a855f7', // purple-500
  dark: '#7c3aed', // purple-600 darker
};

export interface ExperimentNodeComponentProps {
  node: Node & { data: ExperimentNodeData | WildCardNodeData };
  onUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  onDelete?: (nodeId: string) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  showHandles?: boolean;
  showResizeHandle?: boolean;
  onStartDrag?: (e: React.MouseEvent, node: Node) => void;
  onClick?: (e: React.MouseEvent, node: Node) => void;
  onHandleConnect?: (position: 'top' | 'right' | 'bottom' | 'left', e: React.MouseEvent) => void;
  viewport?: { x: number; y: number; zoom: number };
  showDragPlaceholder?: boolean;
  isAnyDragActive?: boolean;
  onGenerateBranch?: (nodeId: string) => void;
  onAdoptBranch?: (nodeId: string) => void;
  onDiscardBranch?: (nodeId: string) => void;
  readOnly?: boolean;
  predictiveOptions?: ExperimentOption[];
  incomingEdgesCount?: number;
  optionsLoading?: boolean;
  optionsError?: string | null;
  onRefreshOptions?: (nodeId: string) => void;
  onGenerateOptionsForMode?: (nodeId: string, mode: ExperimentMode) => void;
}

const MODE_CONFIG: Record<ExperimentMode, { label: string; placeholder: string; icon?: string }> = {
  whatif: {
    label: 'What If',
    placeholder: 'Select an edge case or enter a custom scenario...',
  },
  risk: {
    label: 'Risk',
    placeholder: 'Select a failure mode or describe a risk...',
  },
  enhancement: {
    label: 'Enhancement',
    placeholder: 'Select an optimization or describe an improvement...',
  },
  prompt: {
    label: 'Prompt',
    placeholder: 'Enter your specific idea or instruction...',
  },
};

const MODE_LABELS: Record<ExperimentMode, string> = {
  whatif: 'What If',
  risk: 'Risk',
  enhancement: 'Enhancement',
  prompt: 'Prompt',
};

function isExperimentNodeData(data: any): data is ExperimentNodeData {
  return data && typeof data.generation === 'object' && typeof data.ui === 'object';
}

function getGenerationStatus(data: ExperimentNodeData | WildCardNodeData): 'idle' | 'generating' | 'generated' | 'error' {
  if (isExperimentNodeData(data)) {
    return data.generation.status;
  }
  if (data.generating || data.isGenerating) return 'generating';
  if (data.hasGeneratedBranch || (data.generatedIds && data.generatedIds.length > 0)) return 'generated';
  if (data.generationError) return 'error';
  return 'idle';
}

function getGenerationError(data: ExperimentNodeData | WildCardNodeData): string | undefined {
  if (isExperimentNodeData(data)) {
    return data.generation.errorMessage;
  }
  return data.generationError;
}

function hasGeneratedContent(data: ExperimentNodeData | WildCardNodeData): boolean {
  if (isExperimentNodeData(data)) {
    return data.generation.status === 'generated' && 
      (data.generation.generatedNodeIds.length > 0 || data.generation.generatedEdgeIds.length > 0);
  }
  return data.hasGeneratedBranch === true || !!(data.generatedIds && data.generatedIds.length > 0);
}

function isPreviewMode(data: ExperimentNodeData | WildCardNodeData): boolean {
  if (isExperimentNodeData(data)) {
    return data.ui.preview;
  }
  return true;
}

export const ExperimentNode: React.FC<ExperimentNodeComponentProps> = ({
  node,
  onUpdate,
  onDelete,
  onDoubleClick,
  className,
  style,
  showHandles = true,
  showResizeHandle = true,
  onStartDrag,
  onClick,
  onHandleConnect,
  viewport,
  showDragPlaceholder = false,
  isAnyDragActive = false,
  onGenerateBranch,
  onAdoptBranch,
  onDiscardBranch,
  readOnly = false,
  predictiveOptions = [],
  incomingEdgesCount = 0,
  optionsLoading = false,
  optionsError = null,
  onRefreshOptions,
  onGenerateOptionsForMode,
}) => {
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [userPromptValue, setUserPromptValue] = useState('');
  const [selectedOption, setSelectedOption] = useState<ExperimentOption | null>(null);

  const nodeRef = useRef<HTMLDivElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  const data = node.data as ExperimentNodeData | WildCardNodeData;
  const mode: ExperimentMode = data.mode || 'whatif';
  const modeConfig = MODE_CONFIG[mode];
  
  const generationStatus = getGenerationStatus(data);
  const isGenerating = generationStatus === 'generating';
  const hasGenerated = hasGeneratedContent(data);
  const generationError = getGenerationError(data);
  const isPreview = isPreviewMode(data);
  
  const hasIncomingEdges = incomingEdgesCount > 0;
  const hasContent = mode === 'prompt' 
    ? userPromptValue.trim().length >= 20
    : !!selectedOption;
  const canGenerate = hasContent && !isGenerating && !hasGenerated && hasIncomingEdges;

  // Track previous incoming edges count for auto-trigger
  const prevIncomingEdgesRef = useRef<number>(incomingEdgesCount);
  
  useEffect(() => {
    if (isExperimentNodeData(data)) {
      setUserPromptValue(data.userPrompt || '');
      if (data.selectedOptionId && data.selectedOptionLabel) {
        setSelectedOption({ id: data.selectedOptionId, label: data.selectedOptionLabel });
      }
    } else {
      setUserPromptValue(data.content || '');
    }
  }, [data]);
  
  // Auto-trigger AI suggestions when an edge is connected (not in prompt mode)
  useEffect(() => {
    const wasDisconnected = prevIncomingEdgesRef.current === 0;
    const isNowConnected = incomingEdgesCount > 0;
    prevIncomingEdgesRef.current = incomingEdgesCount;
    
    // Auto-trigger only when: edge just connected, not prompt mode, not already loading, no cached options
    if (wasDisconnected && isNowConnected && mode !== 'prompt' && !optionsLoading && predictiveOptions.length === 0) {
      onGenerateOptionsForMode?.(node.id, mode);
    }
  }, [incomingEdgesCount, mode, optionsLoading, predictiveOptions.length, node.id, onGenerateOptionsForMode]);
  
  // Sync node dimensions to model for accurate edge connection and hit detection
  useEffect(() => {
    const storedWidth = node.width ?? 0;
    const storedHeight = node.height ?? 0;
    const storedMeasuredWidth = node.measuredWidth ?? 0;
    const storedMeasuredHeight = node.measuredHeight ?? 0;
    
    // Set both width/height (for hit detection) and measuredWidth/measuredHeight (for edge alignment)
    const needsWidthUpdate = Math.abs(storedWidth - NODE_WIDTH) > 2 || Math.abs(storedMeasuredWidth - NODE_WIDTH) > 2;
    const needsHeightUpdate = Math.abs(storedHeight - NODE_HEIGHT) > 2 || Math.abs(storedMeasuredHeight - NODE_HEIGHT) > 2;
    
    if (needsWidthUpdate || needsHeightUpdate) {
      onUpdate?.(node.id, {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        measuredWidth: NODE_WIDTH,
        measuredHeight: NODE_HEIGHT,
      });
    }
  }, [node.id, node.width, node.height, node.measuredWidth, node.measuredHeight, onUpdate]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('input, button, textarea, select, [contenteditable="true"]');
    if (isInteractiveElement) return;
    e.stopPropagation();
    onStartDrag?.(e, node);
  }, [onStartDrag, node]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(e);
  }, [onDoubleClick]);

  const handleModeSelect = useCallback((newMode: ExperimentMode) => {
    setShowModeDropdown(false);
    if (readOnly) return;
    if (newMode !== mode) {
      setSelectedOption(null);
      setUserPromptValue('');
      
      if (isExperimentNodeData(data)) {
        onUpdate?.(node.id, {
          data: {
            ...data,
            mode: newMode,
            label: MODE_LABELS[newMode],
            selectedOptionId: undefined,
            selectedOptionLabel: undefined,
            selectedOptionDescription: undefined,
            userPrompt: '',
          }
        });
      } else {
        onUpdate?.(node.id, {
          data: {
            ...data,
            mode: newMode,
            label: MODE_LABELS[newMode],
            content: '',
          }
        });
      }
      
      if (newMode !== 'prompt' && hasIncomingEdges) {
        onGenerateOptionsForMode?.(node.id, newMode);
      }
    }
  }, [mode, node.id, data, onUpdate, readOnly, hasIncomingEdges, onGenerateOptionsForMode]);

  const handleOptionSelect = useCallback((option: ExperimentOption) => {
    if (readOnly) return;
    setSelectedOption(option);
    
    if (isExperimentNodeData(data)) {
      onUpdate?.(node.id, {
        data: {
          ...data,
          selectedOptionId: option.id,
          selectedOptionLabel: option.label,
          selectedOptionDescription: option.description,
        }
      });
    }
  }, [node.id, data, onUpdate, readOnly]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserPromptValue(e.target.value);
  }, []);

  const handlePromptBlur = useCallback(() => {
    const sanitized = sanitizeText(userPromptValue.trim());
    if (isExperimentNodeData(data)) {
      if (sanitized !== data.userPrompt) {
        onUpdate?.(node.id, { data: { ...data, userPrompt: sanitized } });
      }
    } else {
      if (sanitized !== data.content) {
        onUpdate?.(node.id, { data: { ...data, content: sanitized } });
      }
    }
  }, [userPromptValue, node.id, data, onUpdate]);

  const handleGenerateClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly || !canGenerate) return;
    onGenerateBranch?.(node.id);
  }, [canGenerate, node.id, onGenerateBranch, readOnly]);

  const handleAdoptClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    onAdoptBranch?.(node.id);
  }, [node.id, onAdoptBranch, readOnly]);

  const handleDiscardClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    onDiscardBranch?.(node.id);
  }, [node.id, onDiscardBranch, readOnly]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    if (onDelete) {
      onDelete(node.id);
    } else {
      onUpdate?.(node.id, { id: node.id, data: { ...data, _deleted: true } } as any);
    }
  }, [node.id, data, onUpdate, onDelete, readOnly]);

  const nodeStyles: React.CSSProperties = {
    position: 'absolute',
    left: node.position.x,
    top: node.position.y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    ...style,
  };

  const bodyHeight = `calc(100% - ${HEADER_H}px - ${FOOTER_H}px)`;

  return (
    <div
      ref={nodeRef}
      className={cn(
        'kiteframe-node kiteframe-experiment-node group',
        'rounded-lg shadow-sm transition-all duration-200',
        'hover:shadow-md cursor-move overflow-hidden',
        'border-2',
        node.selected ? 'ring-2 ring-purple-400 shadow-md' : '',
        node.hidden ? 'opacity-0 pointer-events-none' : '',
        className,
      )}
      style={{
        ...nodeStyles,
        backgroundColor: '#ffffff',
        borderColor: PURPLE.stroke,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => onClick?.(e, node)}
      onDoubleClick={handleDoubleClick}
      data-testid={`node-experiment-${node.id}`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3"
        style={{ 
          height: HEADER_H, 
          minHeight: HEADER_H,
          backgroundColor: PURPLE.header,
          borderBottom: `1px solid ${PURPLE.stroke}`,
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Mode selector */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!readOnly) setShowModeDropdown(!showModeDropdown);
              }}
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium py-1 px-2 rounded transition-colors",
                "text-purple-800 hover:bg-purple-200/50",
                readOnly ? "opacity-50 cursor-default" : ""
              )}
              data-testid="experiment-mode-select"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span className="truncate">{MODE_LABELS[mode]}</span>
              {!readOnly && <ChevronDown className="w-3.5 h-3.5 opacity-60" />}
            </button>
            
            {showModeDropdown && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setShowModeDropdown(false)} />
                <div className="absolute left-0 top-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 min-w-[140px]">
                  {(Object.keys(MODE_LABELS) as ExperimentMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModeSelect(m);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-gray-50",
                        m === mode ? "bg-purple-50 text-purple-700 font-medium" : "text-gray-700"
                      )}
                    >
                      {MODE_LABELS[m]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Delete button */}
        {!readOnly && (
          <button
            onClick={handleDeleteClick}
            className="p-1.5 rounded-md transition-colors text-purple-600 hover:text-red-500 hover:bg-red-100"
            title="Delete experiment"
            data-testid="experiment-delete-btn"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div
        className="flex flex-col gap-2 p-3 overflow-y-auto"
        style={{ height: bodyHeight }}
      >
        {/* For prompt mode: show text input */}
        {mode === 'prompt' ? (
          <div className="flex-1 min-h-0">
            <textarea
              ref={promptTextareaRef}
              value={userPromptValue}
              onChange={handlePromptChange}
              onBlur={handlePromptBlur}
              placeholder={modeConfig.placeholder}
              disabled={readOnly || isGenerating}
              className={cn(
                "w-full h-full text-sm border rounded-md px-3 py-2 resize-none outline-none transition-colors",
                "placeholder:text-gray-400 placeholder:italic",
                "bg-white border-purple-200 focus:border-purple-400 focus:ring-1 focus:ring-purple-200",
                (readOnly || isGenerating) ? "opacity-60 cursor-not-allowed" : ""
              )}
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              {userPromptValue.trim().length}/20 characters minimum
            </p>
          </div>
        ) : (
          /* For other modes: show predictive options */
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            {/* Header with refresh button */}
            {hasIncomingEdges && !optionsLoading && (
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                  Suggestions
                </span>
                {onRefreshOptions && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefreshOptions(node.id);
                    }}
                    disabled={readOnly || optionsLoading}
                    className={cn(
                      "p-1 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors",
                      optionsLoading ? "animate-spin" : ""
                    )}
                    title="Refresh suggestions"
                    data-testid="experiment-refresh-options-btn"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
            
            {/* Loading skeleton */}
            {optionsLoading ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-purple-600 italic mb-1">Exploring possibilities…</p>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-8 bg-gray-100 rounded-md w-full" />
                  </div>
                ))}
              </div>
            ) : optionsError ? (
              /* Error state */
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-xs text-red-600">{optionsError}</p>
                {onRefreshOptions && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefreshOptions(node.id);
                    }}
                    className="text-xs text-purple-600 hover:text-purple-700 underline"
                  >
                    Try refreshing
                  </button>
                )}
              </div>
            ) : predictiveOptions.length > 0 ? (
              /* Options list - scrollable area */
              <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
                {predictiveOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOptionSelect(option);
                    }}
                    disabled={readOnly || isGenerating}
                    className={cn(
                      "text-left px-2.5 py-2 text-xs rounded-md border transition-colors flex-shrink-0",
                      selectedOption?.id === option.id
                        ? "bg-purple-100 border-purple-400 text-purple-800"
                        : "bg-white border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50",
                      (readOnly || isGenerating) ? "opacity-50 cursor-not-allowed" : ""
                    )}
                    data-testid={`experiment-option-${option.id}`}
                  >
                    <span className="font-medium block">{option.label}</span>
                    {option.description && (
                      <span className="text-[10px] text-gray-500 line-clamp-1">{option.description}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : hasIncomingEdges ? (
              /* Empty state - connected but no suggestions */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-2">
                <p className="text-xs text-gray-500 italic">
                  No strong suggestions found at this point in the workflow.
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  Try switching mode or use Prompt mode.
                </p>
              </div>
            ) : (
              /* Not connected state */
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic">
                Connect to a workflow node to see suggestions
              </div>
            )}

            {/* Selected option display */}
            {selectedOption && (
              <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-md flex-shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-purple-800">{selectedOption.label}</p>
                    {selectedOption.description && (
                      <p className="text-xs text-purple-600 mt-0.5">{selectedOption.description}</p>
                    )}
                  </div>
                  {!readOnly && !isGenerating && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOption(null);
                      }}
                      className="p-0.5 text-purple-500 hover:text-purple-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Refinement textarea for non-prompt modes */}
            <div className="mt-auto">
              <label className="text-[10px] text-gray-500 mb-1 block font-medium uppercase tracking-wide">
                Refine (optional)
              </label>
              <textarea
                value={userPromptValue}
                onChange={handlePromptChange}
                onBlur={handlePromptBlur}
                placeholder="Add additional context or constraints..."
                disabled={readOnly || isGenerating}
                className={cn(
                  "w-full h-12 text-xs border rounded-md px-2 py-1.5 resize-none outline-none transition-colors",
                  "placeholder:text-gray-400",
                  "bg-white border-purple-200 focus:border-purple-400",
                  (readOnly || isGenerating) ? "opacity-50 cursor-not-allowed" : ""
                )}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {generationError && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2 py-1.5 rounded-md">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{generationError}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-3"
        style={{ 
          height: FOOTER_H, 
          minHeight: FOOTER_H,
          backgroundColor: PURPLE.header,
          borderTop: `1px solid ${PURPLE.stroke}`,
        }}
      >
        {/* Generate button */}
        <button
          onClick={handleGenerateClick}
          disabled={!canGenerate || readOnly}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
            canGenerate && !readOnly
              ? "bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
              : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
          )}
          title={
            !hasIncomingEdges ? "Connect to a workflow node first" :
            !hasContent ? (mode === 'prompt' ? "Enter at least 20 characters" : "Select an option") :
            isGenerating ? "Generating..." :
            hasGenerated ? "Branch already generated" :
            "Generate speculative branch"
          }
          data-testid="experiment-generate-btn"
        >
          {isGenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FlaskConical className="w-3.5 h-3.5" />
          )}
          <span>{isGenerating ? 'Generating...' : 'Generate'}</span>
        </button>

        {/* Adopt/Discard buttons (shown after generation) */}
        {hasGenerated && !readOnly && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdoptClick}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded-md hover:bg-green-600 shadow-sm transition-colors"
              title="Adopt branch - make it permanent"
              data-testid="experiment-adopt-btn"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Adopt</span>
            </button>
            <button
              onClick={handleDiscardClick}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white text-red-600 rounded-md hover:bg-red-50 border border-red-200 transition-colors"
              title="Discard branch"
              data-testid="experiment-discard-btn"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExperimentNode;
