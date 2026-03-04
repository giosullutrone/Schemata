import { useState, useCallback, useRef, useEffect, useMemo, type KeyboardEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCanvasStore } from '../store/useCanvasStore';
import { buildFolderTree, type TreeNode, type FolderTreeNode, type FileTreeNode } from '../utils/folderTree';
import { COLORS } from '../constants';
import './Sidebar.css';

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
  const files = useCanvasStore((s) => s.files);
  const activeFilePath = useCanvasStore((s) => s.activeFilePath);
  const folderName = useCanvasStore((s) => s.folderName);
  const sidebarOpen = useCanvasStore((s) => s.sidebarOpen);
  const dirtyFiles = useCanvasStore((s) => s._dirtyFiles);

  const setSidebarOpen = useCanvasStore((s) => s.setSidebarOpen);
  const setActiveFile = useCanvasStore((s) => s.setActiveFile);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const saveViewport = useCanvasStore((s) => s.saveViewport);
  const renameFile = useCanvasStore((s) => s.renameFile);

  const { getViewport, setCenter, setNodes } = useReactFlow();

  // Build folder tree from flat file map
  const tree = useMemo(() => buildFolderTree(files), [files]);

  // --- Collapsed state ---
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const toggleCollapse = useCallback((path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // --- New file creation in folder ---
  const [creatingFileInFolder, setCreatingFileInFolder] = useState<string | null>(null);
  const [newFileDraft, setNewFileDraft] = useState('');
  const newFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingFileInFolder !== null && newFileInputRef.current) newFileInputRef.current.focus();
  }, [creatingFileInFolder]);

  const commitNewFile = useCallback(async () => {
    const folderPath = creatingFileInFolder;
    setCreatingFileInFolder(null);
    const name = newFileDraft.trim();
    if (!name || folderPath === null) return;
    const createFile = useCanvasStore.getState().createFile;
    await createFile(folderPath, name);
    setNewFileDraft('');
  }, [creatingFileInFolder, newFileDraft]);

  // --- File name editing ---
  const [editingFileName, setEditingFileName] = useState(false);
  const [fileNameDraft, setFileNameDraft] = useState('');
  const fileNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingFileName && fileNameInputRef.current) fileNameInputRef.current.focus();
  }, [editingFileName]);

  const commitFileNameEdit = useCallback(async () => {
    setEditingFileName(false);
    const trimmed = fileNameDraft.trim();
    if (trimmed && activeFilePath) {
      const currentName = files[activeFilePath]?.name;
      if (trimmed !== currentName) {
        renameFile(trimmed);
        try { await useCanvasStore.getState().saveActiveFile(); } catch { /* ignore */ }
      }
    }
  }, [fileNameDraft, activeFilePath, files, renameFile]);

  // --- Save ---
  const handleSave = useCallback(async () => {
    try {
      await useCanvasStore.getState().saveActiveFile();
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        console.error('Save failed:', err);
      }
    }
  }, []);

  // --- Open folder ---
  const handleOpenFolder = useCallback(async () => {
    await useCanvasStore.getState().openFolder();
  }, []);

  // --- File click: activate file ---
  const handleFileClick = useCallback(
    (filePath: string) => {
      if (filePath === activeFilePath) return;
      saveViewport(getViewport());
      setActiveFile(filePath);
    },
    [activeFilePath, setActiveFile, saveViewport, getViewport]
  );

  // --- Node click: pan + select ---
  const handleNodeClick = useCallback(
    (nodeId: string, filePath?: string) => {
      const store = useCanvasStore.getState();
      const fp = filePath ?? store.activeFilePath;
      if (!fp) return;
      const af = store.files[fp];
      if (!af) return;
      const node = af.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      // Use a short delay when switching files so the canvas has time to render
      const pan = () => {
        setCenter(node.position.x + 100, node.position.y + 75, { duration: 300 });
        setNodes((nodes) =>
          nodes.map((n) => ({ ...n, selected: n.id === nodeId }))
        );
      };
      if (fp !== store.activeFilePath) {
        // File was just switched — wait for canvas to mount
        setTimeout(pan, 50);
      } else {
        pan();
      }
    },
    [setCenter, setNodes]
  );

  // --- Context menu ---
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    kind: 'folder' | 'file' | 'node';
    folderPath?: string;
    filePath?: string;
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

  // --- Active file data ---
  const activeFile = activeFilePath ? files[activeFilePath] ?? null : null;

  // --- Render helpers ---
  function renderTreeNodes(nodes: TreeNode[], depth: number) {
    return nodes.map((node) => {
      if (node.kind === 'folder') return renderFolder(node, depth);
      return renderFileNode(node, depth);
    });
  }

  function renderFolder(folder: FolderTreeNode, depth: number) {
    const collapsed = collapsedPaths.has(folder.path);
    return (
      <div key={`folder:${folder.path}`}>
        <div
          className="sidebar-folder-row"
          style={{ paddingLeft: 10 + depth * 16 }}
          onClick={() => toggleCollapse(folder.path)}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'folder', folderPath: folder.path });
          }}
        >
          <span className="sidebar-canvas-chevron">{collapsed ? '\u25B6' : '\u25BC'}</span>
          <span className="sidebar-folder-icon">{collapsed ? '\uD83D\uDCC1' : '\uD83D\uDCC2'}</span>
          <span className="sidebar-canvas-name">{folder.name}</span>
        </div>
        {!collapsed && renderTreeNodes(folder.children, depth + 1)}
        {/* Inline input for new file creation */}
        {creatingFileInFolder === folder.path && (
          <div className="sidebar-file-row" style={{ paddingLeft: 10 + (depth + 1) * 16 }}>
            <input
              ref={newFileInputRef}
              className="sidebar-canvas-name-input"
              value={newFileDraft}
              placeholder="File name..."
              onChange={(e) => setNewFileDraft(e.target.value)}
              onBlur={() => { if (newFileDraft.trim()) commitNewFile(); else setCreatingFileInFolder(null); }}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Enter') commitNewFile();
                if (e.key === 'Escape') setCreatingFileInFolder(null);
              }}
            />
          </div>
        )}
      </div>
    );
  }

  function renderFileNode(file: FileTreeNode, depth: number) {
    const isActiveFile = file.relativePath === activeFilePath;
    const fileData = files[file.relativePath];
    if (!fileData) return null;
    const isDirty = !!dirtyFiles[file.relativePath];
    const collapsed = collapsedPaths.has(file.relativePath);
    const hasNodes = fileData.nodes.length > 0;

    return (
      <div key={`file:${file.relativePath}`}>
        <div
          className={`sidebar-file-row${isActiveFile ? ' active' : ''}`}
          style={{ paddingLeft: 10 + depth * 16 }}
          onClick={() => handleFileClick(file.relativePath)}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'file', filePath: file.relativePath });
          }}
        >
          <span
            className={`sidebar-canvas-chevron${hasNodes ? ' clickable' : ''}`}
            onClick={(e) => {
              if (hasNodes) {
                e.stopPropagation();
                toggleCollapse(file.relativePath);
              }
            }}
          >
            {hasNodes ? (collapsed ? '\u25B6' : '\u25BC') : ''}
          </span>
          <span className="sidebar-file-icon">{'\uD83D\uDCC4'}</span>
          {/* Show editable name if this is the active file and we're editing */}
          {isActiveFile && editingFileName ? (
            <input
              ref={fileNameInputRef}
              className="sidebar-canvas-name-input"
              value={fileNameDraft}
              onChange={(e) => setFileNameDraft(e.target.value)}
              onBlur={commitFileNameEdit}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Enter') commitFileNameEdit();
                if (e.key === 'Escape') setEditingFileName(false);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="sidebar-canvas-name">
              {file.name}
              {isDirty && <span className="sidebar-dirty-dot" />}
            </span>
          )}
        </div>
        {/* Node children — for any expanded file */}
        {!collapsed && hasNodes &&
          fileData.nodes.map((node) => {
            const badge = getNodeBadge(node.type);
            const nodeColor = node.data.color as string | undefined;
            const rowStyle: React.CSSProperties = {
              paddingLeft: 10 + (depth + 1) * 16,
              ...(nodeColor ? { background: `${nodeColor}18` } : {}),
            };
            return (
              <div
                key={node.id}
                className="sidebar-node-row"
                style={rowStyle}
                onClick={() => {
                  // Switch to the file first if not active, then pan to node
                  if (!isActiveFile) {
                    saveViewport(getViewport());
                    setActiveFile(file.relativePath);
                  }
                  handleNodeClick(node.id, file.relativePath);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCtxMenu({
                    x: e.clientX,
                    y: e.clientY,
                    kind: 'node',
                    filePath: file.relativePath,
                    nodeId: node.id,
                    nodeType: node.type,
                  });
                }}
              >
                <span className="sidebar-node-name">{getNodeDisplayName(node)}</span>
                <span className={`sidebar-node-badge ${badge.className}`}>{badge.label}</span>
              </div>
            );
          })}
      </div>
    );
  }

  // --- Collapsed sidebar ---
  if (!sidebarOpen) {
    return (
      <button className="sidebar-toggle-tab" onClick={() => setSidebarOpen(true)} title="Open sidebar (Ctrl+B)">
        &#9776;
      </button>
    );
  }

  const hasFolderOpen = folderName !== null;
  const hasFiles = Object.keys(files).length > 0;

  return (
    <>
      <div className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <button className="sidebar-header-toggle" onClick={() => setSidebarOpen(false)} title="Close sidebar (Ctrl+B)">
            &#9776;
          </button>
          <span className="sidebar-project-name" title={folderName ?? 'No folder open'}>
            {folderName ?? 'CodeCanvas'}
          </span>
          <button className="sidebar-save-btn" onClick={handleSave} title="Save (Ctrl+S)">
            &#128190;
          </button>
        </div>

        {/* Action Row */}
        <div className="sidebar-actions">
          <button
            className="sidebar-action-btn"
            disabled={!hasFolderOpen}
            onClick={() => {
              setNewFileDraft('');
              setCreatingFileInFolder('');
            }}
          >
            + New File
          </button>
          <button className="sidebar-action-btn" onClick={handleOpenFolder}>
            Open Folder
          </button>
        </div>

        {/* Tree */}
        <div className="sidebar-tree">
          {/* New file input at root level */}
          {creatingFileInFolder === '' && (
            <div className="sidebar-file-row" style={{ paddingLeft: 26 }}>
              <input
                ref={newFileInputRef}
                className="sidebar-canvas-name-input"
                value={newFileDraft}
                placeholder="File name..."
                onChange={(e) => setNewFileDraft(e.target.value)}
                onBlur={() => {
                  if (newFileDraft.trim()) commitNewFile();
                  else setCreatingFileInFolder(null);
                }}
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter') commitNewFile();
                  if (e.key === 'Escape') setCreatingFileInFolder(null);
                }}
              />
            </div>
          )}

          {folderName ? (
            <>
              {/* Root folder row */}
              <div
                className="sidebar-folder-row"
                style={{ paddingLeft: 10 }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'folder', folderPath: '' });
                }}
              >
                <span className="sidebar-folder-icon">{'\uD83D\uDCC2'}</span>
                <span className="sidebar-canvas-name" style={{ fontWeight: 600 }}>{folderName}</span>
              </div>
              {hasFiles ? (
                renderTreeNodes(tree, 1)
              ) : (
                <div style={{ padding: '12px 10px 12px 26px', color: 'var(--text-muted)', fontSize: 11 }}>
                  No canvas files found
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '16px 10px', color: 'var(--text-muted)', textAlign: 'center', fontSize: 11 }}>
              Open a folder to get started
            </div>
          )}
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="sidebar-context-menu"
          ref={ctxMenuRef}
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {ctxMenu.kind === 'folder' && (
            <div
              className="context-menu-item"
              onClick={() => {
                setNewFileDraft('');
                setCreatingFileInFolder(ctxMenu.folderPath ?? '');
                setCtxMenu(null);
              }}
            >
              New Canvas File
            </div>
          )}

          {ctxMenu.kind === 'file' && ctxMenu.filePath && (
            <>
              <div
                className="context-menu-item"
                onClick={() => {
                  const fp = ctxMenu.filePath!;
                  const fileData = files[fp];
                  if (fileData) {
                    if (fp !== activeFilePath) {
                      saveViewport(getViewport());
                      setActiveFile(fp);
                    }
                    setFileNameDraft(fileData.name);
                    setEditingFileName(true);
                  }
                  setCtxMenu(null);
                }}
              >
                Rename
              </div>
              <div
                className="context-menu-item"
                onClick={() => {
                  setNewFileDraft('');
                  const fp = ctxMenu.filePath!;
                  const lastSlash = fp.lastIndexOf('/');
                  const parentFolder = lastSlash === -1 ? '' : fp.substring(0, lastSlash);
                  setCreatingFileInFolder(parentFolder);
                  setCtxMenu(null);
                }}
              >
                New Canvas File Here
              </div>
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
