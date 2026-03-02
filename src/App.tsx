import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ClassNode from './components/ClassNode';
import { edgeTypes } from './components/edges';
import UmlMarkers from './components/edges/UmlMarkers';

const nodeTypes = { classNode: ClassNode };

const testNodes = [
  {
    id: 'class-1',
    type: 'classNode',
    position: { x: 50, y: 50 },
    data: {
      name: 'Animal',
      properties: [
        { name: 'name', type: 'string', visibility: 'protected' as const },
      ],
      methods: [
        {
          name: 'speak',
          parameters: [],
          returnType: 'string',
          visibility: 'public' as const,
        },
      ],
    },
  },
  {
    id: 'class-2',
    type: 'classNode',
    position: { x: 400, y: 50 },
    data: {
      name: 'Dog',
      properties: [],
      methods: [
        {
          name: 'speak',
          parameters: [],
          returnType: 'string',
          visibility: 'public' as const,
        },
      ],
    },
  },
];

const testEdges = [
  {
    id: 'edge-1',
    source: 'class-2',
    target: 'class-1',
    type: 'inheritance',
    data: { label: 'extends' },
  },
];

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlowProvider>
        <UmlMarkers />
        <ReactFlow
          nodes={testNodes}
          edges={testEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
        />
      </ReactFlowProvider>
    </div>
  );
}

export default App;
