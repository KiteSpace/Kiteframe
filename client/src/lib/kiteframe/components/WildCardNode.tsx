import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Zap, Check, Trash2, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import type { Node, WildCardNodeData, WildCardMode, Position } from '../types';
import { sanitizeText } from '../utils/validation';

const HEADER_H = 36;
const FOOTER_H = 40;

export interface WildCardNodeComponentProps {
  node: Node & { data: WildCardNodeData };
  onUpdate?: (nodeId: string, updates: Partial<Node>) => void;
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
}

const MODE_CONFIG: Record<WildCardMode, { label: string; placeholder: string; secondaryLabel?: string; secondaryPlaceholder?: string }> = {
  whatif: {
    label: 'Scenario',
    placeholder: 'What if users could...',
    secondaryLabel: 'Constraints',
    secondaryPlaceholder: 'Optional constraints or limitations',
  },
  risk: {
    label: 'Risk Description',
    placeholder: 'Describe a potential risk...',
    secondaryLabel: 'Impact / Mitigation',
    secondaryPlaceholder: 'Potential impact and how to mitigate',
  },
  enhancement: {
    label: 'Enhancement Idea',
    placeholder: 'Describe an improvement...',
    secondaryLabel: 'Success Metric',
    secondaryPlaceholder: 'How will we measure success?',
  },
  prompt: {
    label: 'Instruction',
    placeholder: 'Enter your prompt...',
  },
};

const MODE_LABELS: Record<WildCardMode, string> = {
  whatif: 'What If',
  risk: 'Risk',
  enhancement: 'Enhancement',
  prompt: 'Prompt',
};

export const WildCardNode: React.FC<WildCardNodeComponentProps> = ({
  node,
  onUpdate,
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
}) => {
  const [editContentValue, setEditContentValue] = useState(node.data.content || '');
  const [editSecondaryValue, setEditSecondaryValue] = useState('');
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const nodeRef = useRef<HTMLDivElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const secondaryTextareaRef = useRef<HTMLTextAreaElement>(null);

  const mode: WildCardMode = node.data.mode || 'whatif';
  const modeConfig = MODE_CONFIG[mode];
  const isGenerating = node.data.generating === true || node.data.isGenerating === true;
  const hasGeneratedBranch = node.data.hasGeneratedBranch === true || (node.data.generatedIds && node.data.generatedIds.length > 0);
  const generationError = node.data.generationError;
  
  const contentLength = (editContentValue || node.data.content || '').trim().length;
  const hasMinContent = contentLength >= 20;
  const hasIncomingEdges = (node.data.incomingEdgesCount || 0) > 0;
  const canGenerate = hasMinContent && !isGenerating && !hasGeneratedBranch && hasIncomingEdges;

  useEffect(() => {
    setEditContentValue(node.data.content || '');
    const secondary = mode === 'whatif' ? node.data.constraints :
                      mode === 'risk' ? (node.data.impact || node.data.mitigation) :
                      mode === 'enhancement' ? node.data.metric : '';
    setEditSecondaryValue(secondary || '');
  }, [node.data.content, node.data.constraints, node.data.impact, node.data.mitigation, node.data.metric, mode]);

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

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContentValue(e.target.value);
  }, []);

  const handleContentBlur = useCallback(() => {
    setIsFocused(false);
    const sanitized = sanitizeText(editContentValue.trim());
    if (sanitized !== node.data.content) {
      onUpdate?.(node.id, { data: { ...node.data, content: sanitized } });
    }
  }, [editContentValue, node.id, node.data, onUpdate]);

  const handleSecondaryChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditSecondaryValue(e.target.value);
  }, []);

  const handleSecondaryBlur = useCallback(() => {
    const sanitized = sanitizeText(editSecondaryValue.trim());
    const field = mode === 'whatif' ? 'constraints' :
                  mode === 'risk' ? 'mitigation' :
                  mode === 'enhancement' ? 'metric' : null;
    if (field && sanitized !== node.data[field as keyof WildCardNodeData]) {
      onUpdate?.(node.id, { data: { ...node.data, [field]: sanitized } });
    }
  }, [editSecondaryValue, mode, node.id, node.data, onUpdate]);

  const handleModeSelect = useCallback((newMode: WildCardMode) => {
    setShowModeDropdown(false);
    if (readOnly) return;
    if (newMode !== mode) {
      onUpdate?.(node.id, {
        data: {
          ...node.data,
          mode: newMode,
          label: MODE_LABELS[newMode],
        }
      });
    }
  }, [mode, node.id, node.data, onUpdate, readOnly]);

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

  const nodeWidth = node.style?.width || node.width || 300;
  const nodeHeight = node.style?.height || node.height || 300;

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
        'kiteframe-node group',
        'rounded-lg shadow-sm transition-all duration-200',
        'hover:shadow-md cursor-move overflow-hidden',
        'border-2 border-dashed border-gray-300',
        'bg-white',
        node.selected ? 'ring-2 ring-blue-500 shadow-md' : '',
        node.hidden ? 'opacity-0 pointer-events-none' : '',
        className,
      )}
      style={{
        ...nodeStyles,
        width: 300,
        height: 300,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => onClick?.(e, node)}
      onDoubleClick={handleDoubleClick}
      data-testid={`node-wildcard-${node.id}`}
    >
      {/* Header - Mode Dropdown Only */}
      <div
        className="flex items-center px-3 border-b border-gray-200"
        style={{ 
          height: HEADER_H,
          minHeight: HEADER_H,
        }}
      >
        <div className="relative flex-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!readOnly) setShowModeDropdown(!showModeDropdown);
            }}
            className={cn(
              "flex items-center gap-2 text-sm font-medium text-gray-700 py-1 px-2 rounded transition-colors w-full",
              readOnly ? "opacity-50 cursor-default" : "hover:bg-gray-100"
            )}
            data-testid="wildcard-mode-select"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>{MODE_LABELS[mode]}</span>
            {!readOnly && <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          
          {showModeDropdown && (
            <>
              <div 
                className="fixed inset-0 z-50" 
                onClick={() => setShowModeDropdown(false)} 
              />
              <div className="absolute left-0 top-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 min-w-[140px]">
                {(Object.keys(MODE_LABELS) as WildCardMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleModeSelect(m);
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-gray-50",
                      m === mode ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"
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

      {/* Body - Content Area */}
      <div
        className="flex flex-col gap-2 p-3 overflow-hidden"
        style={{ 
          height: bodyHeight,
        }}
      >
        {/* Main content field */}
        <div className="flex-1 min-h-0">
          <textarea
            ref={contentTextareaRef}
            value={editContentValue}
            onChange={handleContentChange}
            onBlur={handleContentBlur}
            onFocus={() => setIsFocused(true)}
            placeholder={modeConfig.placeholder}
            disabled={readOnly}
            className={cn(
              "w-full h-full text-sm bg-gray-50 border border-gray-200 rounded-md px-3 py-2 resize-none outline-none transition-colors",
              "placeholder:text-gray-400 placeholder:italic",
              isFocused ? "border-blue-400 ring-1 ring-blue-100" : "",
              readOnly ? "opacity-60 cursor-not-allowed" : ""
            )}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Secondary field (if applicable) */}
        {modeConfig.secondaryLabel && (
          <div className="flex-shrink-0">
            <label className="text-[10px] text-gray-500 mb-1 block font-medium uppercase tracking-wide">
              {modeConfig.secondaryLabel}
            </label>
            <textarea
              ref={secondaryTextareaRef}
              value={editSecondaryValue}
              onChange={handleSecondaryChange}
              onBlur={handleSecondaryBlur}
              placeholder={modeConfig.secondaryPlaceholder}
              disabled={readOnly}
              className={cn(
                "w-full h-10 text-xs bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 resize-none outline-none transition-colors",
                "placeholder:text-gray-400 placeholder:italic",
                "focus:border-blue-400 focus:ring-1 focus:ring-blue-100",
                readOnly ? "opacity-60 cursor-not-allowed" : ""
              )}
              onClick={(e) => e.stopPropagation()}
            />
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

      {/* Footer - Action Buttons */}
      <div
        className="flex items-center justify-between px-3 border-t border-gray-200 bg-gray-50"
        style={{ 
          height: FOOTER_H,
          minHeight: FOOTER_H,
        }}
      >
        {/* Left side - Generate button */}
        <button
          onClick={handleGenerateClick}
          disabled={!canGenerate || readOnly}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
            canGenerate && !readOnly
              ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300"
              : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
          )}
          title={
            !hasIncomingEdges ? "Connect an input node first to provide context" :
            !hasMinContent ? "Enter at least 20 characters" :
            isGenerating ? "Generating..." :
            hasGeneratedBranch ? "Branch already generated" :
            "Generate speculative branch"
          }
          data-testid="wildcard-generate-btn"
        >
          {isGenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          <span>{isGenerating ? 'Generating...' : 'Generate'}</span>
        </button>

        {/* Right side - Adopt/Discard buttons (shown after generation) */}
        {hasGeneratedBranch && !readOnly && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdoptClick}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-md hover:bg-green-200 border border-green-300 transition-colors"
              title="Adopt branch - make permanent"
              data-testid="wildcard-adopt-btn"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDiscardClick}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-md hover:bg-red-100 border border-red-200 transition-colors"
              title="Discard branch"
              data-testid="wildcard-discard-btn"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WildCardNode;
