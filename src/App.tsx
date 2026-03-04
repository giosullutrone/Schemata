import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  reconnectEdge,
  getBezierPath,
  ConnectionMode,
  Background,
  Controls,
  MiniMap,
  type OnConnect,
  type OnReconnect,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type ConnectionLineComponentProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ClassNode from './components/ClassNode';
import AnnotationNode from './components/AnnotationNode';
import GroupNode from './components/GroupNode';
import { edgeTypes } from './components/edges';
import Sidebar from './components/Sidebar';
import SettingsPopover from './components/SettingsPopover';
import ContextMenu from './components/ContextMenu';
import AlignmentGuides from './components/AlignmentGuides';
import { calculateGuides, type GuideLine, type NodeRect, type SnapResult } from './utils/alignment';
import { EDGE_CONFIG, type UmlEdgeConfig } from './components/edges/edgeConfig';
import { useCanvasStore } from './store/useCanvasStore';
import type { CanvasNodeSchema, ClassEdgeSchema, RelationshipType } from './types/schema';
import type { ColorModeSetting, SnapMode } from './constants';

const nodeTypes = { classNode: ClassNode, annotationNode: AnnotationNode, groupNode: GroupNode };

const DIRECTIONAL_HANDLES = new Set(['top', 'bottom', 'left', 'right']);

function FlowCanvas({ colorMode, snapMode }: { colorMode: ColorModeSetting; snapMode: SnapMode }) {
  const activeFilePath = useCanvasStore((s) => s.activeFilePath);
  const activeFile = useCanvasStore((s) => s.activeFilePath ? s.files[s.activeFilePath] ?? null : null);
  const addClassNode = useCanvasStore((s) => s.addClassNode);
  const addAnnotation = useCanvasStore((s) => s.addAnnotation);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const setCanvasNodes = useCanvasStore((s) => s.setCanvasNodes);
  const pushUndoSnapshot = useCanvasStore((s) => s.pushUndoSnapshot);
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const setCanvasEdges = useCanvasStore((s) => s.setCanvasEdges);
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);

  const { screenToFlowPosition, setViewport, getNodes } = useReactFlow();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'node' | 'edge' | 'selection';
    targetId: string;
    nodeType?: string;
    selectedNodeRects?: { id: string; x: number; y: number; w: number; h: number }[];
  } | null>(null);

  const [guides, setGuides] = useState<GuideLine[]>([]);

  // Nodes captured at group drag start — only these move with the group
  const groupDragContainedRef = useRef<Set<string> | null>(null);

  // Track reconnecting edge data so custom connection line can use it
  const reconnectingEdgeRef = useRef<UmlEdgeConfig & {
    color: string;
    label: string;
    labelWidth?: number;
    labelHeight?: number;
    draggingSource?: boolean;
  } | null>(null);

  // Track whether edge reconnection succeeded (for delete-on-drop)
  const edgeReconnectSuccessful = useRef(true);

  // Stable custom connection line component that reads from the ref
  const ReconnectConnectionLine = useMemo(() => {
    return function ConnectionLine({ fromX, fromY, toX, toY, fromPosition, toPosition }: ConnectionLineComponentProps) {
      const data = reconnectingEdgeRef.current;
      const color = data?.color ?? 'var(--text-muted)';

      // When dragging the source handle, from=target(fixed) and to=cursor.
      // Swap so the path always runs source→target, keeping marker orientation
      // correct (orient="auto-start-reverse" reverses start markers).
      const srcX = data?.draggingSource ? toX : fromX;
      const srcY = data?.draggingSource ? toY : fromY;
      const tgtX = data?.draggingSource ? fromX : toX;
      const tgtY = data?.draggingSource ? fromY : toY;
      const srcPos = data?.draggingSource ? toPosition : fromPosition;
      const tgtPos = data?.draggingSource ? fromPosition : toPosition;

      const [path, labelX, labelY] = getBezierPath({
        sourceX: srcX, sourceY: srcY, targetX: tgtX, targetY: tgtY,
        sourcePosition: srcPos, targetPosition: tgtPos,
      });

      if (!data) {
        return <path d={path} fill="none" stroke={color} strokeWidth={1.5} />;
      }

      return (
        <>
          <defs>
            <marker
              id="reconnect-marker"
              viewBox="0 0 20 20"
              markerWidth={data.markerWidth}
              markerHeight={data.markerHeight}
              refX={data.markerRefX}
              refY={10}
              orient="auto-start-reverse"
              markerUnits="userSpaceOnUse"
              overflow="visible"
            >
              <path d={data.markerPath} fill={color} stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </marker>
          </defs>
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray={data.strokeDasharray}
            markerStart={data.markerPosition === 'start' ? 'url(#reconnect-marker)' : undefined}
            markerEnd={data.markerPosition === 'end' ? 'url(#reconnect-marker)' : undefined}
          />
          {data.label && (
            <foreignObject x={labelX - 300} y={labelY - 100} width={600} height={200} style={{ overflow: 'visible' }}>
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  className="uml-edge-label"
                  style={{
                    position: 'static',
                    transform: 'none',
                    borderColor: color,
                    resize: 'none',
                    pointerEvents: 'none',
                    ...(data.labelWidth
                      ? { width: `${data.labelWidth}px`, height: `${data.labelHeight}px`, boxSizing: 'border-box' as const }
                      : { width: 'auto', height: 'auto' }),
                  }}
                >
                  <span>{data.label}</span>
                </div>
              </div>
            </foreignObject>
          )}
        </>
      );
    };
  }, []);

  const canvas = activeFile;

  // Restore viewport when switching files
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setViewport(canvas?.viewport ?? { x: 0, y: 0, zoom: 1 });
  }, [activeFilePath]);

  const folderName = useCanvasStore((s) => s.folderName);
  const files = useCanvasStore((s) => s.files);

  // Keyboard shortcuts for node creation: N = new class, Shift+N = new annotation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;
      if (isEditing) return;
      if (!canvas) return;
      e.preventDefault();
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      if (e.shiftKey) {
        addAnnotation('', 'node', center.x, center.y);
      } else {
        addClassNode(center.x, center.y);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [canvas, screenToFlowPosition, addClassNode, addAnnotation]);

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      // Prevent self-loop edges (e.g. from a property handle back to the same node)
      if (connection.source === connection.target) return;
      addEdge(
        connection.source,
        connection.target,
        'association',
        connection.sourceHandle ?? undefined,
        connection.targetHandle ?? undefined,
      );
    },
    [addEdge]
  );

  // Apply React Flow node changes (position during drag, selection, etc.) without undo
  // Also handles snap-to-guides: computes guides and snaps positions during drag
  // Also handles group drag: moves contained nodes along with group
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const store = useCanvasStore.getState();
      const af = store.activeFilePath;
      if (!af) return;
      const currentNodes = store.files[af]?.nodes;
      if (!currentNodes) return;
      const updated = applyNodeChanges(changes, currentNodes) as CanvasNodeSchema[];

      // --- Group drag: move contained nodes along with the group ---
      const dragChange = changes.find(
        (c) => c.type === 'position' && 'dragging' in c && c.dragging
      );
      if (dragChange && 'id' in dragChange) {
        const draggedNode = updated.find((n) => n.id === dragChange.id);
        const oldNode = currentNodes.find((n) => n.id === dragChange.id);
        if (draggedNode?.type === 'groupNode' && oldNode) {
          const dx = draggedNode.position.x - oldNode.position.x;
          const dy = draggedNode.position.y - oldNode.position.y;
          if (dx !== 0 || dy !== 0) {
            // On first drag frame, capture which nodes are inside the group
            if (!groupDragContainedRef.current) {
              const rfNodes = getNodes();
              const measuredMap = new Map(
                rfNodes.map((n) => [n.id, { w: n.measured?.width ?? 0, h: n.measured?.height ?? 0 }])
              );
              const gx = oldNode.position.x;
              const gy = oldNode.position.y;
              const gw = measuredMap.get(oldNode.id)?.w || ((oldNode as { style?: { width: number } }).style?.width ?? 200);
              const gh = measuredMap.get(oldNode.id)?.h || ((oldNode as { style?: { height: number } }).style?.height ?? 150);
              const contained = new Set<string>();
              for (const n of currentNodes) {
                if (n.id === dragChange.id || n.type === 'groupNode') continue;
                const m = measuredMap.get(n.id);
                const nw = m?.w ?? 200;
                const nh = m?.h ?? 150;
                const cx = n.position.x + nw / 2;
                const cy = n.position.y + nh / 2;
                if (cx >= gx && cx <= gx + gw && cy >= gy && cy <= gy + gh) {
                  contained.add(n.id);
                }
              }
              groupDragContainedRef.current = contained;
            }

            // Move only the nodes captured at drag start
            for (let i = 0; i < updated.length; i++) {
              const n = updated[i];
              if (groupDragContainedRef.current.has(n.id)) {
                updated[i] = {
                  ...n,
                  position: { x: n.position.x + dx, y: n.position.y + dy },
                };
              }
            }
          }
        }
      }

      if (snapMode === 'guides') {
        // When drag ends, xyflow emits a final position with its internal (unsnapped)
        // value. Restore the store's snapped position so the node doesn't shift ~1px.
        const dragEndChange = changes.find(
          (c) => c.type === 'position' && 'dragging' in c && !c.dragging
        );
        if (dragEndChange && 'id' in dragEndChange) {
          const stored = currentNodes.find((n) => n.id === dragEndChange.id);
          const idx = updated.findIndex((n) => n.id === dragEndChange.id);
          if (stored && idx !== -1) {
            updated[idx] = { ...updated[idx], position: stored.position };
          }
        }

        if (dragChange && 'id' in dragChange) {
          const rfNodes = getNodes();
          const measuredMap = new Map(
            rfNodes.map((n) => [n.id, { w: n.measured?.width ?? 200, h: n.measured?.height ?? 150 }])
          );
          const nodeIdx = updated.findIndex((n) => n.id === dragChange.id);
          if (nodeIdx !== -1) {
            const node = updated[nodeIdx];
            const m = measuredMap.get(node.id);
            const others: NodeRect[] = updated
              .filter((n) => n.id !== node.id)
              .map((n) => {
                const nm = measuredMap.get(n.id);
                return { id: n.id, x: n.position.x, y: n.position.y, width: nm?.w ?? 200, height: nm?.h ?? 150 };
              });
            const dragged: NodeRect = {
              id: node.id, x: node.position.x, y: node.position.y,
              width: m?.w ?? 200, height: m?.h ?? 150,
            };
            const result: SnapResult = calculateGuides(dragged, others);
            setGuides(result.guides);
            if (result.snapDeltaX !== null || result.snapDeltaY !== null) {
              updated[nodeIdx] = {
                ...node,
                position: {
                  x: node.position.x + (result.snapDeltaX ?? 0),
                  y: node.position.y + (result.snapDeltaY ?? 0),
                },
              };
            }
          }
        }
      }

      setCanvasNodes(updated);
    },
    [setCanvasNodes, snapMode, getNodes]
  );

  // Apply React Flow edge changes (selection, removal, etc.) without undo
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const store = useCanvasStore.getState();
      const af = store.activeFilePath;
      if (!af) return;
      const currentEdges = store.files[af]?.edges;
      if (!currentEdges) return;
      const updated = applyEdgeChanges(changes, currentEdges) as ClassEdgeSchema[];
      setCanvasEdges(updated);
    },
    [setCanvasEdges]
  );

  const handleReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection) => {
      // Prevent reconnecting into a self-loop
      if (newConnection.source === newConnection.target) return;
      edgeReconnectSuccessful.current = true;
      pushUndoSnapshot();
      const store = useCanvasStore.getState();
      const af = store.activeFilePath;
      if (!af) return;
      const currentEdges = store.files[af]?.edges;
      if (!currentEdges) return;
      const updated = reconnectEdge(oldEdge, newConnection, currentEdges) as ClassEdgeSchema[];
      setCanvasEdges(updated);
    },
    [pushUndoSnapshot, setCanvasEdges]
  );

  // Save reconnecting edge data so the custom connection line can render it
  const handleReconnectStart = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_: React.MouseEvent, edge: any, handleType: string) => {
      edgeReconnectSuccessful.current = false;
      const d = edge.data as { color?: string; label?: string; relationshipType?: string } | undefined;
      const type = (d?.relationshipType ?? 'association') as RelationshipType;
      const cfg = EDGE_CONFIG[type] ?? EDGE_CONFIG.association;
      // Capture current label dimensions from the DOM before the edge unmounts
      const labelEl = document.querySelector(`.uml-edge-label[data-edge-id="${edge.id}"]`) as HTMLElement | null;
      reconnectingEdgeRef.current = {
        color: (d?.color as string) ?? '#b1b1b7',
        label: (d?.label as string) ?? '',
        ...cfg,
        labelWidth: labelEl?.offsetWidth,
        labelHeight: labelEl?.offsetHeight,
        // handleType is the OPPOSITE (fixed) handle, so 'target' means source is being dragged
        draggingSource: handleType === 'target',
      };
    },
    []
  );

  const handleReconnectEnd = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_: MouseEvent | TouchEvent, edge: any) => {
      const captured = reconnectingEdgeRef.current;
      reconnectingEdgeRef.current = null;
      if (!edgeReconnectSuccessful.current) {
        removeEdge(edge.id);
      } else if (captured?.labelWidth != null && captured?.labelHeight != null) {
        // Restore label dimensions — the UmlEdge component unmounts during
        // reconnection drag, so any CSS resize state on the label DOM element
        // is lost when it remounts. Persist in edge data without pushing undo
        // (reconnection already pushed undo in handleReconnect).
        const store = useCanvasStore.getState();
        const af = store.activeFilePath;
        if (af) {
          const currentEdges = store.files[af]?.edges;
          if (currentEdges) {
            const updated = currentEdges.map((e) =>
              e.id === edge.id ? { ...e, data: { ...e.data, labelWidth: captured.labelWidth, labelHeight: captured.labelHeight } } : e
            ) as ClassEdgeSchema[];
            setCanvasEdges(updated);
          }
        }
      }
      edgeReconnectSuccessful.current = true;
    },
    [removeEdge, setCanvasEdges]
  );

  // Push undo snapshot when drag starts (before any position changes)
  const handleNodeDragStart = useCallback(() => {
    pushUndoSnapshot();
  }, [pushUndoSnapshot]);

  const handleNodeDragStop = useCallback(() => {
    setGuides([]);
    groupDragContainedRef.current = null;
  }, []);

  // Double-click on empty canvas: Shift+double-click creates comment, plain double-click creates class
  const handlePaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      // Only trigger on the pane itself, not on nodes or edges
      const target = event.target as HTMLElement;
      if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      if (event.shiftKey) {
        addAnnotation('', 'node', position.x, position.y);
      } else {
        addClassNode(position.x, position.y);
      }
    },
    [screenToFlowPosition, addClassNode, addAnnotation]
  );

  const removeNodes = useCanvasStore((s) => s.removeNodes);
  const removeEdges = useCanvasStore((s) => s.removeEdges);

  const handleNodesDelete = useCallback(
    (nodes: { id: string }[]) => {
      removeNodes(nodes.map((n) => n.id));
    },
    [removeNodes]
  );

  const handleEdgesDelete = useCallback(
    (edges: { id: string }[]) => {
      removeEdges(edges.map((e) => e.id));
    },
    [removeEdges]
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: { id: string; type?: string }) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, type: 'node', targetId: node.id, nodeType: node.type });
    },
    []
  );

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: { id: string }) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, type: 'edge', targetId: edge.id });
    },
    []
  );

  const handleSelectionContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const rfNodes = getNodes();
      const selected = rfNodes.filter((n) => n.selected);
      if (selected.length < 2) return;
      const rects = selected.map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        w: n.measured?.width ?? 200,
        h: n.measured?.height ?? 150,
      }));
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'selection',
        targetId: '',
        selectedNodeRects: rects,
      });
    },
    [getNodes]
  );

  // Double-click an edge to add/edit its label
  const handleEdgeDoubleClick = useCallback(
    (_: React.MouseEvent, edge: { id: string; data?: { label?: string } }) => {
      // Only trigger for edges without a label (edges with labels handle it themselves)
      if (!edge.data?.label) {
        updateEdgeData(edge.id, { label: '' });
      }
    },
    [updateEdgeData]
  );

  // Elevate edges that connect to sub-handles (property/method) so they render above nodes.
  // z-index 1001 is above selected nodes (z-index 1000 from xyflow's elevateNodesOnSelect).
  const processedEdges = canvas?.edges.map((e) => {
    const hasSubHandle =
      (e.sourceHandle && !DIRECTIONAL_HANDLES.has(e.sourceHandle)) ||
      (e.targetHandle && !DIRECTIONAL_HANDLES.has(e.targetHandle));
    return hasSubHandle ? { ...e, zIndex: 1001 } : e;
  }) ?? [];

  if (!canvas) {
    const hasFolderOpen = folderName !== null;
    const hasFiles = Object.keys(files).length > 0;
    const hasFileSystemAPI = 'showDirectoryPicker' in window;
    let message = 'Open a folder to get started';
    if (!hasFileSystemAPI) message = 'Your browser does not support the File System Access API. Please use Chrome or Edge.';
    else if (hasFolderOpen && !hasFiles) message = 'No canvas files found in this folder';
    else if (hasFolderOpen) message = 'Select a file from the sidebar';

    return (
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 14,
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 12 }}>{message}</p>
          {!hasFolderOpen && hasFileSystemAPI && (
            <button
              onClick={() => useCanvasStore.getState().openFolder()}
              style={{
                padding: '6px 16px', border: '1px solid var(--border-primary)', borderRadius: 4,
                background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
              }}
            >
              Open Folder
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <ReactFlow
        nodes={canvas.nodes}
        edges={processedEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onReconnect={handleReconnect}
        onReconnectStart={handleReconnectStart}
        onReconnectEnd={handleReconnectEnd}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onSelectionContextMenu={handleSelectionContextMenu}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        onPaneClick={() => setContextMenu(null)}
        onDoubleClick={handlePaneDoubleClick}
        zoomOnDoubleClick={false}
        panOnDrag={[1]}
        selectionOnDrag
        panOnScroll
        colorMode={colorMode}
        connectionMode={ConnectionMode.Loose}
        snapToGrid={snapMode === 'grid'}
        snapGrid={[20, 20]}
        defaultEdgeOptions={{ type: 'uml' }}
        connectionLineComponent={ReconnectConnectionLine}
        connectionRadius={20}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background gap={20} />
        <Controls />
        <MiniMap />
      </ReactFlow>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          targetId={contextMenu.targetId}
          nodeType={contextMenu.nodeType}
          onClose={() => setContextMenu(null)}
          screenToFlowPosition={screenToFlowPosition}
          selectedNodeRects={contextMenu.selectedNodeRects}
        />
      )}
      <AlignmentGuides guides={guides} />
    </>
  );
}

function App() {
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);

  const [colorMode, setColorMode] = useState<ColorModeSetting>(() => {
    return (localStorage.getItem('codecanvas-color-mode') as ColorModeSetting) || 'system';
  });

  const [snapMode, setSnapMode] = useState<SnapMode>(() => {
    return (localStorage.getItem('codecanvas-snap-mode') as SnapMode) || 'grid';
  });

  const handleSnapCycle = useCallback(() => {
    setSnapMode((prev) => {
      const next: Record<SnapMode, SnapMode> = { grid: 'guides', guides: 'none', none: 'grid' };
      const nextMode = next[prev];
      localStorage.setItem('codecanvas-snap-mode', nextMode);
      return nextMode;
    });
  }, []);

  const handleColorModeChange = useCallback((mode: ColorModeSetting) => {
    setColorMode(mode);
    localStorage.setItem('codecanvas-color-mode', mode);
  }, []);

  // Resolve system preference for applying dark class
  const [resolvedDark, setResolvedDark] = useState(false);

  useEffect(() => {
    if (colorMode === 'dark') {
      setResolvedDark(true);
    } else if (colorMode === 'light') {
      setResolvedDark(false);
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      setResolvedDark(mq.matches);
      const handler = (e: MediaQueryListEvent) => setResolvedDark(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [colorMode]);

  // Keyboard shortcuts: Undo/Redo, Save, Toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (isEditing) return; // Let browser handle undo in text fields
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        if (isEditing) return;
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y' && !e.shiftKey) {
        if (isEditing) return;
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          useCanvasStore.getState().saveAllFiles();
        } else {
          useCanvasStore.getState().saveActiveFile();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        const store = useCanvasStore.getState();
        store.setSidebarOpen(!store.sidebarOpen);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // Warn before closing tab with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const dirtyFiles = useCanvasStore.getState()._dirtyFiles;
      if (Object.keys(dirtyFiles).length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  return (
    <div
      className={resolvedDark ? 'dark' : ''}
      style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'row' }}
    >
      <ReactFlowProvider>
        <Sidebar />
        <div style={{ flex: 1, position: 'relative' }}>
          <FlowCanvas colorMode={colorMode} snapMode={snapMode} />
          <SettingsPopover
            colorMode={colorMode}
            onColorModeChange={handleColorModeChange}
            snapMode={snapMode}
            onSnapCycle={handleSnapCycle}
          />
        </div>
      </ReactFlowProvider>
    </div>
  );
}

export default App;
