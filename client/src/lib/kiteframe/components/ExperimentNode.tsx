import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FlaskConical, Check, Trash2, ChevronDown, Loader2, AlertCircle, X, RefreshCw, Compass } from 'lucide-react';
import type { Node, ExperimentNodeData, ExperimentMode, ExperimentOption } from '../types';
import { sanitizeText } from '../utils/validation';
import { useScrollIsolation } from '../hooks/useScrollIsolation';

const HEADER_H = 44;
const FOOTER_H = 48;
const NODE_HEIGHT = 360;
const NODE_WIDTH = 320;
const SIMPLIFIED_NODE_HEIGHT = 140;

// Purple theme colors for Explore (system-led, solution-oriented)
const PURPLE = {
  stroke: '#9333ea', // purple-600
  header: '#9333ea', // purple-600
  footer: '#9333ea', // purple-600
  body: '#faf5ff', // purple-50
  accent: '#a855f7', // purple-500
  dark: '#7c3aed', // purple-600 darker
};

// Dark grey theme colors for Experiment (user-led, divergent exploration)
const DARK_GREY = {
  stroke: '#312e34', // dark grey
  header: '#312e34', // dark grey
  footer: '#312e34', // dark grey
  body: '#f5f5f5', // light grey
  accent: '#4a4a4a', // medium grey
  dark: '#1f1f1f', // darker grey
};

export interface ExperimentNodeComponentProps {
  node: Node & { data: ExperimentNodeData };
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
  onGenerateBranch?: (nodeId: string, currentDescription?: string) => void;
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

const MODE_CONFIG: Record<ExperimentMode, { label: string; placeholder: string; helper: string }> = {
  whatif: {
    label: 'What If',
    placeholder: 'Select an edge case or enter a custom scenario...',
    helper: 'Explore alternatives or challenge assumptions',
  },
  enhancement: {
    label: 'Enhancement',
    placeholder: 'Select an optimization or describe an improvement...',
    helper: 'Explore how this could be improved',
  },
  open_exploration: {
    label: 'Open Exploration',
    placeholder: 'Enter your specific idea or instruction...',
    helper: 'Explore an idea without predefined framing',
  },
};

const MODE_LABELS: Record<ExperimentMode, string> = {
  whatif: 'What If',
  enhancement: 'Enhancement',
  open_exploration: 'Open Exploration',
};

function getGenerationStatus(data: ExperimentNodeData): 'idle' | 'generating' | 'generated' | 'error' {
  return data.generation?.status || 'idle';
}

function getGenerationError(data: ExperimentNodeData): string | undefined {
  return data.generation?.errorMessage;
}

function hasGeneratedContent(data: ExperimentNodeData): boolean {
  const gen = data.generation;
  return gen?.status === 'generated' && 
    ((gen.generatedNodeIds?.length || 0) > 0 || (gen.generatedEdgeIds?.length || 0) > 0);
}

function isPreviewMode(data: ExperimentNodeData): boolean {
  return data.ui?.preview ?? true;
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
  const bodyRef = useRef<HTMLDivElement>(null);
  
  // Prevent canvas zoom from intercepting scroll events on the body content
  useScrollIsolation(bodyRef);

  const data = node.data as ExperimentNodeData;
  // Coerce any legacy modes to valid ExperimentMode
  const rawMode = data.mode || 'whatif';
  const mode: ExperimentMode = (rawMode as string) === 'risk' ? 'whatif' : (rawMode as string) === 'prompt' ? 'open_exploration' : rawMode as ExperimentMode;
  const modeConfig = MODE_CONFIG[mode];
  
  // Determine if this is an Explore (system-led) or Experiment (user-led)
  const isExplore = data.origin === 'explore';
  // Use purple theme for Explore, dark grey for Experiment
  const theme = isExplore ? PURPLE : DARK_GREY;
  
  const generationStatus = getGenerationStatus(data);
  const isGenerating = generationStatus === 'generating';
  const hasGenerated = hasGeneratedContent(data);
  const generationError = getGenerationError(data);
  const isPreview = isPreviewMode(data);
  
  const hasIncomingEdges = incomingEdgesCount > 0;
  const hasContent = mode === 'open_exploration' 
    ? userPromptValue.trim().length >= 20
    : !!selectedOption;
  // Generate button is always available in full view (disabled when no content/edges, but visible)
  const canGenerate = hasContent && !isGenerating && !hasGenerated && hasIncomingEdges;
  
  // Determine current node height based on state
  const currentNodeHeight = hasGenerated ? SIMPLIFIED_NODE_HEIGHT : NODE_HEIGHT;

  // Track previous incoming edges count for auto-trigger
  const prevIncomingEdgesRef = useRef<number>(incomingEdgesCount);
  
  useEffect(() => {
    setUserPromptValue(data.userPrompt || '');
    if (data.selectedOptionId && data.selectedOptionLabel) {
      setSelectedOption({ 
        id: data.selectedOptionId, 
        label: data.selectedOptionLabel,
        description: data.selectedOptionDescription 
      });
    }
  }, [data]);
  
  // Auto-trigger AI suggestions when an edge is connected (not in prompt mode)
  useEffect(() => {
    const wasDisconnected = prevIncomingEdgesRef.current === 0;
    const isNowConnected = incomingEdgesCount > 0;
    prevIncomingEdgesRef.current = incomingEdgesCount;
    
    // Auto-trigger only when: edge just connected, not prompt mode, not already loading, no cached options
    if (wasDisconnected && isNowConnected && mode !== 'open_exploration' && !optionsLoading && predictiveOptions.length === 0) {
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
    const needsHeightUpdate = Math.abs(storedHeight - currentNodeHeight) > 2 || Math.abs(storedMeasuredHeight - currentNodeHeight) > 2;
    
    if (needsWidthUpdate || needsHeightUpdate) {
      onUpdate?.(node.id, {
        width: NODE_WIDTH,
        height: currentNodeHeight,
        measuredWidth: NODE_WIDTH,
        measuredHeight: currentNodeHeight,
      });
    }
  }, [node.id, node.width, node.height, node.measuredWidth, node.measuredHeight, onUpdate, currentNodeHeight]);

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
      
      if (newMode !== 'open_exploration' && hasIncomingEdges) {
        onGenerateOptionsForMode?.(node.id, newMode);
      }
    }
  }, [mode, node.id, data, onUpdate, readOnly, hasIncomingEdges, onGenerateOptionsForMode]);

  const handleOptionSelect = useCallback((option: ExperimentOption) => {
    if (readOnly) return;
    setSelectedOption(option);
    
    onUpdate?.(node.id, {
      data: {
        ...data,
        selectedOptionId: option.id,
        selectedOptionLabel: option.label,
        selectedOptionDescription: option.description,
      }
    });
  }, [node.id, data, onUpdate, readOnly]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserPromptValue(e.target.value);
  }, []);

  const handlePromptBlur = useCallback(() => {
    const sanitized = sanitizeText(userPromptValue.trim());
    if (sanitized !== data.userPrompt) {
      onUpdate?.(node.id, { data: { ...data, userPrompt: sanitized } });
    }
  }, [userPromptValue, node.id, data, onUpdate]);

  const handleGenerateClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly || !canGenerate) return;
    // Pass current local state to avoid race condition with async state updates
    const currentDescription = mode === 'open_exploration' 
      ? userPromptValue 
      : (selectedOption?.description || selectedOption?.label || '');
    onGenerateBranch?.(node.id, currentDescription);
  }, [canGenerate, node.id, onGenerateBranch, readOnly, mode, userPromptValue, selectedOption]);

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
    height: currentNodeHeight,
    ...style,
  };

  // In simplified view, no footer, so body takes remaining height after header
  const bodyHeight = hasGenerated 
    ? `calc(100% - ${HEADER_H}px)` 
    : `calc(100% - ${HEADER_H}px - ${FOOTER_H}px)`;
  
  // Get the selected content to display in simplified view
  const selectedContent = mode === 'open_exploration' 
    ? userPromptValue 
    : (selectedOption?.description || selectedOption?.label || '');

  return (
    <div
      ref={nodeRef}
      className={cn(
        'kiteframe-node kiteframe-experiment-node group',
        'rounded-lg shadow-sm transition-all duration-200',
        'hover:shadow-md cursor-move overflow-hidden',
        'border-2',
        node.selected ? (isExplore ? 'ring-2 ring-purple-400 shadow-md' : 'ring-2 ring-gray-400 shadow-md') : '',
        node.hidden ? 'opacity-0 pointer-events-none' : '',
        className,
      )}
      style={{
        ...nodeStyles,
        backgroundColor: theme.body,
        borderColor: theme.stroke,
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
          backgroundColor: theme.header,
          borderBottom: `1px solid ${theme.stroke}`,
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* For Explore: always show static "Explore" header - no mode switching */}
          {isExplore ? (
            <div className="flex items-center gap-1.5 text-sm font-medium py-1 px-2 text-white">
              <Compass className="w-3.5 h-3.5" />
              <span className="truncate">Explore</span>
            </div>
          ) : hasGenerated ? (
            /* Mode label (no dropdown) when generated for Experiment */
            <div className="flex items-center gap-1.5 text-sm font-medium py-1 px-2 text-white">
              <FlaskConical className="w-3.5 h-3.5" />
              <span className="truncate">{MODE_LABELS[mode]}</span>
            </div>
          ) : (
            /* Mode selector dropdown for Experiment */
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!readOnly) setShowModeDropdown(!showModeDropdown);
                }}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium py-1 px-2 rounded transition-colors",
                  "text-white hover:bg-white/20",
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
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 min-w-[160px]">
                    {(Object.keys(MODE_LABELS) as ExperimentMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleModeSelect(m);
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm hover:bg-gray-50",
                          m === mode ? "bg-gray-100 text-gray-800 font-medium" : "text-gray-700"
                        )}
                      >
                        <span className="font-medium">{MODE_LABELS[m]}</span>
                        <span className="block text-[10px] text-gray-500 mt-0.5">{MODE_CONFIG[m].helper}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Delete button - only show in full view */}
        {!readOnly && !hasGenerated && (
          <button
            onClick={handleDeleteClick}
            className="p-1.5 rounded-md transition-colors text-white/80 hover:text-red-300 hover:bg-white/10"
            title="Delete experiment"
            data-testid="experiment-delete-btn"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div
        ref={bodyRef}
        className="flex flex-col gap-2 p-3 overflow-y-auto"
        style={{ height: bodyHeight }}
      >
        {/* Simplified view when hasGenerated - show headline and description */}
        {hasGenerated ? (
          <div className="flex-1 flex flex-col">
            <p className="text-xs text-gray-500 font-medium mb-1">Selected:</p>
            <div className={cn(
              "flex-1 rounded-md p-3 overflow-y-auto",
              isExplore ? "bg-purple-50 border border-purple-200" : "bg-gray-100 border border-gray-200"
            )}>
              {selectedOption ? (
                <>
                  <p className={cn("text-sm font-medium", isExplore ? "text-purple-800" : "text-gray-800")}>{selectedOption.label}</p>
                  {selectedOption.description && (
                    <p className={cn("text-xs mt-1 leading-relaxed", isExplore ? "text-purple-600" : "text-gray-600")}>{selectedOption.description}</p>
                  )}
                </>
              ) : (
                <p className={cn("text-sm leading-relaxed", isExplore ? "text-purple-800" : "text-gray-800")}>
                  {userPromptValue || 'No content selected'}
                </p>
              )}
            </div>
          </div>
        ) : mode === 'open_exploration' ? (
          /* For open_exploration mode: show text input */
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
                isExplore 
                  ? "bg-white border-purple-200 focus:border-purple-400 focus:ring-1 focus:ring-purple-200"
                  : "bg-white border-gray-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-200",
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
                      "p-1 rounded transition-colors",
                      isExplore 
                        ? "text-gray-400 hover:text-purple-600 hover:bg-purple-50"
                        : "text-gray-400 hover:text-gray-700 hover:bg-gray-100",
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
                <p className={cn("text-xs italic mb-1", isExplore ? "text-purple-600" : "text-gray-600")}>Exploring possibilities…</p>
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
                    className={cn("text-xs underline", isExplore ? "text-purple-600 hover:text-purple-700" : "text-gray-600 hover:text-gray-700")}
                  >
                    Try refreshing
                  </button>
                )}
              </div>
            ) : predictiveOptions.length > 0 ? (
              /* Options list - scrollable area */
              <div 
                className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0"
              >
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
                        ? isExplore
                          ? "bg-purple-100 border-purple-400 text-purple-800"
                          : "bg-gray-200 border-gray-400 text-gray-800"
                        : isExplore
                          ? "bg-white border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50"
                          : "bg-white border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-gray-50",
                      (readOnly || isGenerating) ? "opacity-50 cursor-not-allowed" : ""
                    )}
                    data-testid={`experiment-option-${option.id}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{option.label}</span>
                      {isExplore && option.recommended && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-purple-500 text-white rounded">
                          Recommended
                        </span>
                      )}
                    </div>
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
              <div className={cn(
                "mt-2 p-2 rounded-md flex-shrink-0",
                isExplore 
                  ? "bg-purple-50 border border-purple-200" 
                  : "bg-gray-100 border border-gray-200"
              )}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className={cn(
                        "text-sm font-medium",
                        isExplore ? "text-purple-800" : "text-gray-800"
                      )}>
                        {selectedOption.label}
                      </p>
                      {isExplore && selectedOption.recommended && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-purple-500 text-white rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                    {selectedOption.description && (
                      <p className={cn(
                        "text-xs mt-0.5",
                        isExplore ? "text-purple-600" : "text-gray-600"
                      )}>
                        {selectedOption.description}
                      </p>
                    )}
                  </div>
                  {!readOnly && !isGenerating && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOption(null);
                      }}
                      className={cn(
                        "p-0.5",
                        isExplore ? "text-purple-500 hover:text-purple-700" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

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

      {/* Footer - only show in full view (not when hasGenerated) */}
      {!hasGenerated && (
        <div
          className="flex items-center justify-end px-3"
          style={{ 
            height: FOOTER_H, 
            minHeight: FOOTER_H,
            backgroundColor: theme.footer,
            borderTop: `1px solid ${theme.stroke}`,
          }}
        >
          {/* Generate button - always visible in full view */}
          <button
            onClick={handleGenerateClick}
            disabled={!canGenerate || readOnly}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              canGenerate && !readOnly
                ? isExplore 
                  ? "bg-white text-purple-700 hover:bg-purple-50 shadow-sm"
                  : "bg-white text-gray-700 hover:bg-gray-100 shadow-sm"
                : "bg-white/20 text-white/50 cursor-not-allowed"
            )}
            title={
              !hasIncomingEdges ? "Connect to a workflow node first" :
              !hasContent ? (mode === 'open_exploration' ? "Enter at least 20 characters" : "Select an option") :
              isGenerating ? "Generating..." :
              isExplore ? "Find solutions" : "Generate speculative branch"
            }
            data-testid="experiment-generate-btn"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isExplore ? (
              <Compass className="w-3.5 h-3.5" />
            ) : (
              <FlaskConical className="w-3.5 h-3.5" />
            )}
            <span>{isGenerating ? 'Generating...' : 'Generate'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExperimentNode;
