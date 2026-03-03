import { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCanvasStore } from '../store/useCanvasStore';
import './CanvasSelector.css';

export default function CanvasSelector() {
  const file = useCanvasStore((s) => s.file);
  const currentCanvasId = useCanvasStore((s) => s.currentCanvasId);
  const setCurrentCanvas = useCanvasStore((s) => s.setCurrentCanvas);
  const addCanvas = useCanvasStore((s) => s.addCanvas);
  const removeCanvas = useCanvasStore((s) => s.removeCanvas);
  const renameCanvas = useCanvasStore((s) => s.renameCanvas);
  const saveViewport = useCanvasStore((s) => s.saveViewport);

  const { getViewport } = useReactFlow();

  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentCanvas = file.canvases[currentCanvasId];
  const canvasEntries = Object.entries(file.canvases);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSelect = useCallback(
    (id: string) => {
      saveViewport(getViewport());
      setCurrentCanvas(id);
      setOpen(false);
    },
    [setCurrentCanvas, saveViewport, getViewport]
  );

  const handleNewCanvas = useCallback(() => {
    const name = prompt('Canvas name:');
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '-');
    addCanvas(id, name);
    setCurrentCanvas(id);
    setOpen(false);
  }, [addCanvas, setCurrentCanvas]);

  const handleRename = useCallback(
    (id: string) => {
      if (renameDraft.trim()) {
        renameCanvas(id, renameDraft.trim());
      }
      setRenamingId(null);
    },
    [renameDraft, renameCanvas]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (canvasEntries.length <= 1) return;
      removeCanvas(id);
    },
    [canvasEntries.length, removeCanvas]
  );

  return (
    <div className="canvas-selector" ref={dropdownRef}>
      <button className="canvas-selector-btn" onClick={() => setOpen(!open)}>
        {currentCanvas?.name || 'Canvas'} ▾
      </button>
      {open && (
        <div className="canvas-selector-dropdown">
          {canvasEntries.map(([id, canvas]) => (
            <div
              key={id}
              className={`canvas-selector-item ${id === currentCanvasId ? 'active' : ''}`}
              onClick={() => handleSelect(id)}
            >
              {renamingId === id ? (
                <input
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={() => handleRename(id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  style={{ fontSize: '12px', width: '100px' }}
                />
              ) : (
                <span>{canvas.name}</span>
              )}
              <span className="canvas-selector-item-actions">
                <span
                  className="canvas-selector-item-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameDraft(canvas.name);
                    setRenamingId(id);
                  }}
                >
                  ✏
                </span>
                {canvasEntries.length > 1 && (
                  <span
                    className="canvas-selector-item-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(id);
                    }}
                  >
                    ✕
                  </span>
                )}
              </span>
            </div>
          ))}
          <div className="canvas-selector-new" onClick={handleNewCanvas}>
            + New Canvas
          </div>
        </div>
      )}
    </div>
  );
}
