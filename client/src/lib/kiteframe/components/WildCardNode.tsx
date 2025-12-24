import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Zap, Check, X, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import type { Node, WildCardNodeData, WildCardMode, Position } from '../types';
import { sanitizeText } from '../utils/validation';

const HEADER_H = 32;

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
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabelValue, setEditLabelValue] = useState(node.data.label || 'What If');
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editContentValue, setEditContentValue] = useState(node.data.content || '');
  const [isEditingSecondary, setIsEditingSecondary] = useState(false);
  const [editSecondaryValue, setEditSecondaryValue] = useState('');
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  const nodeRef = useRef<HTMLDivElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const secondaryTextareaRef = useRef<HTMLTextAreaElement>(null);

  const mode: WildCardMode = node.data.mode || 'whatif';
  const modeConfig = MODE_CONFIG[mode];
  const isSpeculative = node.meta?.speculative === true;
  const isGenerating = node.data.generating === true;
  const hasGeneratedBranch = node.data.hasGeneratedBranch === true;
  const generationError = node.data.generationError;
  const canGenerate = mode === 'whatif' && (editContentValue || node.data.content || '').length >= 20;

  useEffect(() => {
    setEditContentValue(node.data.content || '');
    const secondary = mode === 'whatif' ? node.data.constraints :
                      mode === 'risk' ? (node.data.impact || node.data.mitigation) :
                      mode === 'enhancement' ? node.data.metric : '';
    setEditSecondaryValue(secondary || '');
  }, [node.data.content, node.data.constraints, node.data.impact, node.data.mitigation, node.data.metric, mode]);

  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [isEditingLabel]);

  useEffect(() => {
    if (isEditingContent && contentTextareaRef.current) {
      contentTextareaRef.current.focus();
    }
  }, [isEditingContent]);

  useEffect(() => {
    if (isEditingSecondary && secondaryTextareaRef.current) {
      secondaryTextareaRef.current.focus();
    }
  }, [isEditingSecondary]);

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

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    setEditLabelValue(node.data.label || 'What If');
    setIsEditingLabel(true);
  }, [node.data.label, readOnly]);

  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditLabelValue(e.target.value);
  }, []);

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false);
    const sanitized = sanitizeText(editLabelValue.trim()) || 'What If';
    if (sanitized !== node.data.label) {
      onUpdate?.(node.id, { data: { ...node.data, label: sanitized } });
    }
  }, [editLabelValue, node.id, node.data, onUpdate]);

  const handleLabelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLabelBlur();
    } else if (e.key === 'Escape') {
      setEditLabelValue(node.data.label || 'What If');
      setIsEditingLabel(false);
    }
  }, [handleLabelBlur, node.data.label]);

  const handleContentClick = useCallback(() => {
    if (readOnly) return;
    setIsEditingContent(true);
  }, [readOnly]);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContentValue(e.target.value);
  }, []);

  const handleContentBlur = useCallback(() => {
    setIsEditingContent(false);
    const sanitized = sanitizeText(editContentValue.trim());
    if (sanitized !== node.data.content) {
      onUpdate?.(node.id, { data: { ...node.data, content: sanitized } });
    }
  }, [editContentValue, node.id, node.data, onUpdate]);

  const handleSecondaryClick = useCallback(() => {
    if (readOnly) return;
    setIsEditingSecondary(true);
  }, [readOnly]);

  const handleSecondaryChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditSecondaryValue(e.target.value);
  }, []);

  const handleSecondaryBlur = useCallback(() => {
    setIsEditingSecondary(false);
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
    if (readOnly) return;
    if (canGenerate && !isGenerating && !hasGeneratedBranch) {
      onGenerateBranch?.(node.id);
    }
  }, [canGenerate, isGenerating, hasGeneratedBranch, node.id, onGenerateBranch, readOnly]);

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

  const nodeWidth = node.style?.width || node.width || 260;
  const nodeHeight = node.style?.height || node.height || 160;

  const headerBg = node.data.colors?.headerBackground || '#8b5cf6';
  const bodyBg = node.data.colors?.bodyBackground || '#faf5ff';
  const headerTextColor = node.data.colors?.headerTextColor || '#ffffff';

  const nodeStyles: React.CSSProperties = {
    position: 'absolute',
    left: node.position.x,
    top: node.position.y,
    width: nodeWidth,
    height: nodeHeight,
    ...style,
  };

  return (
    <div
      ref={nodeRef}
      className={cn(
        'kiteframe-node group',
        'rounded-lg shadow-md transition-all duration-200',
        'hover:shadow-lg cursor-move overflow-hidden',
        node.selected ? 'ring-2 ring-purple-500 shadow-lg' : '',
        node.hidden ? 'opacity-0 pointer-events-none' : '',
        isSpeculative ? 'border-2 border-dashed border-purple-400' : 'border-2 border-purple-300',
        className,
      )}
      style={nodeStyles}
      onMouseDown={handleMouseDown}
      onClick={(e) => onClick?.(e, node)}
      onDoubleClick={handleDoubleClick}
      data-testid={`node-wildcard-${node.id}`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-2 gap-1"
        style={{ 
          backgroundColor: headerBg, 
          color: headerTextColor,
          height: HEADER_H,
          minHeight: HEADER_H,
        }}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
          
          {isEditingLabel ? (
            <input
              ref={labelInputRef}
              type="text"
              value={editLabelValue}
              onChange={handleLabelChange}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              className="flex-1 min-w-0 bg-white/20 text-white text-sm font-medium px-1 rounded outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="text-sm font-medium truncate cursor-text"
              onDoubleClick={handleLabelDoubleClick}
            >
              {node.data.label || 'What If'}
            </span>
          )}

          {isSpeculative && (
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
              Speculative
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Mode dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!readOnly) setShowModeDropdown(!showModeDropdown);
              }}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-colors",
                readOnly ? "opacity-50 cursor-default" : "hover:bg-white/20"
              )}
              data-testid="wildcard-mode-select"
            >
              {MODE_LABELS[mode]}
              {!readOnly && <ChevronDown className="w-3 h-3" />}
            </button>
            
            {showModeDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-50" 
                  onClick={() => setShowModeDropdown(false)} 
                />
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 min-w-[100px]">
                  {(Object.keys(MODE_LABELS) as WildCardMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModeSelect(m);
                      }}
                      className={cn(
                        "w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700",
                        m === mode ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" : "text-gray-700 dark:text-gray-300"
                      )}
                    >
                      {MODE_LABELS[m]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Generate button (lightning bolt) */}
          <button
            onClick={handleGenerateClick}
            disabled={!canGenerate || isGenerating || hasGeneratedBranch || readOnly}
            className={cn(
              "p-1 rounded transition-colors",
              canGenerate && !isGenerating && !hasGeneratedBranch && !readOnly
                ? "hover:bg-white/20 text-yellow-300"
                : "opacity-40 cursor-not-allowed"
            )}
            title={
              !canGenerate ? "Enter at least 20 characters" :
              isGenerating ? "Generating..." :
              hasGeneratedBranch ? "Branch already generated" :
              "Generate speculative branch"
            }
            data-testid="wildcard-generate-btn"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        className="flex flex-col gap-2 p-2 overflow-hidden"
        style={{ 
          backgroundColor: bodyBg,
          height: `calc(100% - ${HEADER_H}px)`,
        }}
      >
        {/* Main content field */}
        <div className="flex-1 min-h-0">
          <label className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 block">
            {modeConfig.label}
          </label>
          {isEditingContent ? (
            <textarea
              ref={contentTextareaRef}
              value={editContentValue}
              onChange={handleContentChange}
              onBlur={handleContentBlur}
              placeholder={modeConfig.placeholder}
              className="w-full h-[calc(100%-16px)] text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 resize-none outline-none focus:ring-1 focus:ring-purple-400"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              onClick={handleContentClick}
              className={cn(
                "w-full h-[calc(100%-16px)] text-sm px-2 py-1 cursor-text rounded",
                node.data.content 
                  ? "text-gray-700 dark:text-gray-300" 
                  : "text-gray-400 dark:text-gray-500 italic"
              )}
            >
              {node.data.content || modeConfig.placeholder}
            </div>
          )}
        </div>

        {/* Secondary field (if applicable) */}
        {modeConfig.secondaryLabel && (
          <div className="flex-shrink-0">
            <label className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 block">
              {modeConfig.secondaryLabel}
            </label>
            {isEditingSecondary ? (
              <textarea
                ref={secondaryTextareaRef}
                value={editSecondaryValue}
                onChange={handleSecondaryChange}
                onBlur={handleSecondaryBlur}
                placeholder={modeConfig.secondaryPlaceholder}
                className="w-full h-12 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 resize-none outline-none focus:ring-1 focus:ring-purple-400"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                onClick={handleSecondaryClick}
                className={cn(
                  "w-full text-xs px-2 py-1 cursor-text rounded min-h-[24px]",
                  editSecondaryValue 
                    ? "text-gray-600 dark:text-gray-400" 
                    : "text-gray-400 dark:text-gray-500 italic"
                )}
              >
                {editSecondaryValue || modeConfig.secondaryPlaceholder}
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {generationError && (
          <div className="flex items-center gap-1 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
            <AlertCircle className="w-3 h-3" />
            <span className="truncate">{generationError}</span>
          </div>
        )}

        {/* Adopt/Discard buttons (shown after generation) */}
        {hasGeneratedBranch && !readOnly && (
          <div className="flex items-center gap-2 pt-1 border-t border-purple-200 dark:border-purple-700">
            <span className="text-[10px] text-purple-600 dark:text-purple-400 flex-1">
              Branch generated
            </span>
            <button
              onClick={handleAdoptClick}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
              data-testid="wildcard-adopt-btn"
            >
              <Check className="w-3 h-3" />
              Adopt
            </button>
            <button
              onClick={handleDiscardClick}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              data-testid="wildcard-discard-btn"
            >
              <X className="w-3 h-3" />
              Discard
            </button>
          </div>
        )}
      </div>

      {/* Node handles are rendered by the canvas, not the node component */}
    </div>
  );
};

export default WildCardNode;
