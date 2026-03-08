import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from './useCanvasStore';

const TEST_FILE_PATH = 'test.schemata.json';

function setupTestFile() {
  useCanvasStore.setState({
    files: {
      [TEST_FILE_PATH]: {
        version: '1.0',
        name: 'Untitled Project',
        nodes: [],
        edges: [],
      },
    },
    activeFilePath: TEST_FILE_PATH,
    lastSavedFiles: {},
  });
}

function getFile() {
  return useCanvasStore.getState().files[TEST_FILE_PATH];
}

describe('Undo/Redo', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
    setupTestFile();
  });

  it('should undo adding a node', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    expect(getFile()!.nodes).toHaveLength(1);

    useCanvasStore.getState().undo();
    expect(getFile()!.nodes).toHaveLength(0);
  });

  it('should redo after undo', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    useCanvasStore.getState().undo();
    expect(getFile()!.nodes).toHaveLength(0);

    useCanvasStore.getState().redo();
    expect(getFile()!.nodes).toHaveLength(1);
  });

  it('should clear redo stack on new action', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    useCanvasStore.getState().undo();
    useCanvasStore.getState().addClassNode(100, 100);

    useCanvasStore.getState().redo(); // should do nothing
    expect(getFile()!.nodes).toHaveLength(1);
  });

  it('should not fail on undo with empty history', () => {
    useCanvasStore.getState().undo();
    expect(getFile()!.nodes).toHaveLength(0);
  });

  it('should tag undo entries with file path', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    const entry = useCanvasStore.getState()._undoStack[0];
    expect(entry.filePath).toBe(TEST_FILE_PATH);
    expect(entry.snapshot).toBeDefined();
    expect(entry.snapshot.nodes).toHaveLength(0);
  });

  it('should cap undo stack at 100 entries', () => {
    for (let i = 0; i < 110; i++) {
      useCanvasStore.getState().addClassNode(i, 0);
    }
    expect(useCanvasStore.getState()._undoStack.length).toBeLessThanOrEqual(100);
  });

  it('should undo to the correct file in a multi-file setup', () => {
    const FILE_A = 'a.schemata.json';
    const FILE_B = 'b.schemata.json';
    useCanvasStore.setState({
      files: {
        [FILE_A]: { version: '1.0', name: 'A', nodes: [], edges: [] },
        [FILE_B]: { version: '1.0', name: 'B', nodes: [], edges: [] },
      },
      activeFilePath: FILE_A,
      _undoStack: [],
      _redoStack: [],
    });

    // Add node to file A
    useCanvasStore.getState().addClassNode(0, 0);
    expect(useCanvasStore.getState().files[FILE_A].nodes).toHaveLength(1);

    // Switch to file B, add node
    useCanvasStore.getState().setActiveFile(FILE_B);
    useCanvasStore.getState().addClassNode(100, 0);
    expect(useCanvasStore.getState().files[FILE_B].nodes).toHaveLength(1);

    // Undo should restore file B (last action)
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().files[FILE_B].nodes).toHaveLength(0);
    // File A should be unchanged
    expect(useCanvasStore.getState().files[FILE_A].nodes).toHaveLength(1);

    // Undo again should restore file A
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().files[FILE_A].nodes).toHaveLength(0);
  });
});
