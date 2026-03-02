import { useCallback, useState } from 'react';
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
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
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
