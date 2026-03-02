import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ClassNode from './components/ClassNode';

const nodeTypes = { classNode: ClassNode };

const testNodes = [
  {
    id: 'class-1',
    type: 'classNode',
    position: { x: 100, y: 100 },
    data: {
      name: 'UserService',
      stereotype: 'interface' as const,
      comment: 'Handles users',
      color: '#4A90D9',
      properties: [
        { name: 'db', type: 'Database', visibility: 'private' as const },
      ],
      methods: [
        {
          name: 'getUser',
          parameters: [{ name: 'id', type: 'string' }],
          returnType: 'User',
          visibility: 'public' as const,
        },
      ],
    },
  },
];

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlowProvider>
        <ReactFlow nodes={testNodes} nodeTypes={nodeTypes} fitView />
      </ReactFlowProvider>
    </div>
  );
}

export default App;
