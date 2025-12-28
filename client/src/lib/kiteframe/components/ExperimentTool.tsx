import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FlaskConical, Check, X, ChevronDown, Loader2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import type { Node, WorkflowTool, ExperimentMode, ExperimentOption } from '../types';
import { sanitizeText } from '../utils/validation';
import { useScrollIsolation } from '../hooks/useScrollIsolation';

const TOOL_WIDTH = 320;
const TOOL_HEIGHT = 380;
const HEADER_H = 44;
const FOOTER_H = 52;

const PURPLE = {
  stroke: '#9333ea',
  header: '#9333ea',
  footer: '#9333ea',
  body: '#faf5ff',
  accent: '#a855f7',
  dark: '#7c3aed',
};

const MODE_CONFIG: Record<ExperimentMode, { label: string; placeholder: string }> = {
  whatif: { label: 'What If', placeholder: 'Select an edge case or enter a custom scenario...' },
  risk: { label: 'Risk', placeholder: 'Select a failure mode or describe a risk...' },
  enhancement: { label: 'Enhancement', placeholder: 'Select an optimization or describe an improvement...' },
  prompt: { label: 'Prompt', placeholder: 'Enter your specific idea or instruction...' },
};

const MODE_LABELS: Record<ExperimentMode, string> = {
  whatif: 'What If',
  risk: 'Risk',
  enhancement: 'Enhancement',
  prompt: 'Prompt',
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

  const bodyRef = useRef<HTMLDivElement>(null);
  useScrollIsolation(bodyRef);

  const mode = tool.mode;
  const modeConfig = MODE_CONFIG[mode];
  const isGenerating = tool.state === 'generating';
  const hasGenerated = tool.state === 'preview' && tool.generated && (tool.generated.nodeIds.length > 0 || tool.generated.edgeIds.length > 0);

  const hasContent = mode === 'prompt' 
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
    if (mode !== 'prompt' && !optionsLoading && predictiveOptions.length === 0) {
      onGenerateOptionsForMode?.(tool.id, mode);
    }
  }, [mode, optionsLoading, predictiveOptions.length, tool.id, onGenerateOptionsForMode]);

  const anchorWidth = anchorNode.width || anchorNode.measuredWidth || 200;
  const toolLeft = anchorNode.position.x + anchorWidth + 24;
  const toolTop = anchorNode.position.y;
  const screenX = (toolLeft * viewport.zoom) + viewport.x;
  const screenY = (toolTop * viewport.zoom) + viewport.y;
  const scaledWidth = TOOL_WIDTH * viewport.zoom;
  const scaledHeight = (hasGenerated ? 160 : TOOL_HEIGHT) * viewport.zoom;

  const handleModeSelect = useCallback((newMode: ExperimentMode) => {
    setShowModeDropdown(false);
    if (readOnly || newMode === mode) return;
    setSelectedOption(null);
    setUserPromptValue('');
    onUpdate(tool.id, { mode: newMode, selectedOption: undefined, userPrompt: '' });
    if (newMode !== 'prompt') {
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
        left: screenX,
        top: screenY,
        width: scaledWidth,
        height: scaledHeight,
        backgroundColor: PURPLE.body,
        borderColor: PURPLE.stroke,
        zIndex: 1000,
        transform: `scale(${Math.max(0.5, Math.min(1, viewport.zoom))})`,
        transformOrigin: 'top left',
      }}
      data-testid={`experiment-tool-${tool.id}`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3"
        style={{ height: HEADER_H, backgroundColor: PURPLE.header, borderBottom: `1px solid ${PURPLE.stroke}` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {hasGenerated ? (
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
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 min-w-[140px]">
                    {(Object.keys(MODE_LABELS) as ExperimentMode[]).filter(m => m !== 'prompt').map((m) => (
                      <button
                        key={m}
                        onClick={(e) => { e.stopPropagation(); handleModeSelect(m); }}
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
            <div className="flex-1 bg-purple-50 border border-purple-200 rounded-md p-3 overflow-y-auto">
              {selectedOption ? (
                <>
                  <p className="text-sm font-medium text-purple-800">{selectedOption.label}</p>
                  {selectedOption.description && (
                    <p className="text-xs text-purple-600 mt-1 leading-relaxed">{selectedOption.description}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-purple-800 leading-relaxed">{userPromptValue || 'Generated branch'}</p>
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
        ) : mode === 'prompt' ? (
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
                "bg-white border-purple-200 focus:border-purple-400 focus:ring-1 focus:ring-purple-200",
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
                    className={cn("p-1 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors", optionsLoading ? "animate-spin" : "")}
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
                <p className="text-xs text-purple-600 italic mb-1">Exploring possibilities…</p>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse"><div className="h-8 bg-gray-100 rounded-md w-full" /></div>
                ))}
              </div>
            ) : optionsError ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-xs text-red-600">{optionsError}</p>
                {onRefreshOptions && (
                  <button onClick={(e) => { e.stopPropagation(); onRefreshOptions(tool.id); }} className="text-xs text-purple-600 hover:text-purple-700 underline">
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
                        ? "bg-purple-100 border-purple-400 text-purple-800"
                        : "bg-white border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50",
                      (readOnly || isGenerating) ? "opacity-50 cursor-not-allowed" : ""
                    )}
                    data-testid={`experiment-tool-option-${option.id}`}
                  >
                    <span className="font-medium block">{option.label}</span>
                    {option.description && <span className="text-[10px] text-gray-500 line-clamp-1">{option.description}</span>}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-2">
                <p className="text-xs text-gray-500 italic">No suggestions available. Try switching mode or use Prompt mode.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer - only in non-generated state */}
      {!hasGenerated && (
        <div
          className="flex items-center justify-end px-3 gap-2"
          style={{ height: FOOTER_H, backgroundColor: PURPLE.footer, borderTop: `1px solid ${PURPLE.stroke}` }}
        >
          <button
            onClick={handleGenerateClick}
            disabled={!canGenerate || readOnly}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              canGenerate && !readOnly
                ? "bg-white text-purple-700 hover:bg-purple-50"
                : "bg-white/50 text-purple-400 cursor-not-allowed"
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
