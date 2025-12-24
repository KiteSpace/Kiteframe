import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FlaskConical, Check, Trash2, ChevronDown, Loader2, AlertCircle, X } from 'lucide-react';
import type { Node, ExperimentNodeData, ExperimentMode, ExperimentOption, WildCardNodeData } from '../types';
import { sanitizeText } from '../utils/validation';

const HEADER_H = 40;
const FOOTER_H = 44;

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
    }
  }, [mode, node.id, data, onUpdate, readOnly]);

  const handleOptionSelect = useCallback((option: ExperimentOption) => {
    if (readOnly) return;
    setSelectedOption(option);
    
    if (isExperimentNodeData(data)) {
      onUpdate?.(node.id, {
        data: {
          ...data,
          selectedOptionId: option.id,
          selectedOptionLabel: option.label,
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

  const nodeWidth = node.style?.width || node.width || 320;
  const nodeHeight = node.style?.height || node.height || 340;

  const nodeStyles: React.CSSProperties = {
    position: 'absolute',
    left: node.position.x,
    top: node.position.y,
    width: nodeWidth,
    height: nodeHeight,
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
        'border-2 border-dashed',
        isPreview ? 'border-amber-400 bg-amber-50/50' : 'border-gray-300 bg-white',
        node.selected ? 'ring-2 ring-blue-500 shadow-md' : '',
        node.hidden ? 'opacity-0 pointer-events-none' : '',
        className,
      )}
      style={{
        ...nodeStyles,
        width: 320,
        height: 340,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => onClick?.(e, node)}
      onDoubleClick={handleDoubleClick}
      data-testid={`node-experiment-${node.id}`}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 border-b",
          isPreview ? "bg-amber-100/80 border-amber-200" : "bg-gray-50 border-gray-200"
        )}
        style={{ height: HEADER_H, minHeight: HEADER_H }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Preview badge */}
          {isPreview && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-200 text-amber-800 rounded">
              Preview
            </span>
          )}
          
          {/* Mode selector */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!readOnly) setShowModeDropdown(!showModeDropdown);
              }}
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium py-1 px-2 rounded transition-colors",
                isPreview ? "text-amber-800 hover:bg-amber-200/50" : "text-gray-700 hover:bg-gray-100",
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
                        m === mode ? "bg-amber-50 text-amber-700 font-medium" : "text-gray-700"
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
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isPreview 
                ? "text-amber-600 hover:text-red-500 hover:bg-red-100" 
                : "text-gray-400 hover:text-red-500 hover:bg-red-50"
            )}
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
                isPreview 
                  ? "bg-white border-amber-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                  : "bg-gray-50 border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100",
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
            {predictiveOptions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {predictiveOptions.slice(0, 8).map((option) => (
                  <button
                    key={option.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOptionSelect(option);
                    }}
                    disabled={readOnly || isGenerating}
                    className={cn(
                      "px-2.5 py-1.5 text-xs rounded-full border transition-colors",
                      selectedOption?.id === option.id
                        ? "bg-amber-100 border-amber-400 text-amber-800 font-medium"
                        : "bg-white border-gray-200 text-gray-600 hover:border-amber-300 hover:bg-amber-50",
                      (readOnly || isGenerating) ? "opacity-50 cursor-not-allowed" : ""
                    )}
                    title={option.description}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic">
                Connect to a workflow node to see suggestions
              </div>
            )}

            {/* Selected option display */}
            {selectedOption && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-amber-800">{selectedOption.label}</p>
                    {selectedOption.description && (
                      <p className="text-xs text-amber-600 mt-0.5">{selectedOption.description}</p>
                    )}
                  </div>
                  {!readOnly && !isGenerating && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOption(null);
                      }}
                      className="p-0.5 text-amber-500 hover:text-amber-700"
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
                  isPreview 
                    ? "bg-white border-amber-200 focus:border-amber-400"
                    : "bg-gray-50 border-gray-200 focus:border-blue-400",
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
        className={cn(
          "flex items-center justify-between px-3 border-t",
          isPreview ? "bg-amber-100/50 border-amber-200" : "bg-gray-50 border-gray-200"
        )}
        style={{ height: FOOTER_H, minHeight: FOOTER_H }}
      >
        {/* Generate button */}
        <button
          onClick={handleGenerateClick}
          disabled={!canGenerate || readOnly}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
            canGenerate && !readOnly
              ? "bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
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
