import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RefObject } from 'react';

// ── Mocks ────────────────────────────────────────────────────────────────

let mockSelectedCount = 0;
vi.mock('@xyflow/react', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useStore: (selector: (s: any) => number) => {
    const nodes = Array.from({ length: mockSelectedCount }, () => ({ selected: true }));
    return selector({ nodes });
  },
}));

const roState = { callback: null as ResizeObserverCallback | null };

class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    roState.callback = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {
    roState.callback = null;
  }
}

class MockMutationObserver {
  constructor() {}
  observe() {}
  disconnect() {}
}

// ── Helpers ──────────────────────────────────────────────────────────────

function ref<T>(value: T): RefObject<T> {
  return { current: value };
}

function makeEl(scrollHeight: number, clientHeight: number): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  return el;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('useScrollBlockOnSelect', () => {
  beforeEach(() => {
    mockSelectedCount = 0;
    roState.callback = null;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.stubGlobal('MutationObserver', MockMutationObserver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderScrollHook(
    containerEl: HTMLElement | null,
    scrollableEls: HTMLElement | null | (HTMLElement | null)[],
    selected: boolean | undefined,
  ) {
    const containerRef = ref(containerEl);
    const scrollableRefs = Array.isArray(scrollableEls)
      ? scrollableEls.map((el) => ref(el))
      : ref(scrollableEls);

    // Dynamic import after mocks are set up
    const { useScrollBlockOnSelect } = await import('./useScrollBlockOnSelect');
    return renderHook(() => useScrollBlockOnSelect(containerRef, scrollableRefs, selected));
  }

  it('returns false when selected is false', async () => {
    mockSelectedCount = 1;
    const { result } = await renderScrollHook(
      document.createElement('div'),
      makeEl(200, 100),
      false,
    );
    expect(result.current).toBe(false);
  });

  it('returns false when selected is undefined', async () => {
    mockSelectedCount = 1;
    const { result } = await renderScrollHook(
      document.createElement('div'),
      makeEl(200, 100),
      undefined,
    );
    expect(result.current).toBe(false);
  });

  it('returns false when multiple nodes are selected', async () => {
    mockSelectedCount = 2;
    const { result } = await renderScrollHook(
      document.createElement('div'),
      makeEl(200, 100),
      true,
    );
    expect(result.current).toBe(false);
  });

  it('returns false when scrollable has no overflow', async () => {
    mockSelectedCount = 1;
    const { result } = await renderScrollHook(
      document.createElement('div'),
      makeEl(100, 100),
      true,
    );
    expect(result.current).toBe(false);
  });

  it('returns true when sole selected node has overflow', async () => {
    mockSelectedCount = 1;
    const { result } = await renderScrollHook(
      document.createElement('div'),
      makeEl(200, 100),
      true,
    );
    expect(result.current).toBe(true);
  });

  it('returns false when scrollable ref is null', async () => {
    mockSelectedCount = 1;
    const { result } = await renderScrollHook(
      document.createElement('div'),
      null,
      true,
    );
    expect(result.current).toBe(false);
  });

  it('returns true if any ref in array overflows', async () => {
    mockSelectedCount = 1;
    const { result } = await renderScrollHook(
      document.createElement('div'),
      [makeEl(50, 100), makeEl(200, 100)],
      true,
    );
    expect(result.current).toBe(true);
  });

  it('returns false if no ref in array overflows', async () => {
    mockSelectedCount = 1;
    const { result } = await renderScrollHook(
      document.createElement('div'),
      [makeEl(50, 100), makeEl(80, 100)],
      true,
    );
    expect(result.current).toBe(false);
  });

  it('prevents default on wheel over non-scrollable area', async () => {
    mockSelectedCount = 1;
    const container = document.createElement('div');
    const scrollable = makeEl(200, 100);
    container.appendChild(scrollable);
    document.body.appendChild(container);

    await renderScrollHook(container, scrollable, true);

    // Wheel on the container itself (not inside scrollable child)
    const wheelEvent = new WheelEvent('wheel', { bubbles: true, cancelable: true });
    Object.defineProperty(wheelEvent, 'target', { value: container });
    container.dispatchEvent(wheelEvent);
    expect(wheelEvent.defaultPrevented).toBe(true);

    document.body.removeChild(container);
  });

  it('does not prevent default on wheel inside scrollable area', async () => {
    mockSelectedCount = 1;
    const container = document.createElement('div');
    const scrollable = makeEl(200, 100);
    container.appendChild(scrollable);
    document.body.appendChild(container);

    await renderScrollHook(container, scrollable, true);

    // Wheel inside the scrollable child
    const wheelEvent = new WheelEvent('wheel', { bubbles: true, cancelable: true });
    scrollable.dispatchEvent(wheelEvent);
    expect(wheelEvent.defaultPrevented).toBe(false);

    document.body.removeChild(container);
  });
});
