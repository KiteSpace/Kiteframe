import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FlaskConical, Compass, Check, X, ChevronDown, Loader2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import type { Node, WorkflowTool, ExperimentMode, ExperimentOption } from '../types';
import { sanitizeText } from '../utils/validation';
import { useScrollIsolation } from '../hooks/useScrollIsolation';

const TOOL_WIDTH = 320;
const TOOL_HEIGHT = 380;
const HEADER_H = 44;
const FOOTER_H = 52;

// Purple theme for Explore (system-led, solution-oriented)
const PURPLE = {
  stroke: '#9333ea',
  header: '#9333ea',
  footer: '#9333ea',
  body: '#faf5ff',
  accent: '#a855f7',
  dark: '#7c3aed',
};

// Dark grey theme for Experiment (user-led, divergent exploration)
const DARK_GREY = {
  stroke: '#312e34',
  header: '#312e34',
  footer: '#312e34',
  body: '#f5f5f5',
  accent: '#4a4a4a',
  dark: '#1f1f1f',
};

const MODE_CONFIG: Record<ExperimentMode, { label: string; placeholder: string; helper: string }> = {
  whatif: { 
    label: 'What If', 
    placeholder: 'Select an edge case or enter a custom scenario...',
    helper: 'Explore alternatives or challenge assumptions'
  },
  enhancement: { 
    label: 'Enhancement', 
    placeholder: 'Select an optimization or describe an improvement...',
    helper: 'Explore how this could be improved'
  },
  open_exploration: { 
    label: 'Open Exploration', 
    placeholder: 'Enter your specific idea or instruction...',
    helper: 'Explore an idea without predefined framing'
  },
};

// Helper to coerce legacy modes ('risk', 'prompt') to current equivalents
function coerceLegacyMode(mode: string | ExperimentMode): ExperimentMode {
  if (mode === 'risk') return 'whatif';
  if (mode === 'prompt') return 'open_exploration';
  return mode as ExperimentMode;
}

const MODE_LABELS: Record<ExperimentMode, string> = {
  whatif: 'What If',
  enhancement: 'Enhancement',
  open_exploration: 'Open Exploration',
};

export interface ExperimentToolProps {
  tool: WorkflowTool;
  anchorNode: Node;
  viewport: { x: number; y: number; zoom: number };
  predictiveOptions?: ExperimentOption[];
  optionsLoading?: boolean;
  optionsError?: string | null;
  readOnly?: boolean;
  onUpdate: (toolId: string, updates: Partial<WorkflowTool>) => void;
  onGenerate: (toolId: string) => void;
  onAccept: (toolId: string) => void;
  onReject: (toolId: string) => void;
  onRefreshOptions?: (toolId: string) => void;
  onGenerateOptionsForMode?: (toolId: string, mode: ExperimentMode) => void;
}

export function ExperimentTool({
  tool,
  anchorNode,
  viewport,
  predictiveOptions = [],
  optionsLoading = false,
  optionsError = null,
  readOnly = false,
  onUpdate,
  onGenerate,
  onAccept,
  onReject,
  onRefreshOptions,
  onGenerateOptionsForMode,
}: ExperimentToolProps) {
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [userPromptValue, setUserPromptValue] = useState(tool.userPrompt || '');
  const [selectedOption, setSelectedOption] = useState<ExperimentOption | null>(
    tool.selectedOption ? { id: tool.selectedOption.id, label: tool.selectedOption.label, description: tool.selectedOption.description } : null
  );
  
  // Drag state for making the panel moveable
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const bodyRef = useRef<HTMLDivElement>(null);
  useScrollIsolation(bodyRef);
  
  // Handle drag start on header - skip if clicking on interactive elements
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    
    // Skip drag if clicking on an interactive element (button, input, etc.)
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button') || 
                          target.closest('input') || 
                          target.closest('select') ||
                          target.closest('[role="button"]') ||
                          target.closest('[data-testid*="select"]') ||
                          target.closest('[data-testid*="mode"]');
    if (isInteractive) return; // Let the click pass through to the button
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: dragOffset.x,
      offsetY: dragOffset.y,
    };
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;
      setDragOffset({
        x: dragStartRef.current.offsetX + dx,
        y: dragStartRef.current.offsetY + dy,
      });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dragOffset]);

  // Coerce legacy modes ('risk' -> 'whatif', 'prompt' -> 'open_exploration')
  const mode = coerceLegacyMode(tool.mode);
  const modeConfig = MODE_CONFIG[mode];
  const isGenerating = tool.state === 'generating';
  const hasGenerated = tool.state === 'preview' && tool.generated && (tool.generated.nodeIds.length > 0 || tool.generated.edgeIds.length > 0);
  
  // Explore vs Experiment: origin determines theming and behavior
  // Explore = purple theme, Experiment = dark grey theme
  const isExplore = tool.origin === 'explore';
  const theme = isExplore ? PURPLE : DARK_GREY;

  // For Explore: can generate as soon as options arrive (auto-selects recommended)
  // For Experiment: requires manual option selection or 20+ char prompt
  const hasContent = isExplore
    ? !!selectedOption || predictiveOptions.length > 0  // Explore can use any option
    : mode === 'open_exploration' 
      ? userPromptValue.trim().length >= 20
      : !!selectedOption;
  const canGenerate = hasContent && !isGenerating && !hasGenerated;

  useEffect(() => {
    setUserPromptValue(tool.userPrompt || '');
    if (tool.selectedOption) {
      setSelectedOption({ id: tool.selectedOption.id, label: tool.selectedOption.label, description: tool.selectedOption.description });
    }
  }, [tool.userPrompt, tool.selectedOption]);

  useEffect(() => {
    // For both Explore and Experiment: trigger options generation if none exist
    if (mode !== 'open_exploration' && !optionsLoading && predictiveOptions.length === 0) {
      onGenerateOptionsForMode?.(tool.id, mode);
    }
  }, [mode, optionsLoading, predictiveOptions.length, tool.id, onGenerateOptionsForMode]);
  
  // For Explore: auto-select the recommended option when options arrive
  useEffect(() => {
    if (isExplore && predictiveOptions.length > 0 && !selectedOption) {
      const recommended = predictiveOptions.find(o => o.recommended) || predictiveOptions[0];
      if (recommended) {
        setSelectedOption(recommended);
        onUpdate(tool.id, { 
          selectedOption: { id: recommended.id, label: recommended.label, description: recommended.description } 
        });
      }
    }
  }, [isExplore, predictiveOptions, selectedOption, tool.id, onUpdate]);

  const anchorWidth = anchorNode.width || anchorNode.measuredWidth || 200;
  const toolLeft = anchorNode.position.x + anchorWidth + 24;
  const toolTop = anchorNode.position.y;
  const screenX = (toolLeft * viewport.zoom) + viewport.x;
  const screenY = (toolTop * viewport.zoom) + viewport.y;

  const handleModeSelect = useCallback((newMode: ExperimentMode) => {
    setShowModeDropdown(false);
    if (readOnly || newMode === mode) return;
    setSelectedOption(null);
    setUserPromptValue('');
    onUpdate(tool.id, { mode: newMode, selectedOption: undefined, userPrompt: '' });
    if (newMode !== 'open_exploration') {
      onGenerateOptionsForMode?.(tool.id, newMode);
    }
  }, [mode, tool.id, onUpdate, readOnly, onGenerateOptionsForMode]);

  const handleOptionSelect = useCallback((option: ExperimentOption) => {
    if (readOnly) return;
    setSelectedOption(option);
    onUpdate(tool.id, { selectedOption: { id: option.id, label: option.label, description: option.description } });
  }, [tool.id, onUpdate, readOnly]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserPromptValue(e.target.value);
  }, []);

  const handlePromptBlur = useCallback(() => {
    const sanitized = sanitizeText(userPromptValue.trim());
    if (sanitized !== tool.userPrompt) {
      onUpdate(tool.id, { userPrompt: sanitized });
    }
  }, [userPromptValue, tool.id, tool.userPrompt, onUpdate]);

  const handleGenerateClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly || !canGenerate) return;
    onGenerate(tool.id);
  }, [canGenerate, tool.id, onGenerate, readOnly]);

  const handleAcceptClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    onAccept(tool.id);
  }, [tool.id, onAccept, readOnly]);

  const handleRejectClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    onReject(tool.id);
  }, [tool.id, onReject, readOnly]);

  const bodyHeight = hasGenerated 
    ? `calc(100% - ${HEADER_H}px)` 
    : `calc(100% - ${HEADER_H}px - ${FOOTER_H}px)`;

  return (
    <div
      className={cn(
        'fixed rounded-lg shadow-lg overflow-hidden border-2 pointer-events-auto',
        'transition-transform duration-100'
      )}
      style={{
        left: screenX + dragOffset.x,
        top: screenY + dragOffset.y,
        width: TOOL_WIDTH,
        height: hasGenerated ? 160 : TOOL_HEIGHT,
        backgroundColor: theme.body,
        borderColor: theme.stroke,
        zIndex: 1000,
        cursor: isDragging ? 'grabbing' : undefined,
      }}
      data-testid={`experiment-tool-${tool.id}`}
    >
      {/* Header - draggable */}
      <div
        className="flex items-center justify-between px-3 cursor-grab active:cursor-grabbing"
        style={{ height: HEADER_H, backgroundColor: theme.header, borderBottom: `1px solid ${theme.stroke}` }}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isExplore ? (
            /* Explore: Static header with Compass icon, no mode selector */
            <div className="flex items-center gap-1.5 text-sm font-medium py-1 px-2 text-white">
              <Compass className="w-3.5 h-3.5" />
              <span className="truncate">Explore</span>
            </div>
          ) : hasGenerated ? (
            <div className="flex items-center gap-1.5 text-sm font-medium py-1 px-2 text-white">
              <FlaskConical className="w-3.5 h-3.5" />
              <span className="truncate">{MODE_LABELS[mode]}</span>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); if (!readOnly) setShowModeDropdown(!showModeDropdown); }}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium py-1 px-2 rounded transition-colors",
                  "text-white hover:bg-white/20",
                  readOnly ? "opacity-50 cursor-default" : ""
                )}
                data-testid="experiment-tool-mode-select"
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
                        onClick={(e) => { e.stopPropagation(); handleModeSelect(m); }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm hover:bg-gray-50",
                          m === mode ? "bg-purple-50 text-purple-700 font-medium" : "text-gray-700"
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

        {!readOnly && !hasGenerated && (
          <button
            onClick={handleRejectClick}
            className="p-1.5 rounded-md transition-colors text-white/80 hover:text-red-300 hover:bg-white/10"
            title="Close experiment"
            data-testid="experiment-tool-close-btn"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div ref={bodyRef} className="flex flex-col gap-2 p-3 overflow-y-auto" style={{ height: bodyHeight }}>
        {hasGenerated ? (
          <div className="flex-1 flex flex-col">
            <p className="text-xs text-gray-500 font-medium mb-1">Preview Generated:</p>
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
                <p className={cn("text-sm leading-relaxed", isExplore ? "text-purple-800" : "text-gray-800")}>{userPromptValue || 'Generated branch'}</p>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAcceptClick}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                data-testid="experiment-tool-accept-btn"
              >
                <Check className="w-4 h-4" />
                Accept
              </button>
              <button
                onClick={handleRejectClick}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium"
                data-testid="experiment-tool-reject-btn"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </div>
          </div>
        ) : mode === 'open_exploration' ? (
          <div className="flex-1 min-h-0">
            <textarea
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
            <p className="text-[10px] text-gray-400 mt-1">{userPromptValue.trim().length}/20 characters minimum</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            {!optionsLoading && (
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Suggestions</span>
                {onRefreshOptions && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRefreshOptions(tool.id); }}
                    disabled={readOnly || optionsLoading}
                    className={cn(
                      "p-1 rounded transition-colors",
                      isExplore 
                        ? "text-gray-400 hover:text-purple-600 hover:bg-purple-50"
                        : "text-gray-400 hover:text-gray-700 hover:bg-gray-100",
                      optionsLoading ? "animate-spin" : ""
                    )}
                    title="Refresh suggestions"
                    data-testid="experiment-tool-refresh-options-btn"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
            
            {optionsLoading ? (
              <div className="flex flex-col gap-2">
                <p className={cn("text-xs italic mb-1", isExplore ? "text-purple-600" : "text-gray-600")}>
                  Exploring possibilities…
                </p>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse"><div className="h-8 bg-gray-100 rounded-md w-full" /></div>
                ))}
              </div>
            ) : optionsError ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-xs text-red-600">{optionsError}</p>
                {onRefreshOptions && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRefreshOptions(tool.id); }} 
                    className={cn("text-xs underline", isExplore ? "text-purple-600 hover:text-purple-700" : "text-gray-600 hover:text-gray-700")}
                  >
                    Try refreshing
                  </button>
                )}
              </div>
            ) : predictiveOptions.length > 0 ? (
              <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0">
                {predictiveOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={(e) => { e.stopPropagation(); handleOptionSelect(option); }}
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
                    data-testid={`experiment-tool-option-${option.id}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{option.label}</span>
                      {isExplore && option.recommended && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-purple-500 text-white rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                    {option.description && <span className="text-[10px] text-gray-500 line-clamp-1">{option.description}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-2">
                <p className="text-xs text-gray-500 italic">
                  {isExplore ? 'No solutions found.' : 'No suggestions available. Try switching mode or use Prompt mode.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer - only in non-generated state */}
      {!hasGenerated && (
        <div
          className="flex items-center justify-end px-3 gap-2"
          style={{ height: FOOTER_H, backgroundColor: theme.footer, borderTop: `1px solid ${theme.stroke}` }}
        >
          <button
            onClick={handleGenerateClick}
            disabled={!canGenerate || readOnly}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              canGenerate && !readOnly
                ? isExplore
                  ? "bg-white text-purple-700 hover:bg-purple-50"
                  : "bg-white text-gray-700 hover:bg-gray-100"
                : isExplore
                  ? "bg-white/50 text-purple-400 cursor-not-allowed"
                  : "bg-white/50 text-gray-400 cursor-not-allowed"
            )}
            data-testid="experiment-tool-generate-btn"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4" />Generate</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
