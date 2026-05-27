import { useState } from 'react';
import { Maximize2, Info, X } from 'lucide-react';

interface MobileViewBarProps {
  onFitView: () => void;
}

export function MobileViewBar({ onFitView }: MobileViewBarProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      {/* Floating pill at bottom-centre */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none flex flex-col items-center gap-2">
        <div className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full shadow-2xl border border-border bg-background/95 backdrop-blur-md text-foreground">
          {/* Fit-view button */}
          <button
            onClick={onFitView}
            title="Fit view"
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Maximize2 size={16} />
          </button>

          <div className="w-px h-4 bg-border" />

          {/* Read Only label */}
          <span className="text-xs font-medium text-muted-foreground">Read Only</span>

          {/* Info button */}
          <button
            onClick={() => setShowInfo(true)}
            title="Why read only?"
            className="w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Info size={13} />
          </button>
        </div>
      </div>

      {/* Info overlay */}
      {showInfo && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center pb-28 px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-sm bg-background border border-border rounded-2xl shadow-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-foreground leading-relaxed">
                Workflow editing is not supported on this screen size. Rotate your device or open on a larger screen to edit.
              </p>
              <button
                onClick={() => setShowInfo(false)}
                className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
