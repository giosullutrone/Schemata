# Schemata Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a visual UML class diagram tool using @xyflow/react for collaborative architecture design with Claude Code.

**Architecture:** Monolithic Vite + React + TypeScript SPA. Zustand manages state (nodes, edges, canvases, undo history). The canvas state is persisted as `.schemata.json` files that Claude Code reads/writes. Custom React Flow nodes render UML class boxes; custom edges render 6 UML relationship types with distinct markers.

**Tech Stack:** Vite, React 19, TypeScript, @xyflow/react, Zustand

---

### Task 1: Scaffold Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Create: `.gitignore`

**Step 1: Scaffold with Vite**

Run:
```bash
cd /Users/giosullutrone/Documents/shared/projects/Schemata
npm create vite@latest . -- --template react-ts
```

If prompted about non-empty directory, choose to proceed (only `docs/` exists).

**Step 2: Install dependencies**

Run:
```bash
npm install @xyflow/react zustand
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Step 3: Configure Vitest**

Add to `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

**Step 4: Create minimal App**

Replace `src/App.tsx`:

```tsx
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlowProvider>
        <ReactFlow />
      </ReactFlowProvider>
    </div>
  );
}

export default App;
```

**Step 5: Verify it runs**

Run: `npm run dev`
Expected: Browser shows empty React Flow canvas with grid background.

**Step 6: Verify tests run**

Run: `npx vitest run`
Expected: Test runner starts (0 tests for now).

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript project with xyflow and zustand"
```

---

### Task 2: TypeScript Schema Types

**Files:**
- Create: `src/types/schema.ts`
- Create: `src/types/schema.test.ts`

**Step 1: Write the test**

Create `src/types/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type {
  Visibility,
  Stereotype,
  RelationshipType,
  ClassProperty,
  MethodParameter,
  ClassMethod,
  ClassNodeData,
  ClassEdgeData,
  CanvasData,
  SchemataFile,
} from './schema';

describe('Schema types', () => {
  it('should allow constructing a valid SchemataFile', () => {
    const file: SchemataFile = {
      version: '1.0',
      name: 'Test Project',
      canvases: {
        main: {
          name: 'Main',
          nodes: [
            {
              id: 'class-1',
              type: 'classNode',
              position: { x: 0, y: 0 },
              data: {
                name: 'UserService',
                stereotype: 'interface',
                comment: 'A service',
                color: '#4A90D9',
                properties: [
                  { name: 'db', type: 'Database', visibility: 'private', comment: 'DB conn' },
                ],
                methods: [
                  {
                    name: 'getUser',
                    parameters: [{ name: 'id', type: 'string' }],
                    returnType: 'User',
                    visibility: 'public',
                    comment: 'Fetches user',
                  },
                ],
              },
            },
          ],
          edges: [
            {
              id: 'edge-1',
              source: 'class-1',
              target: 'class-2',
              type: 'dependency',
              data: { label: 'uses', comment: 'Injected', color: '#E74C3C' },
            },
          ],
        },
      },
    };

    expect(file.version).toBe('1.0');
    expect(file.canvases.main.nodes).toHaveLength(1);
    expect(file.canvases.main.edges).toHaveLength(1);
    expect(file.canvases.main.nodes[0].data.properties[0].visibility).toBe('private');
    expect(file.canvases.main.nodes[0].data.methods[0].parameters).toHaveLength(1);
  });

  it('should allow minimal node data without optional fields', () => {
    const file: SchemataFile = {
      version: '1.0',
      name: 'Minimal',
      canvases: {
        main: {
          name: 'Main',
          nodes: [
            {
              id: 'class-1',
              type: 'classNode',
              position: { x: 0, y: 0 },
              data: {
                name: 'SimpleClass',
                properties: [],
                methods: [],
              },
            },
          ],
          edges: [],
        },
      },
    };

    expect(file.canvases.main.nodes[0].data.stereotype).toBeUndefined();
    expect(file.canvases.main.nodes[0].data.comment).toBeUndefined();
    expect(file.canvases.main.nodes[0].data.color).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/types/schema.test.ts`
Expected: FAIL — cannot find module `./schema`

**Step 3: Write the types**

Create `src/types/schema.ts`:

```ts
export type Visibility = 'public' | 'private' | 'protected';

export type Stereotype = 'interface' | 'abstract' | 'enum';

export type RelationshipType =
  | 'inheritance'
  | 'implementation'
  | 'composition'
  | 'aggregation'
  | 'dependency'
  | 'association';

export interface ClassProperty {
  name: string;
  type: string;
  visibility: Visibility;
  comment?: string;
}

export interface MethodParameter {
  name: string;
  type: string;
}

export interface ClassMethod {
  name: string;
  parameters: MethodParameter[];
  returnType: string;
  visibility: Visibility;
  comment?: string;
}

export interface ClassNodeData {
  name: string;
  stereotype?: Stereotype;
  comment?: string;
  color?: string;
  properties: ClassProperty[];
  methods: ClassMethod[];
}

export interface ClassNodeSchema {
  id: string;
  type: 'classNode';
  position: { x: number; y: number };
  data: ClassNodeData;
}

export interface ClassEdgeData {
  label?: string;
  comment?: string;
  color?: string;
}

export interface ClassEdgeSchema {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  data: ClassEdgeData;
}

export interface CanvasData {
  name: string;
  nodes: ClassNodeSchema[];
  edges: ClassEdgeSchema[];
}

export interface SchemataFile {
  version: string;
  name: string;
  canvases: Record<string, CanvasData>;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/types/schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/schema.ts src/types/schema.test.ts
git commit -m "feat: add TypeScript schema types for Schemata file format"
```

---

### Task 3: Zustand Store — Core State

**Files:**
- Create: `src/store/useCanvasStore.ts`
- Create: `src/store/useCanvasStore.test.ts`

**Step 1: Write the failing test**

Create `src/store/useCanvasStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from './useCanvasStore';

describe('useCanvasStore', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  it('should initialize with a default canvas', () => {
    const state = useCanvasStore.getState();
    expect(state.currentCanvasId).toBe('main');
    expect(state.file.canvases.main).toBeDefined();
    expect(state.file.canvases.main.name).toBe('Main');
    expect(state.file.canvases.main.nodes).toEqual([]);
    expect(state.file.canvases.main.edges).toEqual([]);
  });

  it('should add a class node', () => {
    const { addClassNode } = useCanvasStore.getState();
    addClassNode(100, 200);

    const state = useCanvasStore.getState();
    const nodes = state.file.canvases.main.nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('classNode');
    expect(nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(nodes[0].data.name).toBe('NewClass');
    expect(nodes[0].data.properties).toEqual([]);
    expect(nodes[0].data.methods).toEqual([]);
  });

  it('should remove a node', () => {
    const { addClassNode } = useCanvasStore.getState();
    addClassNode(0, 0);
    const nodeId = useCanvasStore.getState().file.canvases.main.nodes[0].id;

    useCanvasStore.getState().removeNode(nodeId);
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(0);
  });

  it('should remove edges connected to a deleted node', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');

    expect(useCanvasStore.getState().file.canvases.main.edges).toHaveLength(1);

    useCanvasStore.getState().removeNode(nodes[0].id);
    expect(useCanvasStore.getState().file.canvases.main.edges).toHaveLength(0);
  });

  it('should add an edge', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;

    addEdge(nodes[0].id, nodes[1].id, 'inheritance');
    const edges = useCanvasStore.getState().file.canvases.main.edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe('inheritance');
    expect(edges[0].source).toBe(nodes[0].id);
    expect(edges[0].target).toBe(nodes[1].id);
  });

  it('should remove an edge', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    const edgeId = useCanvasStore.getState().file.canvases.main.edges[0].id;

    useCanvasStore.getState().removeEdge(edgeId);
    expect(useCanvasStore.getState().file.canvases.main.edges).toHaveLength(0);
  });

  it('should update node data', () => {
    const { addClassNode } = useCanvasStore.getState();
    addClassNode(0, 0);
    const nodeId = useCanvasStore.getState().file.canvases.main.nodes[0].id;

    useCanvasStore.getState().updateNodeData(nodeId, { name: 'UserService', color: '#4A90D9' });
    const node = useCanvasStore.getState().file.canvases.main.nodes[0];
    expect(node.data.name).toBe('UserService');
    expect(node.data.color).toBe('#4A90D9');
  });

  it('should update edge data', () => {
    const { addClassNode, addEdge } = useCanvasStore.getState();
    addClassNode(0, 0);
    addClassNode(100, 0);
    const nodes = useCanvasStore.getState().file.canvases.main.nodes;
    addEdge(nodes[0].id, nodes[1].id, 'dependency');
    const edgeId = useCanvasStore.getState().file.canvases.main.edges[0].id;

    useCanvasStore.getState().updateEdgeData(edgeId, { label: 'uses', color: '#E74C3C' });
    const edge = useCanvasStore.getState().file.canvases.main.edges[0];
    expect(edge.data.label).toBe('uses');
    expect(edge.data.color).toBe('#E74C3C');
  });

  it('should update node position', () => {
    const { addClassNode } = useCanvasStore.getState();
    addClassNode(0, 0);
    const nodeId = useCanvasStore.getState().file.canvases.main.nodes[0].id;

    useCanvasStore.getState().updateNodePosition(nodeId, 50, 75);
    const node = useCanvasStore.getState().file.canvases.main.nodes[0];
    expect(node.position).toEqual({ x: 50, y: 75 });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/useCanvasStore.test.ts`
Expected: FAIL — cannot find module `./useCanvasStore`

**Step 3: Write the store**

Create `src/store/useCanvasStore.ts`:

```ts
import { create } from 'zustand';
import type {
  SchemataFile,
  ClassNodeData,
  ClassEdgeData,
  RelationshipType,
} from '../types/schema';

let nextNodeId = 1;
let nextEdgeId = 1;

function generateNodeId(): string {
  return `class-${nextNodeId++}`;
}

function generateEdgeId(): string {
  return `edge-${nextEdgeId++}`;
}

function createDefaultFile(): SchemataFile {
  return {
    version: '1.0',
    name: 'Untitled Project',
    canvases: {
      main: {
        name: 'Main',
        nodes: [],
        edges: [],
      },
    },
  };
}

interface CanvasStore {
  file: SchemataFile;
  currentCanvasId: string;

  // Reset (for tests)
  reset: () => void;

  // File operations
  loadFile: (file: SchemataFile) => void;

  // Canvas operations
  setCurrentCanvas: (canvasId: string) => void;
  addCanvas: (id: string, name: string) => void;
  removeCanvas: (id: string) => void;
  renameCanvas: (id: string, name: string) => void;

  // Node operations
  addClassNode: (x: number, y: number) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<ClassNodeData>) => void;
  updateNodePosition: (nodeId: string, x: number, y: number) => void;

  // Edge operations
  addEdge: (source: string, target: string, type: RelationshipType) => void;
  removeEdge: (edgeId: string) => void;
  updateEdgeData: (edgeId: string, data: Partial<ClassEdgeData>) => void;
  updateEdgeType: (edgeId: string, type: RelationshipType) => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  file: createDefaultFile(),
  currentCanvasId: 'main',

  reset: () => {
    nextNodeId = 1;
    nextEdgeId = 1;
    set({ file: createDefaultFile(), currentCanvasId: 'main' });
  },

  loadFile: (file) => {
    const canvasIds = Object.keys(file.canvases);
    set({ file, currentCanvasId: canvasIds[0] || 'main' });
  },

  setCurrentCanvas: (canvasId) => {
    set({ currentCanvasId: canvasId });
  },

  addCanvas: (id, name) => {
    const { file } = get();
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [id]: { name, nodes: [], edges: [] },
        },
      },
    });
  },

  removeCanvas: (id) => {
    const { file, currentCanvasId } = get();
    const { [id]: _, ...rest } = file.canvases;
    const newCurrentId = currentCanvasId === id ? Object.keys(rest)[0] : currentCanvasId;
    set({
      file: { ...file, canvases: rest },
      currentCanvasId: newCurrentId,
    });
  },

  renameCanvas: (id, name) => {
    const { file } = get();
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [id]: { ...file.canvases[id], name },
        },
      },
    });
  },

  addClassNode: (x, y) => {
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    const newNode = {
      id: generateNodeId(),
      type: 'classNode' as const,
      position: { x, y },
      data: {
        name: 'NewClass',
        properties: [],
        methods: [],
      },
    };
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            nodes: [...canvas.nodes, newNode],
          },
        },
      },
    });
  },

  removeNode: (nodeId) => {
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            nodes: canvas.nodes.filter((n) => n.id !== nodeId),
            edges: canvas.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
          },
        },
      },
    });
  },

  updateNodeData: (nodeId, data) => {
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            nodes: canvas.nodes.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
            ),
          },
        },
      },
    });
  },

  updateNodePosition: (nodeId, x, y) => {
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            nodes: canvas.nodes.map((n) =>
              n.id === nodeId ? { ...n, position: { x, y } } : n
            ),
          },
        },
      },
    });
  },

  addEdge: (source, target, type) => {
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    const newEdge = {
      id: generateEdgeId(),
      source,
      target,
      type,
      data: { label: type },
    };
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            edges: [...canvas.edges, newEdge],
          },
        },
      },
    });
  },

  removeEdge: (edgeId) => {
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            edges: canvas.edges.filter((e) => e.id !== edgeId),
          },
        },
      },
    });
  },

  updateEdgeData: (edgeId, data) => {
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            edges: canvas.edges.map((e) =>
              e.id === edgeId ? { ...e, data: { ...e.data, ...data } } : e
            ),
          },
        },
      },
    });
  },

  updateEdgeType: (edgeId, type) => {
    const { file, currentCanvasId } = get();
    const canvas = file.canvases[currentCanvasId];
    set({
      file: {
        ...file,
        canvases: {
          ...file.canvases,
          [currentCanvasId]: {
            ...canvas,
            edges: canvas.edges.map((e) =>
              e.id === edgeId ? { ...e, type } : e
            ),
          },
        },
      },
    });
  },
}));
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/useCanvasStore.test.ts`
Expected: PASS (all 8 tests)

**Step 5: Commit**

```bash
git add src/store/useCanvasStore.ts src/store/useCanvasStore.test.ts
git commit -m "feat: add Zustand store with node, edge, and canvas operations"
```

---

### Task 4: Zustand Store — Canvas Management

**Files:**
- Modify: `src/store/useCanvasStore.test.ts`

**Step 1: Write the failing tests**

Append to `src/store/useCanvasStore.test.ts`:

```ts
describe('Canvas management', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  it('should add a new canvas', () => {
    useCanvasStore.getState().addCanvas('auth', 'Authentication');
    const state = useCanvasStore.getState();
    expect(state.file.canvases.auth).toBeDefined();
    expect(state.file.canvases.auth.name).toBe('Authentication');
    expect(state.file.canvases.auth.nodes).toEqual([]);
  });

  it('should switch current canvas', () => {
    useCanvasStore.getState().addCanvas('auth', 'Authentication');
    useCanvasStore.getState().setCurrentCanvas('auth');
    expect(useCanvasStore.getState().currentCanvasId).toBe('auth');
  });

  it('should remove a canvas and switch to another', () => {
    useCanvasStore.getState().addCanvas('auth', 'Authentication');
    useCanvasStore.getState().setCurrentCanvas('auth');
    useCanvasStore.getState().removeCanvas('auth');

    const state = useCanvasStore.getState();
    expect(state.file.canvases.auth).toBeUndefined();
    expect(state.currentCanvasId).toBe('main');
  });

  it('should rename a canvas', () => {
    useCanvasStore.getState().renameCanvas('main', 'Core Architecture');
    expect(useCanvasStore.getState().file.canvases.main.name).toBe('Core Architecture');
  });

  it('should scope node operations to current canvas', () => {
    useCanvasStore.getState().addCanvas('auth', 'Authentication');
    useCanvasStore.getState().addClassNode(0, 0); // adds to 'main'

    useCanvasStore.getState().setCurrentCanvas('auth');
    useCanvasStore.getState().addClassNode(100, 100); // adds to 'auth'

    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(1);
    expect(useCanvasStore.getState().file.canvases.auth.nodes).toHaveLength(1);
  });

  it('should load a file', () => {
    const file = {
      version: '1.0',
      name: 'Loaded Project',
      canvases: {
        api: {
          name: 'API Layer',
          nodes: [],
          edges: [],
        },
      },
    };
    useCanvasStore.getState().loadFile(file);
    const state = useCanvasStore.getState();
    expect(state.file.name).toBe('Loaded Project');
    expect(state.currentCanvasId).toBe('api');
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/store/useCanvasStore.test.ts`
Expected: PASS (all 14 tests — the store already has these methods)

**Step 3: Commit**

```bash
git add src/store/useCanvasStore.test.ts
git commit -m "test: add canvas management tests"
```

---

### Task 5: File I/O Utilities

**Files:**
- Create: `src/utils/fileIO.ts`
- Create: `src/utils/fileIO.test.ts`

**Step 1: Write the failing test**

Create `src/utils/fileIO.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { serializeFile, deserializeFile, validateFile } from './fileIO';
import type { SchemataFile } from '../types/schema';

const validFile: SchemataFile = {
  version: '1.0',
  name: 'Test',
  canvases: {
    main: {
      name: 'Main',
      nodes: [
        {
          id: 'class-1',
          type: 'classNode',
          position: { x: 0, y: 0 },
          data: { name: 'Foo', properties: [], methods: [] },
        },
      ],
      edges: [],
    },
  },
};

describe('fileIO', () => {
  it('should serialize a file to JSON string', () => {
    const json = serializeFile(validFile);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('1.0');
    expect(parsed.canvases.main.nodes).toHaveLength(1);
  });

  it('should serialize with 2-space indentation', () => {
    const json = serializeFile(validFile);
    expect(json).toContain('  "version"');
  });

  it('should deserialize a valid JSON string', () => {
    const json = JSON.stringify(validFile);
    const result = deserializeFile(json);
    expect(result.name).toBe('Test');
    expect(result.canvases.main.nodes[0].data.name).toBe('Foo');
  });

  it('should throw on invalid JSON', () => {
    expect(() => deserializeFile('not json')).toThrow();
  });

  it('should validate a correct file', () => {
    const errors = validateFile(validFile);
    expect(errors).toEqual([]);
  });

  it('should reject a file without version', () => {
    const bad = { ...validFile, version: undefined } as unknown as SchemataFile;
    const errors = validateFile(bad);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject a file without canvases', () => {
    const bad = { version: '1.0', name: 'X' } as unknown as SchemataFile;
    const errors = validateFile(bad);
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/fileIO.test.ts`
Expected: FAIL — cannot find module `./fileIO`

**Step 3: Write the implementation**

Create `src/utils/fileIO.ts`:

```ts
import type { SchemataFile } from '../types/schema';

export function serializeFile(file: SchemataFile): string {
  return JSON.stringify(file, null, 2);
}

export function deserializeFile(json: string): SchemataFile {
  return JSON.parse(json) as SchemataFile;
}

export function validateFile(file: SchemataFile): string[] {
  const errors: string[] = [];

  if (!file.version) {
    errors.push('Missing "version" field');
  }
  if (!file.name) {
    errors.push('Missing "name" field');
  }
  if (!file.canvases || typeof file.canvases !== 'object') {
    errors.push('Missing or invalid "canvases" field');
    return errors;
  }

  for (const [canvasId, canvas] of Object.entries(file.canvases)) {
    if (!canvas.name) {
      errors.push(`Canvas "${canvasId}" missing "name" field`);
    }
    if (!Array.isArray(canvas.nodes)) {
      errors.push(`Canvas "${canvasId}" missing "nodes" array`);
    }
    if (!Array.isArray(canvas.edges)) {
      errors.push(`Canvas "${canvasId}" missing "edges" array`);
    }
  }

  return errors;
}

export async function saveToFileSystem(file: SchemataFile): Promise<FileSystemFileHandle | null> {
  if (!('showSaveFilePicker' in window)) {
    downloadAsFile(file);
    return null;
  }
  const handle = await window.showSaveFilePicker({
    suggestedName: `${file.name}.schemata.json`,
    types: [
      {
        description: 'Schemata files',
        accept: { 'application/json': ['.schemata.json'] },
      },
    ],
  });
  const writable = await handle.createWritable();
  await writable.write(serializeFile(file));
  await writable.close();
  return handle;
}

export async function writeToHandle(handle: FileSystemFileHandle, file: SchemataFile): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(serializeFile(file));
  await writable.close();
}

export async function loadFromFileSystem(): Promise<{ file: SchemataFile; handle: FileSystemFileHandle } | null> {
  if (!('showOpenFilePicker' in window)) {
    return null;
  }
  const [handle] = await window.showOpenFilePicker({
    types: [
      {
        description: 'Schemata files',
        accept: { 'application/json': ['.schemata.json', '.json'] },
      },
    ],
  });
  const fileObj = await handle.getFile();
  const text = await fileObj.text();
  const parsed = deserializeFile(text);
  return { file: parsed, handle };
}

function downloadAsFile(file: SchemataFile): void {
  const blob = new Blob([serializeFile(file)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${file.name}.schemata.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/fileIO.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/fileIO.ts src/utils/fileIO.test.ts
git commit -m "feat: add file I/O utilities for serialize, deserialize, validate, save, load"
```

---

### Task 6: Custom Class Node Component

**Files:**
- Create: `src/components/ClassNode.tsx`
- Create: `src/components/ClassNode.css`

**Step 1: Create the ClassNode component**

Create `src/components/ClassNode.css`:

```css
.class-node {
  background: #ffffff;
  border: 2px solid #b1b1b7;
  border-radius: 4px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-width: 200px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.class-node.selected {
  border-color: #1a192b;
  box-shadow: 0 0 0 1px #1a192b;
}

.class-node-header {
  padding: 8px 12px;
  text-align: center;
  border-bottom: 1px solid #e2e2e2;
  position: relative;
}

.class-node-stereotype {
  font-size: 10px;
  color: #888;
  font-style: italic;
}

.class-node-name {
  font-weight: 700;
  font-size: 14px;
  cursor: text;
}

.class-node-comment-icon {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  cursor: pointer;
  opacity: 0.3;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
}

.class-node-comment-icon:hover {
  opacity: 1;
  background: #f0f0f0;
}

.class-node-comment-icon.has-comment {
  opacity: 0.7;
}

.class-node-section {
  padding: 6px 12px;
  border-bottom: 1px solid #e2e2e2;
  min-height: 24px;
}

.class-node-section:last-child {
  border-bottom: none;
}

.class-node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  padding: 2px 0;
  position: relative;
}

.class-node-row:hover .class-node-row-remove {
  opacity: 1;
}

.class-node-row-remove {
  position: absolute;
  right: -4px;
  opacity: 0;
  cursor: pointer;
  color: #cc0000;
  font-size: 10px;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
}

.class-node-row-remove:hover {
  background: #fee;
}

.class-node-row-comment {
  opacity: 0;
  cursor: pointer;
  font-size: 10px;
  margin-left: 2px;
}

.class-node-row:hover .class-node-row-comment {
  opacity: 0.4;
}

.class-node-row-comment.has-comment {
  opacity: 0.7;
}

.class-node-add-btn {
  font-size: 11px;
  color: #888;
  cursor: pointer;
  padding: 2px 0;
  text-align: center;
}

.class-node-add-btn:hover {
  color: #333;
}

.class-node-inline-input {
  border: none;
  outline: none;
  background: #f5f5ff;
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  padding: 0;
  width: 100%;
}

.class-node-comment-area {
  background: #fffef0;
  border: 1px solid #e8e4c0;
  border-radius: 3px;
  padding: 6px 8px;
  font-size: 11px;
  font-family: inherit;
  resize: vertical;
  width: 100%;
  min-height: 40px;
  outline: none;
  margin-top: 4px;
}
```

Create `src/components/ClassNode.tsx`:

```tsx
import { memo, useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ClassNodeData, ClassProperty, ClassMethod, Visibility } from '../types/schema';
import { useCanvasStore } from '../store/useCanvasStore';
import './ClassNode.css';

const VISIBILITY_SYMBOL: Record<Visibility, string> = {
  public: '+',
  private: '-',
  protected: '#',
};

type ClassNodeType = {
  id: string;
  type: 'classNode';
  position: { x: number; y: number };
  data: ClassNodeData;
  selected?: boolean;
};

function InlineEdit({
  value,
  onCommit,
  className,
}: {
  value: string;
  onCommit: (val: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [value]);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft.trim() && draft !== value) {
      onCommit(draft.trim());
    }
  }, [draft, value, onCommit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') setEditing(false);
    },
    [commit]
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`class-node-inline-input nodrag ${className || ''}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        autoFocus
      />
    );
  }

  return (
    <span className={className} onDoubleClick={startEdit} style={{ cursor: 'text' }}>
      {value}
    </span>
  );
}

function CommentEditor({
  comment,
  onSave,
}: {
  comment?: string;
  onSave: (comment: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(comment || '');

  const toggle = useCallback(() => {
    if (open) {
      const trimmed = draft.trim();
      onSave(trimmed || undefined);
    } else {
      setDraft(comment || '');
    }
    setOpen(!open);
  }, [open, draft, comment, onSave]);

  return (
    <>
      <span
        className={`class-node-comment-icon ${comment ? 'has-comment' : ''}`}
        onClick={toggle}
        title={comment || 'Add comment'}
      >
        {comment ? '💬' : '💬'}
      </span>
      {open && (
        <textarea
          className="class-node-comment-area nodrag nowheel"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={toggle}
          placeholder="Add a comment..."
          autoFocus
        />
      )}
    </>
  );
}

function PropertyRow({
  property,
  nodeId,
  index,
}: {
  property: ClassProperty;
  nodeId: string;
  index: number;
}) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const file = useCanvasStore((s) => s.file);
  const currentCanvasId = useCanvasStore((s) => s.currentCanvasId);

  const getNode = useCallback(() => {
    return file.canvases[currentCanvasId].nodes.find((n) => n.id === nodeId);
  }, [file, currentCanvasId, nodeId]);

  const updateProperty = useCallback(
    (updates: Partial<ClassProperty>) => {
      const node = getNode();
      if (!node) return;
      const newProperties = [...node.data.properties];
      newProperties[index] = { ...newProperties[index], ...updates };
      updateNodeData(nodeId, { properties: newProperties });
    },
    [getNode, index, nodeId, updateNodeData]
  );

  const removeProperty = useCallback(() => {
    const node = getNode();
    if (!node) return;
    const newProperties = node.data.properties.filter((_, i) => i !== index);
    updateNodeData(nodeId, { properties: newProperties });
  }, [getNode, index, nodeId, updateNodeData]);

  const visSymbol = VISIBILITY_SYMBOL[property.visibility];

  return (
    <div className="class-node-row">
      <span>{visSymbol} </span>
      <InlineEdit
        value={`${property.name}: ${property.type}`}
        onCommit={(val) => {
          const parts = val.split(':').map((s) => s.trim());
          updateProperty({
            name: parts[0] || property.name,
            type: parts[1] || property.type,
          });
        }}
      />
      <CommentEditor
        comment={property.comment}
        onSave={(comment) => updateProperty({ comment })}
      />
      <span className="class-node-row-remove" onClick={removeProperty}>
        ×
      </span>
    </div>
  );
}

function MethodRow({
  method,
  nodeId,
  index,
}: {
  method: ClassMethod;
  nodeId: string;
  index: number;
}) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const file = useCanvasStore((s) => s.file);
  const currentCanvasId = useCanvasStore((s) => s.currentCanvasId);

  const getNode = useCallback(() => {
    return file.canvases[currentCanvasId].nodes.find((n) => n.id === nodeId);
  }, [file, currentCanvasId, nodeId]);

  const updateMethod = useCallback(
    (updates: Partial<ClassMethod>) => {
      const node = getNode();
      if (!node) return;
      const newMethods = [...node.data.methods];
      newMethods[index] = { ...newMethods[index], ...updates };
      updateNodeData(nodeId, { methods: newMethods });
    },
    [getNode, index, nodeId, updateNodeData]
  );

  const removeMethod = useCallback(() => {
    const node = getNode();
    if (!node) return;
    const newMethods = node.data.methods.filter((_, i) => i !== index);
    updateNodeData(nodeId, { methods: newMethods });
  }, [getNode, index, nodeId, updateNodeData]);

  const visSymbol = VISIBILITY_SYMBOL[method.visibility];
  const params = method.parameters.map((p) => `${p.name}: ${p.type}`).join(', ');
  const display = `${method.name}(${params}): ${method.returnType}`;

  return (
    <div className="class-node-row">
      <span>{visSymbol} </span>
      <InlineEdit
        value={display}
        onCommit={(val) => {
          const match = val.match(/^(\w+)\(([^)]*)\):\s*(.+)$/);
          if (match) {
            const [, name, paramStr, returnType] = match;
            const parameters = paramStr
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p) => {
                const [pName, pType] = p.split(':').map((s) => s.trim());
                return { name: pName || '', type: pType || 'void' };
              });
            updateMethod({ name, parameters, returnType: returnType.trim() });
          }
        }}
      />
      <CommentEditor
        comment={method.comment}
        onSave={(comment) => updateMethod({ comment })}
      />
      <span className="class-node-row-remove" onClick={removeMethod}>
        ×
      </span>
    </div>
  );
}

function ClassNodeComponent({ id, data, selected }: NodeProps<ClassNodeType>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const file = useCanvasStore((s) => s.file);
  const currentCanvasId = useCanvasStore((s) => s.currentCanvasId);

  const getNode = useCallback(() => {
    return file.canvases[currentCanvasId].nodes.find((n) => n.id === id);
  }, [file, currentCanvasId, id]);

  const addProperty = useCallback(() => {
    const node = getNode();
    if (!node) return;
    updateNodeData(id, {
      properties: [
        ...node.data.properties,
        { name: 'newProp', type: 'string', visibility: 'private' },
      ],
    });
  }, [getNode, id, updateNodeData]);

  const addMethod = useCallback(() => {
    const node = getNode();
    if (!node) return;
    updateNodeData(id, {
      methods: [
        ...node.data.methods,
        {
          name: 'newMethod',
          parameters: [],
          returnType: 'void',
          visibility: 'public',
        },
      ],
    });
  }, [getNode, id, updateNodeData]);

  const headerStyle = data.color
    ? { borderBottom: `2px solid ${data.color}`, background: `${data.color}11` }
    : {};

  const borderStyle = data.color ? { borderColor: data.color } : {};

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} />
      <div
        className={`class-node ${selected ? 'selected' : ''}`}
        style={borderStyle}
      >
        {/* Header */}
        <div className="class-node-header" style={headerStyle}>
          <CommentEditor
            comment={data.comment}
            onSave={(comment) => updateNodeData(id, { comment })}
          />
          {data.stereotype && (
            <div className="class-node-stereotype">
              <InlineEdit
                value={`«${data.stereotype}»`}
                onCommit={(val) => {
                  const clean = val.replace(/[«»]/g, '').trim();
                  updateNodeData(id, {
                    stereotype: clean as ClassNodeData['stereotype'],
                  });
                }}
              />
            </div>
          )}
          <div className="class-node-name">
            <InlineEdit
              value={data.name}
              onCommit={(name) => updateNodeData(id, { name })}
            />
          </div>
        </div>

        {/* Properties */}
        <div className="class-node-section">
          {data.properties.map((prop, i) => (
            <PropertyRow key={i} property={prop} nodeId={id} index={i} />
          ))}
          <div className="class-node-add-btn" onClick={addProperty}>
            + property
          </div>
        </div>

        {/* Methods */}
        <div className="class-node-section">
          {data.methods.map((method, i) => (
            <MethodRow key={i} method={method} nodeId={id} index={i} />
          ))}
          <div className="class-node-add-btn" onClick={addMethod}>
            + method
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export default memo(ClassNodeComponent);
```

**Step 2: Verify it renders**

Update `src/App.tsx` to use the class node (manual visual test):

```tsx
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
      stereotype: 'interface',
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
```

Run: `npm run dev`
Expected: Browser shows a UML class box with header "«interface» UserService", a properties section with "- db: Database", and a methods section with "+ getUser(id: string): User".

**Step 3: Commit**

```bash
git add src/components/ClassNode.tsx src/components/ClassNode.css src/App.tsx
git commit -m "feat: add ClassNode component with UML three-compartment layout and inline editing"
```

---

### Task 7: Custom Edge Types

**Files:**
- Create: `src/components/edges/UmlEdge.tsx`
- Create: `src/components/edges/UmlEdge.css`
- Create: `src/components/edges/UmlMarkers.tsx`
- Create: `src/components/edges/index.ts`

**Step 1: Create UML SVG markers**

Create `src/components/edges/UmlMarkers.tsx`:

```tsx
export default function UmlMarkers() {
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
      <defs>
        {/* Inheritance: hollow triangle */}
        <marker
          id="uml-inheritance"
          viewBox="0 0 20 20"
          markerWidth={16}
          markerHeight={16}
          refX={20}
          refY={10}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 20 10 L 0 20 Z" fill="white" stroke="currentColor" strokeWidth={1.5} />
        </marker>

        {/* Implementation: hollow triangle (same shape, used on dashed line) */}
        <marker
          id="uml-implementation"
          viewBox="0 0 20 20"
          markerWidth={16}
          markerHeight={16}
          refX={20}
          refY={10}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 20 10 L 0 20 Z" fill="white" stroke="currentColor" strokeWidth={1.5} />
        </marker>

        {/* Composition: filled diamond */}
        <marker
          id="uml-composition"
          viewBox="0 0 20 20"
          markerWidth={16}
          markerHeight={16}
          refX={0}
          refY={10}
          orient="auto-start-reverse"
        >
          <path d="M 10 0 L 20 10 L 10 20 L 0 10 Z" fill="currentColor" stroke="currentColor" strokeWidth={1} />
        </marker>

        {/* Aggregation: hollow diamond */}
        <marker
          id="uml-aggregation"
          viewBox="0 0 20 20"
          markerWidth={16}
          markerHeight={16}
          refX={0}
          refY={10}
          orient="auto-start-reverse"
        >
          <path d="M 10 0 L 20 10 L 10 20 L 0 10 Z" fill="white" stroke="currentColor" strokeWidth={1.5} />
        </marker>

        {/* Dependency: open arrow */}
        <marker
          id="uml-dependency"
          viewBox="0 0 20 20"
          markerWidth={14}
          markerHeight={14}
          refX={20}
          refY={10}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 20 10 L 0 20" fill="none" stroke="currentColor" strokeWidth={1.5} />
        </marker>

        {/* Association: open arrow */}
        <marker
          id="uml-association"
          viewBox="0 0 20 20"
          markerWidth={14}
          markerHeight={14}
          refX={20}
          refY={10}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 20 10 L 0 20" fill="none" stroke="currentColor" strokeWidth={1.5} />
        </marker>
      </defs>
    </svg>
  );
}
```

**Step 2: Create the UML edge component**

Create `src/components/edges/UmlEdge.css`:

```css
.uml-edge-label {
  font-size: 11px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: white;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #e2e2e2;
  pointer-events: all;
  cursor: text;
  position: absolute;
}

.uml-edge-label .class-node-comment-icon {
  position: static;
  display: inline;
  margin-left: 4px;
}
```

Create `src/components/edges/UmlEdge.tsx`:

```tsx
import { memo, useState, useRef, useCallback, type KeyboardEvent } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { ClassEdgeData, RelationshipType } from '../../types/schema';
import { useCanvasStore } from '../../store/useCanvasStore';
import './UmlEdge.css';

interface UmlEdgeConfig {
  strokeDasharray?: string;
  markerEnd?: string;
  markerStart?: string;
}

const EDGE_CONFIG: Record<RelationshipType, UmlEdgeConfig> = {
  inheritance: { markerEnd: 'url(#uml-inheritance)' },
  implementation: { strokeDasharray: '6 3', markerEnd: 'url(#uml-implementation)' },
  composition: { markerStart: 'url(#uml-composition)' },
  aggregation: { markerStart: 'url(#uml-aggregation)' },
  dependency: { strokeDasharray: '6 3', markerEnd: 'url(#uml-dependency)' },
  association: { markerEnd: 'url(#uml-association)' },
};

type UmlEdgeType = {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  data: ClassEdgeData;
};

function UmlEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<UmlEdgeType>) {
  const edgeType = useCanvasStore((s) => {
    const canvas = s.file.canvases[s.currentCanvasId];
    return canvas?.edges.find((e) => e.id === id)?.type || 'association';
  });

  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);

  const config = EDGE_CONFIG[edgeType] || EDGE_CONFIG.association;
  const color = data?.color || '#b1b1b7';
  const selectedColor = '#1a192b';
  const strokeColor = selected ? selectedColor : color;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(data?.label || '');
  const labelInputRef = useRef<HTMLInputElement>(null);

  const startLabelEdit = useCallback(() => {
    setLabelDraft(data?.label || '');
    setEditingLabel(true);
    setTimeout(() => labelInputRef.current?.select(), 0);
  }, [data?.label]);

  const commitLabel = useCallback(() => {
    setEditingLabel(false);
    updateEdgeData(id, { label: labelDraft.trim() || undefined });
  }, [id, labelDraft, updateEdgeData]);

  const handleLabelKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') commitLabel();
      if (e.key === 'Escape') setEditingLabel(false);
    },
    [commitLabel]
  );

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: config.strokeDasharray,
        }}
        markerEnd={config.markerEnd}
        markerStart={config.markerStart}
      />
      {(data?.label || selected) && (
        <EdgeLabelRenderer>
          <div
            className="uml-edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              borderColor: selected ? selectedColor : '#e2e2e2',
            }}
            onDoubleClick={startLabelEdit}
          >
            {editingLabel ? (
              <input
                ref={labelInputRef}
                className="class-node-inline-input nodrag"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={commitLabel}
                onKeyDown={handleLabelKeyDown}
                autoFocus
                style={{ width: '80px', fontSize: '11px' }}
              />
            ) : (
              data?.label || edgeType
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(UmlEdge);
```

**Step 3: Create the edge types index**

Create `src/components/edges/index.ts`:

```ts
import UmlEdge from './UmlEdge';

export const edgeTypes = {
  inheritance: UmlEdge,
  implementation: UmlEdge,
  composition: UmlEdge,
  aggregation: UmlEdge,
  dependency: UmlEdge,
  association: UmlEdge,
};
```

**Step 4: Verify edges render**

Update `src/App.tsx` to include test edges between two nodes:

```tsx
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
```

Run: `npm run dev`
Expected: Two class boxes connected by a solid line with hollow triangle arrow (inheritance).

**Step 5: Commit**

```bash
git add src/components/edges/ src/App.tsx
git commit -m "feat: add UML edge types with distinct markers for all 6 relationship types"
```

---

### Task 8: Toolbar Component

**Files:**
- Create: `src/components/Toolbar.tsx`
- Create: `src/components/Toolbar.css`

**Step 1: Create the Toolbar**

Create `src/components/Toolbar.css`:

```css
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e2e2e2;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  height: 44px;
  flex-shrink: 0;
}

.toolbar-btn {
  padding: 4px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
  color: #333;
}

.toolbar-btn:hover {
  background: #f0f0f0;
  border-color: #b0b0b0;
}

.toolbar-separator {
  width: 1px;
  height: 24px;
  background: #e2e2e2;
}

.toolbar-project-name {
  font-weight: 600;
  margin-right: 8px;
  cursor: text;
}

.toolbar-project-name input {
  border: 1px solid #d0d0d0;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 13px;
  font-weight: 600;
  outline: none;
}
```

Create `src/components/Toolbar.tsx`:

```tsx
import { useCallback, useState, useRef, type KeyboardEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCanvasStore } from '../store/useCanvasStore';
import { saveToFileSystem, loadFromFileSystem, writeToHandle } from '../utils/fileIO';
import './Toolbar.css';

export default function Toolbar() {
  const { screenToFlowPosition } = useReactFlow();
  const file = useCanvasStore((s) => s.file);
  const addClassNode = useCanvasStore((s) => s.addClassNode);
  const loadFile = useCanvasStore((s) => s.loadFile);

  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(file.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleNewClass = useCallback(() => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    addClassNode(center.x - 100, center.y - 50);
  }, [screenToFlowPosition, addClassNode]);

  const handleSave = useCallback(async () => {
    const currentFile = useCanvasStore.getState().file;
    if (fileHandle) {
      await writeToHandle(fileHandle, currentFile);
    } else {
      const handle = await saveToFileSystem(currentFile);
      if (handle) setFileHandle(handle);
    }
  }, [fileHandle]);

  const handleLoad = useCallback(async () => {
    const result = await loadFromFileSystem();
    if (result) {
      loadFile(result.file);
      setFileHandle(result.handle);
    }
  }, [loadFile]);

  const commitName = useCallback(() => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (trimmed) {
      useCanvasStore.setState((state) => ({
        file: { ...state.file, name: trimmed },
      }));
    }
  }, [nameDraft]);

  const handleNameKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') commitName();
      if (e.key === 'Escape') setEditingName(false);
    },
    [commitName]
  );

  return (
    <div className="toolbar">
      {editingName ? (
        <input
          ref={nameInputRef}
          className="toolbar-project-name"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={handleNameKeyDown}
          autoFocus
        />
      ) : (
        <span
          className="toolbar-project-name"
          onDoubleClick={() => {
            setNameDraft(file.name);
            setEditingName(true);
          }}
        >
          {file.name}
        </span>
      )}

      <div className="toolbar-separator" />

      <button className="toolbar-btn" onClick={handleNewClass}>
        + New Class
      </button>

      <div className="toolbar-separator" />

      <button className="toolbar-btn" onClick={handleSave}>
        Save
      </button>
      <button className="toolbar-btn" onClick={handleLoad}>
        Load
      </button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/Toolbar.tsx src/components/Toolbar.css
git commit -m "feat: add Toolbar with new class, save, load, and project name editing"
```

---

### Task 9: Canvas Selector Component

**Files:**
- Create: `src/components/CanvasSelector.tsx`
- Create: `src/components/CanvasSelector.css`

**Step 1: Create the component**

Create `src/components/CanvasSelector.css`:

```css
.canvas-selector {
  position: relative;
}

.canvas-selector-btn {
  padding: 4px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
  color: #333;
  display: flex;
  align-items: center;
  gap: 4px;
}

.canvas-selector-btn:hover {
  background: #f0f0f0;
}

.canvas-selector-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  min-width: 180px;
  z-index: 100;
}

.canvas-selector-item {
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.canvas-selector-item:hover {
  background: #f5f5f5;
}

.canvas-selector-item.active {
  background: #eef2ff;
  font-weight: 600;
}

.canvas-selector-item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
}

.canvas-selector-item:hover .canvas-selector-item-actions {
  opacity: 1;
}

.canvas-selector-item-action {
  font-size: 10px;
  color: #888;
  cursor: pointer;
  padding: 2px;
}

.canvas-selector-item-action:hover {
  color: #333;
}

.canvas-selector-new {
  padding: 6px 12px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  border-top: 1px solid #e2e2e2;
}

.canvas-selector-new:hover {
  background: #f5f5f5;
}
```

Create `src/components/CanvasSelector.tsx`:

```tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import './CanvasSelector.css';

export default function CanvasSelector() {
  const file = useCanvasStore((s) => s.file);
  const currentCanvasId = useCanvasStore((s) => s.currentCanvasId);
  const setCurrentCanvas = useCanvasStore((s) => s.setCurrentCanvas);
  const addCanvas = useCanvasStore((s) => s.addCanvas);
  const removeCanvas = useCanvasStore((s) => s.removeCanvas);
  const renameCanvas = useCanvasStore((s) => s.renameCanvas);

  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentCanvas = file.canvases[currentCanvasId];
  const canvasEntries = Object.entries(file.canvases);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSelect = useCallback(
    (id: string) => {
      setCurrentCanvas(id);
      setOpen(false);
    },
    [setCurrentCanvas]
  );

  const handleNewCanvas = useCallback(() => {
    const name = prompt('Canvas name:');
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, '-');
    addCanvas(id, name);
    setCurrentCanvas(id);
    setOpen(false);
  }, [addCanvas, setCurrentCanvas]);

  const handleRename = useCallback(
    (id: string) => {
      if (renameDraft.trim()) {
        renameCanvas(id, renameDraft.trim());
      }
      setRenamingId(null);
    },
    [renameDraft, renameCanvas]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (canvasEntries.length <= 1) return;
      removeCanvas(id);
    },
    [canvasEntries.length, removeCanvas]
  );

  return (
    <div className="canvas-selector" ref={dropdownRef}>
      <button className="canvas-selector-btn" onClick={() => setOpen(!open)}>
        {currentCanvas?.name || 'Canvas'} ▾
      </button>
      {open && (
        <div className="canvas-selector-dropdown">
          {canvasEntries.map(([id, canvas]) => (
            <div
              key={id}
              className={`canvas-selector-item ${id === currentCanvasId ? 'active' : ''}`}
              onClick={() => handleSelect(id)}
            >
              {renamingId === id ? (
                <input
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={() => handleRename(id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  style={{ fontSize: '12px', width: '100px' }}
                />
              ) : (
                <span>{canvas.name}</span>
              )}
              <span className="canvas-selector-item-actions">
                <span
                  className="canvas-selector-item-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameDraft(canvas.name);
                    setRenamingId(id);
                  }}
                >
                  ✏
                </span>
                {canvasEntries.length > 1 && (
                  <span
                    className="canvas-selector-item-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(id);
                    }}
                  >
                    ✕
                  </span>
                )}
              </span>
            </div>
          ))}
          <div className="canvas-selector-new" onClick={handleNewCanvas}>
            + New Canvas
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add CanvasSelector to Toolbar**

In `src/components/Toolbar.tsx`, import and add:

```tsx
import CanvasSelector from './CanvasSelector';
```

Add inside the toolbar div, after the Load button:

```tsx
<div className="toolbar-separator" />
<CanvasSelector />
```

**Step 3: Commit**

```bash
git add src/components/CanvasSelector.tsx src/components/CanvasSelector.css src/components/Toolbar.tsx
git commit -m "feat: add CanvasSelector dropdown with create, rename, and delete"
```

---

### Task 10: Wire Everything Together in App.tsx

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Step 1: Create the integrated App**

Replace `src/App.tsx`:

```tsx
import { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  type OnConnect,
  type Connection,
  useReactFlow,
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
```

Replace `src/index.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

**Step 2: Verify the full app works**

Run: `npm run dev`
Expected: Toolbar at top with project name, New Class button, Save, Load, and canvas selector. Canvas fills remaining space. Can add classes, connect them, edit inline.

**Step 3: Commit**

```bash
git add src/App.tsx src/index.css
git commit -m "feat: integrate all components into full working app"
```

---

### Task 11: Context Menu for Nodes and Edges

**Files:**
- Create: `src/components/ContextMenu.tsx`
- Create: `src/components/ContextMenu.css`
- Modify: `src/App.tsx`

**Step 1: Create the context menu**

Create `src/components/ContextMenu.css`:

```css
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  min-width: 160px;
  z-index: 1000;
  padding: 4px 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
}

.context-menu-item {
  padding: 6px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.context-menu-item:hover {
  background: #f0f0f0;
}

.context-menu-separator {
  height: 1px;
  background: #e2e2e2;
  margin: 4px 0;
}

.context-menu-item.danger {
  color: #cc0000;
}

.context-menu-color-row {
  display: flex;
  gap: 4px;
  padding: 6px 16px;
}

.context-menu-color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid #d0d0d0;
  cursor: pointer;
}

.context-menu-color-swatch:hover {
  border-color: #333;
}
```

Create `src/components/ContextMenu.tsx`:

```tsx
import { useEffect, useRef, useCallback } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { RelationshipType } from '../types/schema';
import './ContextMenu.css';

const COLORS = ['#4A90D9', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#34495E', '#E67E22'];

const RELATIONSHIP_TYPES: RelationshipType[] = [
  'inheritance', 'implementation', 'composition', 'aggregation', 'dependency', 'association',
];

interface ContextMenuProps {
  x: number;
  y: number;
  type: 'node' | 'edge';
  targetId: string;
  onClose: () => void;
}

export default function ContextMenu({ x, y, type, targetId, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);
  const updateEdgeType = useCanvasStore((s) => s.updateEdgeType);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const handleColorSelect = useCallback(
    (color: string) => {
      if (type === 'node') {
        updateNodeData(targetId, { color });
      } else {
        updateEdgeData(targetId, { color });
      }
      onClose();
    },
    [type, targetId, updateNodeData, updateEdgeData, onClose]
  );

  const handleDelete = useCallback(() => {
    if (type === 'node') {
      removeNode(targetId);
    } else {
      removeEdge(targetId);
    }
    onClose();
  }, [type, targetId, removeNode, removeEdge, onClose]);

  const handleChangeType = useCallback(
    (newType: RelationshipType) => {
      updateEdgeType(targetId, newType);
      onClose();
    },
    [targetId, updateEdgeType, onClose]
  );

  const handleAddStereotype = useCallback(() => {
    updateNodeData(targetId, { stereotype: 'interface' });
    onClose();
  }, [targetId, updateNodeData, onClose]);

  return (
    <div className="context-menu" ref={ref} style={{ left: x, top: y }}>
      {/* Color picker */}
      <div className="context-menu-color-row">
        {COLORS.map((color) => (
          <div
            key={color}
            className="context-menu-color-swatch"
            style={{ background: color }}
            onClick={() => handleColorSelect(color)}
          />
        ))}
      </div>
      <div className="context-menu-separator" />

      {type === 'node' && (
        <>
          <div className="context-menu-item" onClick={handleAddStereotype}>
            Set stereotype
          </div>
          <div className="context-menu-separator" />
        </>
      )}

      {type === 'edge' && (
        <>
          {RELATIONSHIP_TYPES.map((rt) => (
            <div key={rt} className="context-menu-item" onClick={() => handleChangeType(rt)}>
              → {rt}
            </div>
          ))}
          <div className="context-menu-separator" />
        </>
      )}

      <div className="context-menu-item danger" onClick={handleDelete}>
        Delete
      </div>
    </div>
  );
}
```

**Step 2: Wire context menu into App.tsx**

Add context menu state and handlers to `FlowCanvas` in `src/App.tsx`. Add `onNodeContextMenu` and `onEdgeContextMenu` props to `<ReactFlow>`, render `<ContextMenu>` conditionally.

**Step 3: Commit**

```bash
git add src/components/ContextMenu.tsx src/components/ContextMenu.css src/App.tsx
git commit -m "feat: add context menu with color picker, edge type changer, and delete"
```

---

### Task 12: Edge Creation Popup (Replace prompt())

**Files:**
- Create: `src/components/EdgeTypePopup.tsx`
- Create: `src/components/EdgeTypePopup.css`
- Modify: `src/App.tsx`

**Step 1: Create the popup**

Create `src/components/EdgeTypePopup.css`:

```css
.edge-type-popup {
  position: fixed;
  background: white;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  min-width: 150px;
}

.edge-type-popup-item {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.edge-type-popup-item:hover {
  background: #f0f0f0;
}

.edge-type-popup-item-icon {
  width: 24px;
  font-size: 10px;
  color: #888;
}
```

Create `src/components/EdgeTypePopup.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import type { RelationshipType } from '../types/schema';
import './EdgeTypePopup.css';

const EDGE_OPTIONS: { type: RelationshipType; label: string; icon: string }[] = [
  { type: 'inheritance', label: 'Inherits', icon: '△' },
  { type: 'implementation', label: 'Implements', icon: '▷' },
  { type: 'composition', label: 'Composition', icon: '◆' },
  { type: 'aggregation', label: 'Aggregation', icon: '◇' },
  { type: 'dependency', label: 'Dependency', icon: '⇢' },
  { type: 'association', label: 'Association', icon: '→' },
];

interface EdgeTypePopupProps {
  x: number;
  y: number;
  onSelect: (type: RelationshipType) => void;
  onClose: () => void;
}

export default function EdgeTypePopup({ x, y, onSelect, onClose }: EdgeTypePopupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div className="edge-type-popup" ref={ref} style={{ left: x, top: y }}>
      {EDGE_OPTIONS.map(({ type, label, icon }) => (
        <div key={type} className="edge-type-popup-item" onClick={() => onSelect(type)}>
          <span className="edge-type-popup-item-icon">{icon}</span>
          {label}
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Replace the prompt() in App.tsx's handleConnect**

Replace the `prompt()` call with state-driven popup: store pending connection in state, show `<EdgeTypePopup>` at mouse position, on select call `addEdge` and clear state.

**Step 3: Commit**

```bash
git add src/components/EdgeTypePopup.tsx src/components/EdgeTypePopup.css src/App.tsx
git commit -m "feat: replace prompt() with EdgeTypePopup for relationship type selection"
```

---

### Task 13: Alignment Guides

**Files:**
- Create: `src/components/AlignmentGuides.tsx`
- Create: `src/components/AlignmentGuides.css`
- Create: `src/utils/alignment.ts`
- Create: `src/utils/alignment.test.ts`
- Modify: `src/App.tsx`

**Step 1: Write the failing test for alignment calculation**

Create `src/utils/alignment.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calculateGuides, type NodeRect, type GuideLine } from './alignment';

describe('calculateGuides', () => {
  const dragged: NodeRect = { id: 'a', x: 100, y: 100, width: 200, height: 150 };

  it('should return empty guides when no other nodes exist', () => {
    const guides = calculateGuides(dragged, []);
    expect(guides).toEqual([]);
  });

  it('should detect horizontal top alignment', () => {
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 100, width: 200, height: 150 }];
    const guides = calculateGuides(dragged, others);
    const horizontals = guides.filter((g) => g.orientation === 'horizontal');
    expect(horizontals.some((g) => g.pos === 100)).toBe(true);
  });

  it('should detect vertical left alignment', () => {
    const others: NodeRect[] = [{ id: 'b', x: 100, y: 400, width: 200, height: 150 }];
    const guides = calculateGuides(dragged, others);
    const verticals = guides.filter((g) => g.orientation === 'vertical');
    expect(verticals.some((g) => g.pos === 100)).toBe(true);
  });

  it('should detect center alignment', () => {
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 400, width: 200, height: 150 }];
    const guides = calculateGuides(dragged, others);
    // Horizontal center: 100 + 75 = 175 vs 400 + 75 = 475 → no match
    // Vertical center: 100 + 100 = 200 vs 400 + 100 = 500 → no match
    expect(guides).toEqual([]);
  });

  it('should detect center alignment when centers match', () => {
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 100, width: 200, height: 150 }];
    // Horizontal center: dragged = 100 + 75 = 175, other = 100 + 75 = 175 → match
    const guides = calculateGuides(dragged, others);
    const horizontals = guides.filter((g) => g.orientation === 'horizontal');
    expect(horizontals.length).toBeGreaterThan(0);
  });

  it('should snap within threshold', () => {
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 103, width: 200, height: 150 }];
    const guides = calculateGuides(dragged, others, 5);
    const horizontals = guides.filter((g) => g.orientation === 'horizontal');
    // 100 vs 103 → within 5px threshold
    expect(horizontals.length).toBeGreaterThan(0);
  });

  it('should not snap outside threshold', () => {
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 110, width: 200, height: 150 }];
    const guides = calculateGuides(dragged, others, 5);
    expect(guides).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/alignment.test.ts`
Expected: FAIL — cannot find module `./alignment`

**Step 3: Write the implementation**

Create `src/utils/alignment.ts`:

```ts
export interface NodeRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GuideLine {
  orientation: 'horizontal' | 'vertical';
  pos: number;
}

export function calculateGuides(
  dragged: NodeRect,
  others: NodeRect[],
  threshold: number = 5
): GuideLine[] {
  const guides: GuideLine[] = [];

  const draggedCenterX = dragged.x + dragged.width / 2;
  const draggedCenterY = dragged.y + dragged.height / 2;
  const draggedRight = dragged.x + dragged.width;
  const draggedBottom = dragged.y + dragged.height;

  for (const other of others) {
    if (other.id === dragged.id) continue;

    const otherCenterX = other.x + other.width / 2;
    const otherCenterY = other.y + other.height / 2;
    const otherRight = other.x + other.width;
    const otherBottom = other.y + other.height;

    // Horizontal guides (y-axis alignment)
    const hChecks = [
      { dragVal: dragged.y, otherVal: other.y },       // top-top
      { dragVal: dragged.y, otherVal: otherBottom },    // top-bottom
      { dragVal: draggedBottom, otherVal: other.y },    // bottom-top
      { dragVal: draggedBottom, otherVal: otherBottom }, // bottom-bottom
      { dragVal: draggedCenterY, otherVal: otherCenterY }, // center-center
    ];

    for (const { dragVal, otherVal } of hChecks) {
      if (Math.abs(dragVal - otherVal) <= threshold) {
        if (!guides.some((g) => g.orientation === 'horizontal' && g.pos === otherVal)) {
          guides.push({ orientation: 'horizontal', pos: otherVal });
        }
      }
    }

    // Vertical guides (x-axis alignment)
    const vChecks = [
      { dragVal: dragged.x, otherVal: other.x },       // left-left
      { dragVal: dragged.x, otherVal: otherRight },     // left-right
      { dragVal: draggedRight, otherVal: other.x },     // right-left
      { dragVal: draggedRight, otherVal: otherRight },   // right-right
      { dragVal: draggedCenterX, otherVal: otherCenterX }, // center-center
    ];

    for (const { dragVal, otherVal } of vChecks) {
      if (Math.abs(dragVal - otherVal) <= threshold) {
        if (!guides.some((g) => g.orientation === 'vertical' && g.pos === otherVal)) {
          guides.push({ orientation: 'vertical', pos: otherVal });
        }
      }
    }
  }

  return guides;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/alignment.test.ts`
Expected: PASS

**Step 5: Create the visual overlay**

Create `src/components/AlignmentGuides.css`:

```css
.alignment-guide {
  position: absolute;
  pointer-events: none;
  z-index: 5;
}

.alignment-guide.horizontal {
  left: 0;
  right: 0;
  height: 1px;
  border-top: 1px dashed #4A90D9;
}

.alignment-guide.vertical {
  top: 0;
  bottom: 0;
  width: 1px;
  border-left: 1px dashed #4A90D9;
}
```

Create `src/components/AlignmentGuides.tsx`:

```tsx
import type { GuideLine } from '../utils/alignment';
import { useReactFlow } from '@xyflow/react';
import './AlignmentGuides.css';

interface AlignmentGuidesProps {
  guides: GuideLine[];
}

export default function AlignmentGuides({ guides }: AlignmentGuidesProps) {
  const { flowToScreenPosition } = useReactFlow();

  return (
    <>
      {guides.map((guide, i) => {
        if (guide.orientation === 'horizontal') {
          const screenPos = flowToScreenPosition({ x: 0, y: guide.pos });
          return (
            <div
              key={`h-${i}`}
              className="alignment-guide horizontal"
              style={{ top: screenPos.y }}
            />
          );
        } else {
          const screenPos = flowToScreenPosition({ x: guide.pos, y: 0 });
          return (
            <div
              key={`v-${i}`}
              className="alignment-guide vertical"
              style={{ left: screenPos.x }}
            />
          );
        }
      })}
    </>
  );
}
```

**Step 6: Wire into App.tsx**

Add `onNodeDrag` handler to calculate guides using `calculateGuides()`, store in state, pass to `<AlignmentGuides>`. Clear guides on `onNodeDragStop`.

**Step 7: Commit**

```bash
git add src/utils/alignment.ts src/utils/alignment.test.ts src/components/AlignmentGuides.tsx src/components/AlignmentGuides.css src/App.tsx
git commit -m "feat: add alignment guides that appear when dragging nodes"
```

---

### Task 14: Auto-Save with Debounce

**Files:**
- Create: `src/utils/debounce.ts`
- Create: `src/utils/debounce.test.ts`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

Create `src/utils/debounce.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  it('should delay execution', async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 150));
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should only call once for rapid invocations', async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    await new Promise((r) => setTimeout(r, 150));
    expect(fn).toHaveBeenCalledOnce();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/debounce.test.ts`
Expected: FAIL — cannot find module `./debounce`

**Step 3: Write the implementation**

Create `src/utils/debounce.ts`:

```ts
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/debounce.test.ts`
Expected: PASS

**Step 5: Wire auto-save into App**

In `src/App.tsx`, add a `useEffect` that subscribes to Zustand store changes and calls a debounced `writeToHandle` when a file handle is open.

**Step 6: Commit**

```bash
git add src/utils/debounce.ts src/utils/debounce.test.ts src/App.tsx
git commit -m "feat: add debounced auto-save when file handle is open"
```

---

### Task 15: Undo/Redo

**Files:**
- Create: `src/store/undoMiddleware.ts`
- Create: `src/store/undoMiddleware.test.ts`
- Modify: `src/store/useCanvasStore.ts`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

Create `src/store/undoMiddleware.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from './useCanvasStore';

describe('Undo/Redo', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  it('should undo adding a node', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(1);

    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(0);
  });

  it('should redo after undo', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(0);

    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(1);
  });

  it('should clear redo stack on new action', () => {
    useCanvasStore.getState().addClassNode(0, 0);
    useCanvasStore.getState().undo();
    useCanvasStore.getState().addClassNode(100, 100);

    useCanvasStore.getState().redo(); // should do nothing
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(1);
  });

  it('should not fail on undo with empty history', () => {
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().file.canvases.main.nodes).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/undoMiddleware.test.ts`
Expected: FAIL — `undo` is not a function

**Step 3: Add undo/redo to the store**

Modify `src/store/useCanvasStore.ts` to add:

```ts
// Add to interface:
undo: () => void;
redo: () => void;

// Add state:
_undoStack: SchemataFile[];
_redoStack: SchemataFile[];
```

Before each mutating action, push the current `file` to `_undoStack` and clear `_redoStack`. `undo` pops from `_undoStack`, pushes current to `_redoStack`. `redo` does the reverse.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/undoMiddleware.test.ts`
Expected: PASS

**Step 5: Add keyboard shortcuts in App.tsx**

Add a `useEffect` that listens for `Ctrl+Z` (undo) and `Ctrl+Shift+Z` (redo) and calls the store methods.

**Step 6: Commit**

```bash
git add src/store/useCanvasStore.ts src/store/undoMiddleware.test.ts src/App.tsx
git commit -m "feat: add undo/redo with Ctrl+Z and Ctrl+Shift+Z"
```

---

### Task 16: Keyboard Shortcut — Ctrl+S to Save

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add Ctrl+S handler**

In `src/App.tsx`, in the keyboard event `useEffect`, add handling for `Ctrl+S` / `Cmd+S` that prevents default and triggers save.

**Step 2: Verify manually**

Run: `npm run dev`
Press Ctrl+S → should trigger save dialog or write to existing handle.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add Ctrl+S keyboard shortcut for save"
```

---

### Task 17: Drag-and-Drop File Loading

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add drag-and-drop handlers**

In `src/App.tsx`, add `onDragOver` and `onDrop` handlers to the root div. On drop, read the file, parse JSON, validate, and call `loadFile`.

**Step 2: Verify manually**

Run: `npm run dev`
Drag a `.schemata.json` file onto the canvas → should load it.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add drag-and-drop file loading"
```

---

### Task 18: Final Cleanup and All Tests Green

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 3: Run dev server and full manual test**

Run: `npm run dev`
Verify:
- Create classes with "New Class" button
- Double-click to edit class names, properties, methods
- Add/remove properties and methods
- Connect nodes by dragging handles → relationship popup
- All 6 edge types render with correct markers
- Right-click nodes and edges for context menu
- Color picker works
- Comments can be added/edited on nodes, properties, methods
- Canvas selector: create, rename, delete, switch canvases
- Save/Load works
- Drag-and-drop a file works
- Undo/Redo with Ctrl+Z / Ctrl+Shift+Z
- Ctrl+S saves
- Alignment guides appear when dragging nodes near other nodes

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: final cleanup, all tests passing"
```
