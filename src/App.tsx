import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  type OnConnect,
  type Connection,
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
import type { RelationshipType } from './types/schema';

const nodeTypes = { classNode: ClassNode };

function FlowCanvas() {
  const file = useCanvasStore((s) => s.file);
  const currentCanvasId = useCanvasStore((s) => s.currentCanvasId);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const updateNodePosition = useCanvasStore((s) => s.updateNodePosition);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const removeEdge = useCanvasStore((s) => s.removeEdge);

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

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: { id: string; position: { x: number; y: number } }) => {
      setGuides([]);
      updateNodePosition(node.id, node.position.x, node.position.y);
    },
    [updateNodePosition]
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
        onConnect={handleConnect}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneClick={() => setContextMenu(null)}
        fitView
        deleteKeyCode="Backspace"
      />
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
      style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlowProvider>
        <UmlMarkers />
        <Toolbar />
        <div style={{ flex: 1 }}>
          <FlowCanvas />
        </div>
      </ReactFlowProvider>
    </div>
  );
}

export default App;
