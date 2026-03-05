import { useState, useEffect, type RefObject } from 'react';
import { useStore } from '@xyflow/react';

type ScrollableRefs = RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[];

function toArray(refs: ScrollableRefs): RefObject<HTMLElement | null>[] {
  return Array.isArray(refs) ? refs : [refs];
}

/**
 * Blocks canvas panning on a selected node so its content can be scrolled.
 * Also prevents wheel events from reaching the window (no page bounce).
 *
 * Conditions: sole selected node + any scrollable container has overflow.
 */
export function useScrollBlockOnSelect(
  containerRef: RefObject<HTMLElement | null>,
  scrollableRefs: ScrollableRefs,
  selected: boolean | undefined,
): boolean {
  const selectedNodeCount = useStore((s) => {
    let count = 0;
    for (const n of s.nodes) {
      if (n.selected) {
        count++;
        if (count > 1) return 2;
      }
    }
    return count;
  });

  const refs = toArray(scrollableRefs);
  const [hasOverflow, setHasOverflow] = useState(false);

  // Observe resize + mutation on all scrollable elements.
  // Re-runs when the component re-renders (content/ref changes).
  // React Flow memoizes nodes, so this only fires on prop changes.
  useEffect(() => {
    const elements = refs.map((r) => r.current).filter(Boolean) as HTMLElement[];
    if (elements.length === 0) {
      setHasOverflow(false);
      return;
    }
    const check = () => {
      const overflow = elements.some((el) => el.scrollHeight > el.clientHeight);
      setHasOverflow(overflow);
    };
    check();
    const ro = new ResizeObserver(check);
    const mo = new MutationObserver(check);
    for (const el of elements) {
      ro.observe(el);
      mo.observe(el, { childList: true, subtree: true });
    }
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  });

  const shouldBlock = !!selected && selectedNodeCount === 1 && hasOverflow;

  // Prevent wheel events from scrolling the window when pan is blocked.
  // For areas inside scrollable children, CSS overscroll-behavior: contain
  // handles boundary cases. For non-scrollable areas (header, etc.),
  // we preventDefault to stop the page from moving.
  useEffect(() => {
    if (!shouldBlock) return;
    const container = containerRef.current;
    if (!container) return;

    const handler = (e: WheelEvent) => {
      for (const ref of refs) {
        const el = ref.current;
        if (el && el.contains(e.target as Node)) return;
      }
      e.preventDefault();
    };

    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, [shouldBlock, containerRef, refs]);

  return shouldBlock;
}
