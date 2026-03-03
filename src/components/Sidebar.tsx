import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCanvasStore } from '../store/useCanvasStore';
import { saveToFileSystem, loadFromFileSystem, writeToHandle } from '../utils/fileIO';
import './Sidebar.css';

const COLORS = ['#4A90D9', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#34495E', '#E67E22'];

function getNodeDisplayName(node: { type?: string; data: Record<string, unknown> }): string {
  if (node.type === 'classNode') return (node.data.name as string) || 'Class';
  if (node.type === 'annotationNode') return (node.data.comment as string) || 'Comment';
  if (node.type === 'groupNode') return (node.data.label as string) || 'Group';
  return 'Node';
}

function getNodeBadge(type?: string): { label: string; className: string } {
  if (type === 'classNode') return { label: 'C', className: 'class' };
  if (type === 'annotationNode') return { label: 'A', className: 'annotation' };
  if (type === 'groupNode') return { label: 'G', className: 'group' };
  return { label: '?', className: '' };
}

export default function Sidebar() {
  const file = useCanvasStore((s) => s.file);
  const currentCanvasId = useCanvasStore((s) => s.currentCanvasId);
  const sidebarOpen = useCanvasStore((s) => s.sidebarOpen);
  const setSidebarOpen = useCanvasStore((s) => s.setSidebarOpen);
  const setCurrentCanvas = useCanvasStore((s) => s.setCurrentCanvas);
  const addCanvas = useCanvasStore((s) => s.addCanvas);
  const removeCanvas = useCanvasStore((s) => s.removeCanvas);
  const renameCanvas = useCanvasStore((s) => s.renameCanvas);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const moveNodeToCanvas = useCanvasStore((s) => s.moveNodeToCanvas);
  const reorderCanvases = useCanvasStore((s) => s.reorderCanvases);
  const fileHandle = useCanvasStore((s) => s.fileHandle);
  const setFileHandle = useCanvasStore((s) => s.setFileHandle);
  const loadFile = useCanvasStore((s) => s.loadFile);
  const saveViewport = useCanvasStore((s) => s.saveViewport);

  const { getViewport, setCenter, setNodes } = useReactFlow();

  // --- Project name editing ---
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(file.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);

  const commitName = useCallback(() => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== file.name) {
      useCanvasStore.setState((state) => ({
        file: { ...state.file, name: trimmed },
      }));
    }
  }, [nameDraft, file.name]);

  // --- New canvas inline creation ---
  const [creatingCanvas, setCreatingCanvas] = useState(false);
  const [newCanvasDraft, setNewCanvasDraft] = useState('');
  const newCanvasInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingCanvas && newCanvasInputRef.current) newCanvasInputRef.current.focus();
  }, [creatingCanvas]);

  const commitNewCanvas = useCallback(() => {
    setCreatingCanvas(false);
    const name = newCanvasDraft.trim();
    if (!name) return;
    let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const canvases = useCanvasStore.getState().file.canvases;
    let suffix = 1;
    const baseId = id;
    while (canvases[id]) {
      id = `${baseId}-${suffix++}`;
    }
    addCanvas(id, name);
    saveViewport(getViewport());
    setCurrentCanvas(id);
    setNewCanvasDraft('');
  }, [newCanvasDraft, addCanvas, setCurrentCanvas, saveViewport, getViewport]);

  // --- Canvas renaming ---
  const [renamingCanvasId, setRenamingCanvasId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingCanvasId && renameInputRef.current) renameInputRef.current.focus();
  }, [renamingCanvasId]);

  const commitRename = useCallback(() => {
    if (renamingCanvasId && renameDraft.trim()) {
      renameCanvas(renamingCanvasId, renameDraft.trim());
    }
    setRenamingCanvasId(null);
  }, [renamingCanvasId, renameDraft, renameCanvas]);

  // --- File operations ---
  const handleSave = useCallback(async () => {
    try {
      const currentFile = useCanvasStore.getState().file;
      if (fileHandle) {
        await writeToHandle(fileHandle, currentFile);
      } else {
        const handle = await saveToFileSystem(currentFile);
        if (handle) setFileHandle(handle);
      }
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        console.error('Save failed:', err);
      }
    }
  }, [fileHandle, setFileHandle]);

  const handleLoad = useCallback(async () => {
    try {
      const result = await loadFromFileSystem();
      if (result) {
        loadFile(result.file);
        setFileHandle(result.handle);
      }
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        console.error('Load failed:', err);
      }
    }
  }, [loadFile, setFileHandle]);

  // --- Canvas switching ---
  const handleCanvasClick = useCallback(
    (id: string) => {
      if (id === currentCanvasId) return;
      saveViewport(getViewport());
      setCurrentCanvas(id);
    },
    [currentCanvasId, setCurrentCanvas, saveViewport, getViewport]
  );

  // --- Node click: pan + select ---
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const canvas = useCanvasStore.getState().file.canvases[currentCanvasId];
      if (!canvas) return;
      const node = canvas.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      // Pan to node center (approximate 200x150 for measured size)
      setCenter(node.position.x + 100, node.position.y + 75, { duration: 300 });
      // Select only this node
      setNodes((nodes) =>
        nodes.map((n) => ({ ...n, selected: n.id === nodeId }))
      );
    },
    [currentCanvasId, setCenter, setNodes]
  );

  // --- Sidebar context menu ---
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    kind: 'canvas' | 'node';
    canvasId: string;
    nodeId?: string;
    nodeType?: string;
  } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ctxMenu]);

  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent, canvasId: string) => {
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'canvas', canvasId });
    },
    []
  );

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, canvasId: string, nodeId: string, nodeType?: string) => {
      e.preventDefault();
      e.stopPropagation();
      setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'node', canvasId, nodeId, nodeType });
    },
    []
  );

  // --- DnD state ---
  const [dragType, setDragType] = useState<'canvas' | 'node' | null>(null);
  const [dragCanvasId, setDragCanvasId] = useState<string | null>(null);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dropTargetCanvasId, setDropTargetCanvasId] = useState<string | null>(null);
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null);

  const canvasIds = Object.keys(file.canvases);

  // Canvas drag
  const handleCanvasDragStart = useCallback(
    (e: React.DragEvent, canvasId: string) => {
      setDragType('canvas');
      setDragCanvasId(canvasId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', canvasId);
    },
    []
  );

  const handleCanvasDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      if (dragType !== 'canvas') {
        // Node being dragged over a canvas row
        if (dragType === 'node') {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropTargetCanvasId(canvasIds[index]);
          setDropInsertIndex(null);
        }
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setDropInsertIndex(e.clientY < midY ? index : index + 1);
      setDropTargetCanvasId(null);
    },
    [dragType, canvasIds]
  );

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (dragType === 'canvas' && dragCanvasId && dropInsertIndex !== null) {
        const newOrder = canvasIds.filter((id) => id !== dragCanvasId);
        const adjustedIndex = dropInsertIndex > canvasIds.indexOf(dragCanvasId)
          ? dropInsertIndex - 1
          : dropInsertIndex;
        newOrder.splice(adjustedIndex, 0, dragCanvasId);
        reorderCanvases(newOrder);
      }
      if (dragType === 'node' && dragNodeId && dropTargetCanvasId) {
        moveNodeToCanvas(dragNodeId, currentCanvasId, dropTargetCanvasId);
      }
      setDragType(null);
      setDragCanvasId(null);
      setDragNodeId(null);
      setDropTargetCanvasId(null);
      setDropInsertIndex(null);
    },
    [dragType, dragCanvasId, dragNodeId, dropInsertIndex, dropTargetCanvasId, canvasIds, reorderCanvases, moveNodeToCanvas, currentCanvasId]
  );

  const handleDragEnd = useCallback(() => {
    setDragType(null);
    setDragCanvasId(null);
    setDragNodeId(null);
    setDropTargetCanvasId(null);
    setDropInsertIndex(null);
  }, []);

  // Node drag
  const handleNodeDragStart = useCallback(
    (e: React.DragEvent, nodeId: string) => {
      e.stopPropagation();
      setDragType('node');
      setDragNodeId(nodeId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', nodeId);
    },
    []
  );

  // --- Render ---
  const currentCanvas = file.canvases[currentCanvasId];

  if (!sidebarOpen) {
    return (
      <button className="sidebar-toggle-tab" onClick={() => setSidebarOpen(true)} title="Open sidebar (Ctrl+B)">
        &#9776;
      </button>
    );
  }

  return (
    <>
      <div className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <button className="sidebar-header-toggle" onClick={() => setSidebarOpen(false)} title="Close sidebar (Ctrl+B)">
            &#9776;
          </button>
          {editingName ? (
            <input
              ref={nameInputRef}
              className="sidebar-project-name-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Enter') commitName();
                if (e.key === 'Escape') setEditingName(false);
              }}
            />
          ) : (
            <span
              className="sidebar-project-name"
              onDoubleClick={() => { setNameDraft(file.name); setEditingName(true); }}
              title={file.name}
            >
              {file.name}
            </span>
          )}
          <button className="sidebar-save-btn" onClick={handleSave} title="Save (Ctrl+S)">
            &#128190;
          </button>
        </div>

        {/* Action Row */}
        <div className="sidebar-actions">
          <button
            className="sidebar-action-btn"
            onClick={() => { setNewCanvasDraft(''); setCreatingCanvas(true); }}
          >
            + Canvas
          </button>
          <button className="sidebar-action-btn" onClick={handleLoad}>
            Open
          </button>
        </div>

        {/* Tree */}
        <div className="sidebar-tree">
          {creatingCanvas && (
            <div className="sidebar-canvas-row">
              <span className="sidebar-canvas-chevron">&#9654;</span>
              <input
                ref={newCanvasInputRef}
                className="sidebar-canvas-name-input"
                value={newCanvasDraft}
                placeholder="Canvas name..."
                onChange={(e) => setNewCanvasDraft(e.target.value)}
                onBlur={() => { if (newCanvasDraft.trim()) commitNewCanvas(); else setCreatingCanvas(false); }}
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter') commitNewCanvas();
                  if (e.key === 'Escape') setCreatingCanvas(false);
                }}
              />
            </div>
          )}
          {canvasIds.map((canvasId, index) => {
            const canvas = file.canvases[canvasId];
            const isActive = canvasId === currentCanvasId;
            const isDropTarget = dropTargetCanvasId === canvasId && dragType === 'node';

            return (
              <div key={canvasId}>
                {dropInsertIndex === index && dragType === 'canvas' && (
                  <div className="sidebar-drop-indicator" />
                )}
                <div
                  className={`sidebar-canvas-row${isActive ? ' active' : ''}${isDropTarget ? ' drag-over' : ''}`}
                  onClick={() => handleCanvasClick(canvasId)}
                  onContextMenu={(e) => handleCanvasContextMenu(e, canvasId)}
                  draggable
                  onDragStart={(e) => handleCanvasDragStart(e, canvasId)}
                  onDragOver={(e) => handleCanvasDragOver(e, index)}
                  onDrop={handleCanvasDrop}
                  onDragEnd={handleDragEnd}
                >
                  <span className="sidebar-canvas-chevron">{isActive ? '\u25BC' : '\u25B6'}</span>
                  {renamingCanvasId === canvasId ? (
                    <input
                      ref={renameInputRef}
                      className="sidebar-canvas-name-input"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e: KeyboardEvent) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setRenamingCanvasId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="sidebar-canvas-name">{canvas.name}</span>
                  )}
                </div>

                {/* Node children -- only for active canvas */}
                {isActive && currentCanvas && currentCanvas.nodes.map((node) => {
                  const badge = getNodeBadge(node.type);
                  return (
                    <div
                      key={node.id}
                      className="sidebar-node-row"
                      onClick={() => handleNodeClick(node.id)}
                      onContextMenu={(e) => handleNodeContextMenu(e, canvasId, node.id, node.type)}
                      draggable
                      onDragStart={(e) => handleNodeDragStart(e, node.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <span className="sidebar-node-name">{getNodeDisplayName(node)}</span>
                      <span className={`sidebar-node-badge ${badge.className}`}>{badge.label}</span>
                    </div>
                  );
                })}

                {/* Drop indicator after last canvas */}
                {dropInsertIndex === index + 1 && dragType === 'canvas' && index === canvasIds.length - 1 && (
                  <div className="sidebar-drop-indicator" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar context menu */}
      {ctxMenu && (
        <div
          className="sidebar-context-menu"
          ref={ctxMenuRef}
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {ctxMenu.kind === 'canvas' && (
            <>
              <div
                className="context-menu-item"
                onClick={() => {
                  setRenameDraft(file.canvases[ctxMenu.canvasId]?.name || '');
                  setRenamingCanvasId(ctxMenu.canvasId);
                  setCtxMenu(null);
                }}
              >
                Rename
              </div>
              {canvasIds.length > 1 && (
                <div
                  className="context-menu-item danger"
                  onClick={() => {
                    removeCanvas(ctxMenu.canvasId);
                    setCtxMenu(null);
                  }}
                >
                  Delete
                </div>
              )}
            </>
          )}
          {ctxMenu.kind === 'node' && ctxMenu.nodeId && (
            <>
              <div className="context-menu-color-row">
                {COLORS.map((color) => (
                  <div
                    key={color}
                    className="context-menu-color-swatch"
                    style={{ background: color }}
                    onClick={() => {
                      updateNodeData(ctxMenu.nodeId!, { color });
                      setCtxMenu(null);
                    }}
                  />
                ))}
              </div>
              <div className="context-menu-separator" />
              {ctxMenu.nodeType === 'classNode' && (
                <>
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      updateNodeData(ctxMenu.nodeId!, { stereotype: 'interface' });
                      setCtxMenu(null);
                    }}
                  >
                    Set stereotype
                  </div>
                  <div className="context-menu-separator" />
                </>
              )}
              <div
                className="context-menu-item danger"
                onClick={() => {
                  removeNode(ctxMenu.nodeId!);
                  setCtxMenu(null);
                }}
              >
                Delete
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
