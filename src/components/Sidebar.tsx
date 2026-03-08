import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo, memo, type KeyboardEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCanvasStore } from '../store/useCanvasStore';
import { buildFolderTree, type TreeNode, type FolderTreeNode, type FileTreeNode, type ImageTreeNode, type PdfTreeNode } from '../utils/folderTree';
import { ColorRow, StereotypeMenuItems } from './contextMenuItems';
import './Sidebar.css';

function getNodeDisplayName(node: { type?: string; data: Record<string, unknown> }): string {
  if (node.type === 'classNode') return (node.data.name as string) || 'Class';
  if (node.type === 'textNode') return (node.data.text as string)?.split('\n')[0] || 'Text';
  if (node.type === 'groupNode') return (node.data.label as string) || 'Group';
  return 'Node';
}

function getNodeBadge(type?: string): { label: string; className: string } {
  if (type === 'classNode') return { label: 'C', className: 'class' };
  if (type === 'textNode') return { label: 'T', className: 'text' };
  if (type === 'groupNode') return { label: 'G', className: 'group' };
  return { label: '?', className: '' };
}

// Memo'd component to avoid re-rendering all node rows when unrelated state changes
const SidebarNodeRow = memo(function SidebarNodeRow({
  node,
  filePath,
  depth,
  onNodeClick,
  onContextMenu,
}: {
  node: { id: string; type?: string; data: Record<string, unknown> };
  filePath: string;
  depth: number;
  onNodeClick: (nodeId: string, filePath: string) => void;
  onContextMenu: (e: React.MouseEvent, filePath: string, nodeId: string, nodeType?: string) => void;
}) {
  const badge = getNodeBadge(node.type);
  const nodeColor = node.data.color as string | undefined;
  const rowStyle: React.CSSProperties = {
    paddingLeft: 10 + depth * 16,
    ...(nodeColor ? { background: `${nodeColor}18` } : {}),
  };
  return (
    <div
      className="sidebar-node-row"
      style={rowStyle}
      onClick={() => onNodeClick(node.id, filePath)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, filePath, node.id, node.type);
      }}
    >
      <span className="sidebar-node-name">{getNodeDisplayName(node)}</span>
      <span className={`sidebar-node-badge ${badge.className}`}>{badge.label}</span>
    </div>
  );
});

export default function Sidebar() {
  const files = useCanvasStore((s) => s.files);
  const activeFilePath = useCanvasStore((s) => s.activeFilePath);
  const folderName = useCanvasStore((s) => s.folderName);
  const sidebarOpen = useCanvasStore((s) => s.sidebarOpen);
  const dirtyFiles = useCanvasStore((s) => s._dirtyFiles);
  const imagePaths = useCanvasStore((s) => s.imagePaths);
  const previewImagePath = useCanvasStore((s) => s.previewImagePath);
  const setPreviewImage = useCanvasStore((s) => s.setPreviewImage);
  const pdfPaths = useCanvasStore((s) => s.pdfPaths);
  const previewPdfPath = useCanvasStore((s) => s.previewPdfPath);
  const setPreviewPdf = useCanvasStore((s) => s.setPreviewPdf);
  const loading = useCanvasStore((s) => s._loading);
  const error = useCanvasStore((s) => s._error);

  const setSidebarOpen = useCanvasStore((s) => s.setSidebarOpen);
  const setActiveFile = useCanvasStore((s) => s.setActiveFile);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const addTextNode = useCanvasStore((s) => s.addTextNode);
  const saveViewport = useCanvasStore((s) => s.saveViewport);
  const renameFile = useCanvasStore((s) => s.renameFile);
  const moveFileToFolder = useCanvasStore((s) => s.moveFileToFolder);

  const { getViewport, setCenter, setNodes } = useReactFlow();

  // --- Search/filter ---
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Build folder tree from flat file map
  const tree = useMemo(() => buildFolderTree(files, imagePaths, pdfPaths), [files, imagePaths, pdfPaths]);

  // Filter tree nodes by search query
  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tree;

    function matchesSearch(node: TreeNode): boolean {
      if (node.kind === 'folder') return node.name.toLowerCase().includes(q) || node.children.some(matchesSearch);
      if (node.kind === 'image' || node.kind === 'pdf') return node.name.toLowerCase().includes(q);
      // file node: match file name or any node display name inside
      if (node.name.toLowerCase().includes(q)) return true;
      const fileData = files[node.relativePath];
      if (fileData) {
        return fileData.nodes.some((n) => getNodeDisplayName(n as { type?: string; data: Record<string, unknown> }).toLowerCase().includes(q));
      }
      return false;
    }

    function filterNodes(nodes: TreeNode[]): TreeNode[] {
      const result: TreeNode[] = [];
      for (const node of nodes) {
        if (node.kind === 'folder') {
          const filteredChildren = filterNodes(node.children);
          if (filteredChildren.length > 0 || node.name.toLowerCase().includes(q)) {
            result.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children });
          }
        } else if (matchesSearch(node)) {
          result.push(node);
        }
      }
      return result;
    }

    return filterNodes(tree);
  }, [tree, searchQuery, files]);

  // --- Drag & drop state ---
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, relativePath: string) => {
    e.dataTransfer.setData('text/plain', relativePath);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleFolderDragOver = useCallback((e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderPath);
  }, []);

  const handleFolderDrop = useCallback((e: React.DragEvent, targetFolderPath: string) => {
    e.preventDefault();
    setDragOverFolder(null);
    const sourcePath = e.dataTransfer.getData('text/plain');
    if (sourcePath) {
      moveFileToFolder(sourcePath, targetFolderPath);
    }
  }, [moveFileToFolder]);

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
        await useCanvasStore.getState().saveActiveFile();
      }
    }
  }, [fileNameDraft, activeFilePath, files, renameFile]);

  // --- Save ---
  const handleSave = useCallback(async () => {
    await useCanvasStore.getState().saveActiveFile();
  }, []);

  // --- Open folder ---
  const handleOpenFolder = useCallback(async () => {
    await useCanvasStore.getState().openFolder();
  }, []);

  // --- File click: activate file ---
  const handleFileClick = useCallback(
    (filePath: string) => {
      if (filePath === activeFilePath && !previewImagePath && !previewPdfPath) return;
      saveViewport(getViewport());
      setActiveFile(filePath);
    },
    [activeFilePath, previewImagePath, previewPdfPath, setActiveFile, saveViewport, getViewport]
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
      const needsSwitch = fp !== store.activeFilePath;
      if (needsSwitch) {
        saveViewport(getViewport());
        setActiveFile(fp);
      }
      const pan = () => {
        setCenter(node.position.x + 100, node.position.y + 75, { duration: 300 });
        setNodes((nodes) =>
          nodes.map((n) => ({ ...n, selected: n.id === nodeId }))
        );
      };
      if (needsSwitch) {
        // Double rAF ensures React has committed and the browser has painted
        requestAnimationFrame(() => requestAnimationFrame(pan));
      } else {
        pan();
      }
    },
    [setCenter, setNodes, saveViewport, getViewport, setActiveFile]
  );

  // --- Context menu ---
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    kind: 'folder' | 'file' | 'node' | 'image' | 'pdf';
    folderPath?: string;
    filePath?: string;
    imagePath?: string;
    imageName?: string;
    pdfPath?: string;
    pdfName?: string;
    nodeId?: string;
    nodeType?: string;
  } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);

  // Stable callback for node context menu (used by memo'd SidebarNodeRow)
  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, filePath: string, nodeId: string, nodeType?: string) => {
      setCtxMenu({
        x: e.clientX,
        y: e.clientY,
        kind: 'node',
        filePath,
        nodeId,
        nodeType,
      });
    },
    []
  );

  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    const handleKeydown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [ctxMenu]);

  // Clamp sidebar context menu to stay within viewport
  useLayoutEffect(() => {
    if (!ctxMenu || !ctxMenuRef.current) return;
    const rect = ctxMenuRef.current.getBoundingClientRect();
    const clampedX = Math.min(ctxMenu.x, window.innerWidth - rect.width - 4);
    const clampedY = Math.min(ctxMenu.y, window.innerHeight - rect.height - 4);
    ctxMenuRef.current.style.left = `${Math.max(0, clampedX)}px`;
    ctxMenuRef.current.style.top = `${Math.max(0, clampedY)}px`;
  }, [ctxMenu]);

  // --- Render helpers ---
  function renderTreeNodes(nodes: TreeNode[], depth: number) {
    return nodes.map((node) => {
      if (node.kind === 'folder') return renderFolder(node, depth);
      if (node.kind === 'image') return renderImageNode(node, depth);
      if (node.kind === 'pdf') return renderPdfNode(node, depth);
      return renderFileNode(node, depth);
    });
  }

  function renderFolder(folder: FolderTreeNode, depth: number) {
    const collapsed = collapsedPaths.has(folder.path);
    return (
      <div key={`folder:${folder.path}`}>
        <div
          className={`sidebar-folder-row${dragOverFolder === folder.path ? ' drag-over' : ''}`}
          style={{ paddingLeft: 10 + depth * 16 }}
          onClick={() => toggleCollapse(folder.path)}
          onDragOver={(e) => handleFolderDragOver(e, folder.path)}
          onDragLeave={() => setDragOverFolder(null)}
          onDrop={(e) => handleFolderDrop(e, folder.path)}
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
          draggable
          onDragStart={(e) => handleDragStart(e, file.relativePath)}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/schemata-image') || e.dataTransfer.types.includes('application/schemata-pdf')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={(e) => {
            const mediaPath = e.dataTransfer.getData('application/schemata-image') || e.dataTransfer.getData('application/schemata-pdf');
            if (mediaPath) {
              e.preventDefault();
              handleFileClick(file.relativePath);
              const fileName = mediaPath.split('/').pop() ?? 'file';
              setTimeout(() => {
                useCanvasStore.getState().addTextNode(0, 0, { text: `![${fileName}](${mediaPath})` });
              }, 0);
            }
          }}
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
        {!collapsed && hasNodes &&
          fileData.nodes.map((node) => (
            <SidebarNodeRow
              key={node.id}
              node={node}
              filePath={file.relativePath}
              depth={depth + 1}
              onNodeClick={handleNodeClick}
              onContextMenu={handleNodeContextMenu}
            />
          ))}
      </div>
    );
  }

  function renderImageNode(img: ImageTreeNode, depth: number) {
    const isActive = img.relativePath === previewImagePath;
    return (
      <div
        key={`img:${img.relativePath}`}
        className={`sidebar-file-row sidebar-image-row${isActive ? ' active' : ''}`}
        style={{ paddingLeft: 10 + depth * 16 }}
        draggable
        onDragStart={(e) => {
          handleDragStart(e, img.relativePath);
          e.dataTransfer.setData('application/schemata-image', img.relativePath);
          e.dataTransfer.effectAllowed = 'copyMove';
        }}
        onClick={() => setPreviewImage(img.relativePath)}
        title={`Click to preview. Right-click for options.`}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'image', imagePath: img.relativePath, imageName: img.name });
        }}
      >
        <span className="sidebar-file-icon">{'\uD83D\uDDBC\uFE0F'}</span>
        <span className="sidebar-canvas-name">{img.name}</span>
      </div>
    );
  }

  function renderPdfNode(pdf: PdfTreeNode, depth: number) {
    const isActive = pdf.relativePath === previewPdfPath;
    return (
      <div
        key={`pdf:${pdf.relativePath}`}
        className={`sidebar-file-row sidebar-image-row${isActive ? ' active' : ''}`}
        style={{ paddingLeft: 10 + depth * 16 }}
        draggable
        onDragStart={(e) => {
          handleDragStart(e, pdf.relativePath);
          e.dataTransfer.setData('application/schemata-pdf', pdf.relativePath);
          e.dataTransfer.effectAllowed = 'copyMove';
        }}
        onClick={() => setPreviewPdf(pdf.relativePath)}
        title={`Click to preview. Right-click for options.`}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'pdf', pdfPath: pdf.relativePath, pdfName: pdf.name });
        }}
      >
        <span className="sidebar-file-icon">{'\uD83D\uDCC4'}</span>
        <span className="sidebar-canvas-name">{pdf.name}</span>
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
  const hasFiles = Object.keys(files).length > 0 || imagePaths.length > 0 || pdfPaths.length > 0;

  return (
    <>
      <div className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <button className="sidebar-header-toggle" onClick={() => setSidebarOpen(false)} title="Close sidebar (Ctrl+B)">
            &#9776;
          </button>
          <span className="sidebar-project-name" title={folderName ?? 'No folder open'}>
            {folderName ?? 'Schemata'}
          </span>
          <button className="sidebar-save-btn" onClick={handleSave} title="Save (Ctrl+S)">
            &#128190;
          </button>
        </div>

        {/* Action Row */}
        <div className="sidebar-actions">
          <button
            className="sidebar-action-btn"
            disabled={!hasFolderOpen || loading}
            onClick={() => {
              setNewFileDraft('');
              setCreatingFileInFolder('');
            }}
          >
            + New File
          </button>
          <button className="sidebar-action-btn" disabled={loading} onClick={handleOpenFolder}>
            Open Folder
          </button>
          <button
            className="sidebar-action-btn"
            disabled={!hasFolderOpen || loading}
            onClick={() => useCanvasStore.getState().refreshFolder()}
            title="Refresh folder to discover new files"
          >
            &#x21BB;
          </button>
        </div>

        {/* Loading indicator */}
        {loading && (
          <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Loading...
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            style={{
              padding: '6px 10px', fontSize: 11, color: '#E74C3C', background: '#E74C3C18',
              cursor: 'pointer', textAlign: 'center',
            }}
            onClick={() => useCanvasStore.getState().clearError()}
            title="Click to dismiss"
          >
            {error}
          </div>
        )}

        {/* Search */}
        {hasFolderOpen && hasFiles && (
          <div className="sidebar-search">
            <input
              ref={searchInputRef}
              className="sidebar-search-input"
              type="text"
              placeholder="Search files & nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  searchInputRef.current?.blur();
                }
              }}
            />
            {searchQuery && (
              <button className="sidebar-search-clear" onClick={() => setSearchQuery('')} title="Clear search">
                &times;
              </button>
            )}
          </div>
        )}

        {/* Tree */}
        <div className="sidebar-tree">
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
              <div
                className={`sidebar-folder-row${dragOverFolder === '' ? ' drag-over' : ''}`}
                style={{ paddingLeft: 10 }}
                onDragOver={(e) => handleFolderDragOver(e, '')}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => handleFolderDrop(e, '')}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, kind: 'folder', folderPath: '' });
                }}
              >
                <span className="sidebar-folder-icon">{'\uD83D\uDCC2'}</span>
                <span className="sidebar-canvas-name" style={{ fontWeight: 600 }}>{folderName}</span>
              </div>
              {hasFiles ? (
                renderTreeNodes(filteredTree, 1)
              ) : (
                <div style={{ padding: '12px 10px 12px 26px', color: 'var(--text-muted)', fontSize: 11 }}>
                  No files found
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
              <div className="context-menu-separator" />
              <div
                className="context-menu-item danger"
                onClick={async () => {
                  const fp = ctxMenu.filePath!;
                  const fileData = files[fp];
                  const displayName = fileData?.name ?? fp;
                  setCtxMenu(null);
                  if (window.confirm(`Delete "${displayName}"?\n\nThis will permanently remove the file from disk.`)) {
                    await useCanvasStore.getState().removeFile(fp);
                  }
                }}
              >
                Delete File
              </div>
            </>
          )}

          {ctxMenu.kind === 'image' && ctxMenu.imagePath && (
            <div
              className="context-menu-item"
              onClick={() => {
                navigator.clipboard.writeText(`![${ctxMenu.imageName ?? ''}](${ctxMenu.imagePath!})`);
                setCtxMenu(null);
              }}
            >
              Copy as markdown
            </div>
          )}

          {ctxMenu.kind === 'pdf' && ctxMenu.pdfPath && (
            <div
              className="context-menu-item"
              onClick={() => {
                navigator.clipboard.writeText(`![${ctxMenu.pdfName ?? ''}](${ctxMenu.pdfPath!})`);
                setCtxMenu(null);
              }}
            >
              Copy as markdown
            </div>
          )}

          {ctxMenu.kind === 'node' && ctxMenu.nodeId && (
            <>
              <ColorRow onSelect={(color) => {
                updateNodeData(ctxMenu.nodeId!, { color });
                setCtxMenu(null);
              }} />
              <div className="context-menu-separator" />
              {ctxMenu.nodeType === 'classNode' && (
                <>
                  <StereotypeMenuItems onSet={(stereotype) => {
                    updateNodeData(ctxMenu.nodeId!, { stereotype });
                    setCtxMenu(null);
                  }} />
                  <div className="context-menu-separator" />
                </>
              )}
              <div
                className="context-menu-item"
                onClick={() => {
                  const nodeId = ctxMenu.nodeId!;
                  const filePath = ctxMenu.filePath;
                  const fp = filePath ?? activeFilePath;
                  if (!fp) { setCtxMenu(null); return; }
                  const nodeData = files[fp]?.nodes.find((n) => n.id === nodeId);
                  if (!nodeData) { setCtxMenu(null); return; }
                  if (fp !== activeFilePath) {
                    saveViewport(getViewport());
                    setActiveFile(fp);
                  }
                  addTextNode(nodeData.position.x + 220, nodeData.position.y, {
                    parentId: nodeId,
                    parentType: 'node',
                    color: '#F39C12',
                    borderStyle: 'dashed',
                    opacity: 0.85,
                    text: 'Comment',
                  });
                  setCtxMenu(null);
                }}
              >
                Add comment
              </div>
              <div className="context-menu-separator" />
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
