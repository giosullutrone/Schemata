import { useCallback, useState, useRef, type KeyboardEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCanvasStore } from '../store/useCanvasStore';
import { saveToFileSystem, loadFromFileSystem, writeToHandle } from '../utils/fileIO';
import './Toolbar.css';

export default function Toolbar() {
  const { screenToFlowPosition } = useReactFlow();
  const file = useCanvasStore((s) => s.file);
  const addClassNode = useCanvasStore((s) => s.addClassNode);
  const loadFile = useCanvasStore((s) => s.loadFile);

  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(file.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleNewClass = useCallback(() => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    addClassNode(center.x - 100, center.y - 50);
  }, [screenToFlowPosition, addClassNode]);

  const handleSave = useCallback(async () => {
    const currentFile = useCanvasStore.getState().file;
    if (fileHandle) {
      await writeToHandle(fileHandle, currentFile);
    } else {
      const handle = await saveToFileSystem(currentFile);
      if (handle) setFileHandle(handle);
    }
  }, [fileHandle]);

  const handleLoad = useCallback(async () => {
    const result = await loadFromFileSystem();
    if (result) {
      loadFile(result.file);
      setFileHandle(result.handle);
    }
  }, [loadFile]);

  const commitName = useCallback(() => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (trimmed) {
      useCanvasStore.setState((state) => ({
        file: { ...state.file, name: trimmed },
      }));
    }
  }, [nameDraft]);

  const handleNameKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') commitName();
      if (e.key === 'Escape') setEditingName(false);
    },
    [commitName]
  );

  return (
    <div className="toolbar">
      {editingName ? (
        <input
          ref={nameInputRef}
          className="toolbar-project-name"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={handleNameKeyDown}
          autoFocus
        />
      ) : (
        <span
          className="toolbar-project-name"
          onDoubleClick={() => {
            setNameDraft(file.name);
            setEditingName(true);
          }}
        >
          {file.name}
        </span>
      )}

      <div className="toolbar-separator" />

      <button className="toolbar-btn" onClick={handleNewClass}>
        + New Class
      </button>

      <div className="toolbar-separator" />

      <button className="toolbar-btn" onClick={handleSave}>
        Save
      </button>
      <button className="toolbar-btn" onClick={handleLoad}>
        Load
      </button>
    </div>
  );
}
