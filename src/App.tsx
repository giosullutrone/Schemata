import { useCallback } from 'react';
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
import { useCanvasStore } from './store/useCanvasStore';
import type { RelationshipType } from './types/schema';

const nodeTypes = { classNode: ClassNode };

const RELATIONSHIP_OPTIONS: RelationshipType[] = [
  'inheritance',
  'implementation',
  'composition',
  'aggregation',
  'dependency',
  'association',
];

function FlowCanvas() {
  const file = useCanvasStore((s) => s.file);
  const currentCanvasId = useCanvasStore((s) => s.currentCanvasId);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const updateNodePosition = useCanvasStore((s) => s.updateNodePosition);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const removeEdge = useCanvasStore((s) => s.removeEdge);

  const canvas = file.canvases[currentCanvasId];
  if (!canvas) return null;

  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const type = prompt(
        `Relationship type:\n${RELATIONSHIP_OPTIONS.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nEnter number (1-6):`
      );

      const index = parseInt(type || '', 10) - 1;
      if (index >= 0 && index < RELATIONSHIP_OPTIONS.length) {
        addEdge(connection.source, connection.target, RELATIONSHIP_OPTIONS[index]);
      }
    },
    [addEdge]
  );

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: { id: string; position: { x: number; y: number } }) => {
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

  return (
    <ReactFlow
      nodes={canvas.nodes}
      edges={canvas.edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onConnect={handleConnect}
      onNodeDragStop={handleNodeDragStop}
      onNodesDelete={handleNodesDelete}
      onEdgesDelete={handleEdgesDelete}
      fitView
      deleteKeyCode="Backspace"
    />
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
