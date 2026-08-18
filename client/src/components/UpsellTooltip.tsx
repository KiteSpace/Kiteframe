import { useState, useRef, useCallback, type ReactNode } from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';
import { useLocation } from 'wouter';

interface UpsellTooltipProps {
  children: ReactNode;
  featureName?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
}

/**
 * Wraps any element and shows a hover tooltip with an upgrade CTA card
 * when the user hovers over a feature that requires an Advanced plan.
 *
 * Set `disabled={true}` (or omit) to suppress the tooltip for users who
 * already have access.
 *
 * Usage:
 *   <UpsellTooltip featureName="wireframe mockups" disabled={canUseWireframe}>
 *     <button>Wireframe</button>
 *   </UpsellTooltip>
 */
export function UpsellTooltip({
  children,
  featureName = 'this feature',
  side = 'bottom',
  disabled = false,
}: UpsellTooltipProps) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const showTimer = useRef<ReturnType<typeof setTimeout>>();
  const [, navigate] = useLocation();

  const scheduleShow = useCallback(() => {
    if (disabled) return;
    clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => setVisible(true), 350);
  }, [disabled]);

  const scheduleHide = useCallback(() => {
    clearTimeout(showTimer.current);
    // Small delay so mouse can travel from trigger to tooltip without it closing
    hideTimer.current = setTimeout(() => setVisible(false), 120);
  }, []);

  const cancelHide = useCallback(() => {
    clearTimeout(hideTimer.current);
  }, []);

  if (disabled) return <>{children}</>;

  const positionClasses: Record<NonNullable<UpsellTooltipProps['side']>, string> = {
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<NonNullable<UpsellTooltipProps['side']>, string> = {
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[6px] border-x-[5px] border-t-0 border-x-transparent border-b-blue-600',
    top: 'top-full left-1/2 -translate-x-1/2 border-t-[6px] border-x-[5px] border-b-0 border-x-transparent border-t-slate-700/80',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-[6px] border-y-[5px] border-r-0 border-y-transparent border-l-slate-700/80',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-[6px] border-y-[5px] border-l-0 border-y-transparent border-r-slate-700/80',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={scheduleShow}
      onMouseLeave={scheduleHide}
    >
      {children}

      {visible && (
        <div
          className={`absolute z-[9999] w-52 ${positionClasses[side]}`}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          {/* Arrow */}
          <div className={`absolute w-0 h-0 ${arrowClasses[side]}`} />

          {/* Card */}
          <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
            {/* Header row */}
            <div className="px-3 py-2 bg-popover border-b border-border">
              <p className="text-[11px] text-foreground leading-snug">
                Upgrade to{' '}
                <span className="font-semibold text-blue-600 dark:text-blue-400">Advanced</span>{' '}
                to use {featureName}
              </p>
            </div>

            {/* Gradient upgrade card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 text-white">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles size={12} />
                <span className="text-[11px] font-semibold">Advanced plan</span>
                <span className="ml-auto text-[10px] opacity-75 bg-white/20 rounded px-1.5 py-0.5">
                  $6/mo
                </span>
              </div>
              <p className="text-[11px] opacity-80 mb-2.5 leading-snug">
                2× daily credits · wireframes · PRD export · and more.
              </p>
              <button
                className="w-full py-1.5 rounded-md bg-white/20 hover:bg-white/30 active:bg-white/40 border border-white/40 text-white text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  setVisible(false);
                  navigate('/pricing');
                }}
              >
                <TrendingUp size={11} />
                Upgrade plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
