import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  reconnectEdge,
  ConnectionMode,
  Background,
  Controls,
  MiniMap,
  type OnConnect,
  type OnReconnect,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ClassNode from './components/ClassNode';
import { edgeTypes } from './components/edges';
import UmlMarkers from './components/edges/UmlMarkers';
import Toolbar from './components/Toolbar';
import ContextMenu from './components/ContextMenu';
import EdgeTypePopup from './components/EdgeTypePopup';
import AlignmentGuides from './components/AlignmentGuides';
import { calculateGuides, type GuideLine, type NodeRect } from './utils/alignment';
import { useCanvasStore } from './store/useCanvasStore';
import { deserializeFile, validateFile } from './utils/fileIO';
import type { ClassNodeSchema, ClassEdgeSchema, RelationshipType } from './types/schema';

const nodeTypes = { classNode: ClassNode };

type ColorModeSetting = 'light' | 'dark' | 'system';

function FlowCanvas({ colorMode }: { colorMode: ColorModeSetting }) {
  const file = useCanvasStore((s) => s.file);
  const currentCanvasId = useCanvasStore((s) => s.currentCanvasId);
  const addClassNode = useCanvasStore((s) => s.addClassNode);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const setCanvasNodes = useCanvasStore((s) => s.setCanvasNodes);
  const pushUndoSnapshot = useCanvasStore((s) => s.pushUndoSnapshot);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const setCanvasEdges = useCanvasStore((s) => s.setCanvasEdges);

  const { screenToFlowPosition, setViewport } = useReactFlow();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'node' | 'edge';
    targetId: string;
  } | null>(null);

  const [edgePopup, setEdgePopup] = useState<{
    x: number;
    y: number;
    source: string;
    target: string;
  } | null>(null);

  const [guides, setGuides] = useState<GuideLine[]>([]);

  const canvas = file.canvases[currentCanvasId];
  if (!canvas) return null;

  // Restore viewport when switching canvases
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (canvas.viewport) {
      setViewport(canvas.viewport);
    }
  }, [currentCanvasId]);

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      // Show the edge type popup at the center of the screen
      setEdgePopup({
        x: window.innerWidth / 2 - 75,
        y: window.innerHeight / 2 - 100,
        source: connection.source,
        target: connection.target,
      });
    },
    []
  );

  const handleEdgeTypeSelect = useCallback(
    (type: RelationshipType) => {
      if (edgePopup) {
        addEdge(edgePopup.source, edgePopup.target, type);
        setEdgePopup(null);
      }
    },
    [edgePopup, addEdge]
  );

  // Apply React Flow node changes (position during drag, selection, etc.) without undo
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const store = useCanvasStore.getState();
      const currentNodes = store.file.canvases[store.currentCanvasId]?.nodes;
      if (!currentNodes) return;
      const updated = applyNodeChanges(changes, currentNodes) as ClassNodeSchema[];
      setCanvasNodes(updated);
    },
    [setCanvasNodes]
  );

  // Apply React Flow edge changes (selection, removal, etc.) without undo
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const store = useCanvasStore.getState();
      const currentEdges = store.file.canvases[store.currentCanvasId]?.edges;
      if (!currentEdges) return;
      const updated = applyEdgeChanges(changes, currentEdges) as ClassEdgeSchema[];
      setCanvasEdges(updated);
    },
    [setCanvasEdges]
  );

  const handleReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection) => {
      pushUndoSnapshot();
      const store = useCanvasStore.getState();
      const currentEdges = store.file.canvases[store.currentCanvasId]?.edges;
      if (!currentEdges) return;
      const updated = reconnectEdge(oldEdge, newConnection, currentEdges) as ClassEdgeSchema[];
      setCanvasEdges(updated);
    },
    [pushUndoSnapshot, setCanvasEdges]
  );

  // Push undo snapshot when drag starts (before any position changes)
  const handleNodeDragStart = useCallback(() => {
    pushUndoSnapshot();
  }, [pushUndoSnapshot]);

  const handleNodeDrag = useCallback(
    (_: React.MouseEvent, node: { id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } }) => {
      const nodeRects: NodeRect[] = canvas.nodes
        .filter((n) => n.id !== node.id)
        .map((n) => ({
          id: n.id,
          x: n.position.x,
          y: n.position.y,
          width: 200,
          height: 150,
        }));
      const draggedRect: NodeRect = {
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width: node.measured?.width || 200,
        height: node.measured?.height || 150,
      };
      setGuides(calculateGuides(draggedRect, nodeRects));
    },
    [canvas.nodes]
  );

  const handleNodeDragStop = useCallback(() => {
    setGuides([]);
  }, []);

  // Double-click on empty canvas to create a new node
  const handlePaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addClassNode(position.x, position.y);
    },
    [screenToFlowPosition, addClassNode]
  );

  const handleNodesDelete = useCallback(
    (nodes: { id: string }[]) => {
      nodes.forEach((n) => removeNode(n.id));
    },
    [removeNode]
  );

  const handleEdgesDelete = useCallback(
    (edges: { id: string }[]) => {
      edges.forEach((e) => removeEdge(e.id));
    },
    [removeEdge]
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: { id: string }) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, type: 'node', targetId: node.id });
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

  return (
    <>
      <ReactFlow
        nodes={canvas.nodes}
        edges={canvas.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onReconnect={handleReconnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneClick={() => setContextMenu(null)}
        onDoubleClick={handlePaneDoubleClick}
        colorMode={colorMode}
        connectionMode={ConnectionMode.Loose}
        snapToGrid
        snapGrid={[20, 20]}
        defaultEdgeOptions={{ type: 'uml' }}
        fitView
        deleteKeyCode="Backspace"
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
          onClose={() => setContextMenu(null)}
        />
      )}
      <AlignmentGuides guides={guides} />
      {edgePopup && (
        <EdgeTypePopup
          x={edgePopup.x}
          y={edgePopup.y}
          onSelect={handleEdgeTypeSelect}
          onClose={() => setEdgePopup(null)}
        />
      )}
    </>
  );
}

function App() {
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const loadFile = useCanvasStore((s) => s.loadFile);

  const [colorMode, setColorMode] = useState<ColorModeSetting>(() => {
    return (localStorage.getItem('codecanvas-color-mode') as ColorModeSetting) || 'system';
  });

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

  // Undo/Redo keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // Drag-and-drop file loading
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.name.endsWith('.json')) return;
      try {
        const text = await file.text();
        const parsed = deserializeFile(text);
        const errors = validateFile(parsed);
        if (errors.length > 0) {
          console.error('Invalid CodeCanvas file:', errors);
          return;
        }
        loadFile(parsed);
      } catch (err) {
        console.error('Failed to load file:', err);
      }
    },
    [loadFile]
  );

  return (
    <div
      className={resolvedDark ? 'dark' : ''}
      style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlowProvider>
        <UmlMarkers />
        <Toolbar colorMode={colorMode} onColorModeChange={handleColorModeChange} />
        <div style={{ flex: 1 }}>
          <FlowCanvas colorMode={colorMode} />
        </div>
      </ReactFlowProvider>
    </div>
  );
}

export default App;
