import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from './useCanvasStore';

describe('Undo/Redo', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  it('should undo adding a node', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(1);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(0);
  });

  it('should redo after undo', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(0);

    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(1);
  });

  it('should clear redo stack on new action', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    useCanvasStore.getState().undo();
    useCanvasStore.getState().addClassNode(100, 100);

    useCanvasStore.getState().redo(); // should do nothing
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(1);
  });

  it('should not fail on undo with empty history', () => {
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(0);
  });
});
