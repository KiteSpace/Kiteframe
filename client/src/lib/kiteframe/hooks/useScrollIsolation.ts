import { useEffect, RefObject } from 'react';

/**
 * Hook to isolate scroll events within a container, preventing
 * canvas zoom from intercepting wheel events on scrollable content.
 * 
 * This works by:
 * 1. Adding a data attribute that the canvas wheel handler checks for
 * 2. Optionally adding a native wheel listener for extra protection
 * 
 * @param ref - React ref to the scrollable container element
 * @param options - Configuration options
 */
export function useScrollIsolation(
  ref: RefObject<HTMLElement>,
  options: {
    enabled?: boolean;
    /** Whether to also add a native wheel listener that stops propagation */
    useNativeListener?: boolean;
  } = {}
) {
  const { enabled = true, useNativeListener = true } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    // Add the data attribute that the canvas wheel handler checks for
    element.setAttribute('data-table-scrollable', 'true');

    // Optionally add a native wheel listener for extra protection
    let cleanup: (() => void) | undefined;
    
    if (useNativeListener) {
      const handleWheel = (e: WheelEvent) => {
        // Only stop propagation if the element can actually scroll
        const canScrollVertically = element.scrollHeight > element.clientHeight;
        const canScrollHorizontally = element.scrollWidth > element.clientWidth;
        
        if (!canScrollVertically && !canScrollHorizontally) {
          return; // Let canvas handle it if we can't scroll
        }

        // Check if we're at scroll boundaries
        const atTop = element.scrollTop === 0;
        const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight;
        const atLeft = element.scrollLeft === 0;
        const atRight = element.scrollLeft + element.clientWidth >= element.scrollWidth;

        // If scrolling up and at top, or scrolling down and at bottom, let canvas handle it
        const scrollingUp = e.deltaY < 0;
        const scrollingDown = e.deltaY > 0;
        const scrollingLeft = e.deltaX < 0;
        const scrollingRight = e.deltaX > 0;

        // For vertical scrolling
        if (canScrollVertically) {
          if (scrollingUp && atTop) return;
          if (scrollingDown && atBottom) return;
        }

        // For horizontal scrolling  
        if (canScrollHorizontally) {
          if (scrollingLeft && atLeft) return;
          if (scrollingRight && atRight) return;
        }

        // We can scroll in this direction, stop propagation
        e.stopPropagation();
      };

      element.addEventListener('wheel', handleWheel, { passive: true });
      cleanup = () => element.removeEventListener('wheel', handleWheel);
    }

    return () => {
      element.removeAttribute('data-table-scrollable');
      cleanup?.();
    };
  }, [ref, enabled, useNativeListener]);
}
