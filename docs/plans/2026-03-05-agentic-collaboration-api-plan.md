# Agentic Collaboration API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a REST API to CodeCanvas so external LLM agents can read and manipulate the canvas via HTTP endpoints.

**Architecture:** Hono HTTP server runs as Vite middleware on the same port as the dev server. It communicates with the browser's Zustand store via Vite's HMR WebSocket channel (bridge pattern). 31 REST endpoints wrap store actions directly.

**Tech Stack:** Hono (HTTP framework), Vite plugin API (`configureServer`), Vite HMR custom events (`server.ws` / `import.meta.hot`)

**Design doc:** `docs/plans/2026-03-05-agentic-collaboration-api-design.md`

---

### Task 1: Install Hono + Vite Plugin Skeleton

**Files:**
- Create: `src/server/plugin.ts`
- Create: `src/server/app.ts`
- Modify: `vite.config.ts`
- Modify: `package.json`

**Step 1: Install Hono**

```bash
npm install hono
```

**Step 2: Create the Hono app with a health endpoint**

Create `src/server/app.ts`:

```typescript
import { Hono } from 'hono';

const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ status: 'ok' }));

export { app };
```

**Step 3: Create the Vite plugin**

Create `src/server/plugin.ts`. This plugin hooks into Vite's `configureServer` to add middleware that forwards `/api/*` requests to Hono.

```typescript
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage } from 'node:http';
import { app } from './app.js';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
  });
}

export default function canvasApiPlugin(): Plugin {
  return {
    name: 'canvas-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) return next();

        const url = `http://localhost${req.url}`;
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value) headers.set(key, Array.isArray(value) ? value[0] : value);
        }

        let body: string | undefined;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          body = await readBody(req);
        }

        const fetchReq = new Request(url, { method: req.method, headers, body });
        const fetchRes = await app.fetch(fetchReq);

        res.statusCode = fetchRes.status;
        fetchRes.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await fetchRes.text());
      });
    },
  };
}
```

**Step 4: Wire the plugin into vite.config.ts**

Add the plugin import and register it. The current `vite.config.ts` (line 1-13) uses `@vitejs/plugin-react`. Add our plugin:

```typescript
import canvasApiPlugin from './src/server/plugin';

export default defineConfig({
  plugins: [react(), canvasApiPlugin()],
  // ... rest unchanged
});
```

**Step 5: Verify the health endpoint works**

```bash
npm run dev &
# Wait for server to start
curl http://localhost:5173/api/health
# Expected: {"status":"ok"}
```

**Step 6: Commit**

```bash
git add package.json package-lock.json src/server/ vite.config.ts
git commit -m "feat: add Hono server as Vite plugin with health endpoint"
```

---

### Task 2: Bridge Layer (Server + Client)

The bridge enables the Node.js Vite server to call Zustand store actions running in the browser. It uses Vite's HMR custom events for communication.

**Files:**
- Create: `src/server/bridge.ts` (server side)
- Create: `src/bridge/client.ts` (browser side)
- Create: `src/server/bridge.test.ts`
- Modify: `src/main.tsx` (import bridge client)

**Step 1: Write bridge server-side tests**

Create `src/server/bridge.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initBridge, callStore, resetBridge } from './bridge';

function createMockWs() {
  const listeners = new Map<string, Function>();
  return {
    on: vi.fn((event: string, cb: Function) => { listeners.set(event, cb); }),
    send: vi.fn(),
    _trigger: (event: string, data: unknown) => listeners.get(event)?.(data, {}),
  };
}

describe('bridge', () => {
  let ws: ReturnType<typeof createMockWs>;

  beforeEach(() => {
    ws = createMockWs();
    resetBridge();
    initBridge(ws as never);
  });

  it('sends request over WebSocket and resolves on response', async () => {
    const promise = callStore('getNodes', []);

    expect(ws.send).toHaveBeenCalledWith('canvas:request', expect.objectContaining({
      action: 'getNodes',
      args: [],
    }));

    const sentData = ws.send.mock.calls[0][1];
    ws._trigger('canvas:response', { id: sentData.id, result: [{ id: 'class-1' }] });

    const result = await promise;
    expect(result).toEqual([{ id: 'class-1' }]);
  });

  it('rejects on error response', async () => {
    const promise = callStore('badAction', []);
    const sentData = ws.send.mock.calls[0][1];
    ws._trigger('canvas:response', { id: sentData.id, error: 'Unknown action' });

    await expect(promise).rejects.toThrow('Unknown action');
  });

  it('rejects on timeout', async () => {
    vi.useFakeTimers();
    const promise = callStore('getNodes', []);
    vi.advanceTimersByTime(10_000);
    await expect(promise).rejects.toThrow('Bridge timeout');
    vi.useRealTimers();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/server/bridge.test.ts
# Expected: FAIL — module not found
```

**Step 3: Implement server-side bridge**

Create `src/server/bridge.ts`:

```typescript
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

interface ViteWs {
  on: (event: string, cb: (data: unknown, client: unknown) => void) => void;
  send: (event: string, data: unknown) => void;
}

const pending = new Map<string, PendingRequest>();
let viteWs: ViteWs | null = null;
let idCounter = 0;

export function initBridge(ws: ViteWs): void {
  viteWs = ws;
  ws.on('canvas:response', (data: unknown) => {
    const { id, result, error } = data as { id: string; result?: unknown; error?: string };
    const req = pending.get(id);
    if (!req) return;
    pending.delete(id);
    clearTimeout(req.timer);
    if (error) req.reject(new Error(error));
    else req.resolve(result);
  });
}

export function callStore(action: string, args: unknown[] = []): Promise<unknown> {
  if (!viteWs) return Promise.reject(new Error('Bridge not initialized'));
  return new Promise((resolve, reject) => {
    const id = `req-${++idCounter}`;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Bridge timeout — is the browser tab open?'));
    }, 10_000);
    pending.set(id, { resolve, reject, timer });
    viteWs!.send('canvas:request', { id, action, args });
  });
}

export function resetBridge(): void {
  for (const req of pending.values()) {
    clearTimeout(req.timer);
  }
  pending.clear();
  viteWs = null;
  idCounter = 0;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/server/bridge.test.ts
# Expected: 3 tests PASS
```

**Step 5: Create browser-side bridge client**

Create `src/bridge/client.ts`. This listens for HMR requests and dispatches to the Zustand store:

```typescript
import { useCanvasStore } from '../store/useCanvasStore';
import type { RelationshipType, ClassEdgeData } from '../types/schema';

interface BridgeRequest {
  id: string;
  action: string;
  args: unknown[];
}

function getActiveFile() {
  const s = useCanvasStore.getState();
  return s.activeFilePath ? s.files[s.activeFilePath] : null;
}

function getNodeById(id: string) {
  return getActiveFile()?.nodes.find((n) => n.id === id) ?? null;
}

function getEdgeById(id: string) {
  return getActiveFile()?.edges.find((e) => e.id === id) ?? null;
}

function handleAction(action: string, args: unknown[]): unknown {
  const store = useCanvasStore.getState();
  const file = getActiveFile();

  switch (action) {
    // ── Reads ──
    case 'getCanvas':
      return file ? { nodes: file.nodes, edges: file.edges, viewport: file.viewport } : null;
    case 'getNodes':
      return file?.nodes ?? [];
    case 'getNode':
      return getNodeById(args[0] as string);
    case 'getEdges':
      return file?.edges ?? [];
    case 'getEdge':
      return getEdgeById(args[0] as string);
    case 'getViewport':
      return file?.viewport ?? null;
    case 'getFiles':
      return Object.entries(store.files).map(([path, f]) => ({ path, name: f.name }));
    case 'getActiveFile':
      return store.activeFilePath
        ? { path: store.activeFilePath, name: store.files[store.activeFilePath]?.name }
        : null;
    case 'getFolderInfo':
      return { name: store.folderName, fileCount: Object.keys(store.files).length };
    case 'getImagePaths':
      return store.imagePaths;
    case 'getPdfPaths':
      return store.pdfPaths;

    // ── Node mutations ──
    case 'addClassNode': {
      const before = file?.nodes.length ?? 0;
      store.addClassNode(args[0] as number, args[1] as number);
      const after = getActiveFile()?.nodes ?? [];
      return after.length > before ? after[after.length - 1] : null;
    }
    case 'addTextNode': {
      const before = file?.nodes.length ?? 0;
      store.addTextNode(args[0] as number, args[1] as number, args[2] as Record<string, unknown> | undefined);
      const after = getActiveFile()?.nodes ?? [];
      return after.length > before ? after[after.length - 1] : null;
    }
    case 'updateNodeData':
      store.updateNodeData(args[0] as string, args[1] as Record<string, unknown>);
      return getNodeById(args[0] as string);
    case 'updateNodePosition':
      store.updateNodePosition(args[0] as string, args[1] as number, args[2] as number);
      return getNodeById(args[0] as string);
    case 'removeNode':
      store.removeNode(args[0] as string);
      return { success: true };
    case 'removeNodes':
      store.removeNodes(args[0] as string[]);
      return { success: true };

    // ── Edge mutations ──
    case 'addEdge': {
      const before = file?.edges.length ?? 0;
      store.addEdge(
        args[0] as string, args[1] as string, args[2] as RelationshipType,
        args[3] as string | undefined, args[4] as string | undefined,
      );
      const after = getActiveFile()?.edges ?? [];
      return after.length > before ? after[after.length - 1] : null;
    }
    case 'updateEdgeData':
      store.updateEdgeData(args[0] as string, args[1] as Partial<ClassEdgeData>);
      return getEdgeById(args[0] as string);
    case 'updateEdgeType':
      store.updateEdgeType(args[0] as string, args[1] as RelationshipType);
      return getEdgeById(args[0] as string);
    case 'removeEdge':
      store.removeEdge(args[0] as string);
      return { success: true };
    case 'removeEdges':
      store.removeEdges(args[0] as string[]);
      return { success: true };

    // ── File operations ──
    case 'setActiveFile':
      store.setActiveFile(args[0] as string);
      return { success: true };
    case 'createFile':
      return store.createFile(args[0] as string, args[1] as string);
    case 'saveActiveFile':
      return store.saveActiveFile();
    case 'saveAllFiles':
      return store.saveAllFiles();
    case 'saveViewport':
      store.saveViewport(args[0] as { x: number; y: number; zoom: number });
      return { success: true };

    // ── History ──
    case 'undo':
      store.undo();
      return { success: true };
    case 'redo':
      store.redo();
      return { success: true };

    // ── Layout ──
    case 'alignNodes':
      store.alignNodes(
        args[0] as { id: string; x: number; y: number; w: number; h: number }[],
        args[1] as 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
      );
      return { success: true };
    case 'distributeNodes':
      store.distributeNodes(
        args[0] as { id: string; x: number; y: number; w: number; h: number }[],
        args[1] as 'horizontal' | 'vertical',
      );
      return { success: true };
    case 'groupSelectedNodes': {
      const before = file?.nodes.length ?? 0;
      store.groupSelectedNodes(
        args[0] as { id: string; x: number; y: number; w: number; h: number }[],
      );
      const after = getActiveFile()?.nodes ?? [];
      return after.length > before ? after[after.length - 1] : null;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// Register HMR listener
if (import.meta.hot) {
  import.meta.hot.on('canvas:request', (data: unknown) => {
    const req = data as BridgeRequest;
    try {
      const result = handleAction(req.action, req.args);
      // Handle async results (createFile, saveActiveFile, etc.)
      if (result instanceof Promise) {
        result
          .then((res) => import.meta.hot!.send('canvas:response', { id: req.id, result: res }))
          .catch((err) => import.meta.hot!.send('canvas:response', { id: req.id, error: String(err) }));
      } else {
        import.meta.hot!.send('canvas:response', { id: req.id, result });
      }
    } catch (err) {
      import.meta.hot!.send('canvas:response', { id: req.id, error: String(err) });
    }
  });
}

export { handleAction };
```

**Step 6: Import bridge client in main.tsx**

Add at the top of `src/main.tsx` (after existing imports):

```typescript
import './bridge/client';
```

**Step 7: Wire bridge into Vite plugin**

Update `src/server/plugin.ts` `configureServer` to initialize the bridge:

```typescript
import { initBridge } from './bridge.js';

// Inside configureServer, before the middleware:
initBridge(server.ws);
```

**Step 8: Commit**

```bash
git add src/server/bridge.ts src/server/bridge.test.ts src/bridge/client.ts src/main.tsx src/server/plugin.ts
git commit -m "feat: add HMR bridge for server-to-browser store communication"
```

---

### Task 3: Canvas & Node Read Endpoints

**Files:**
- Create: `src/server/routes/canvas.ts`
- Create: `src/server/routes/nodes.ts`
- Create: `src/server/routes/nodes.test.ts`
- Modify: `src/server/app.ts`

**Step 1: Write node read endpoint tests**

Create `src/server/routes/nodes.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({
  callStore: vi.fn(),
}));

import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('GET /api/canvas/nodes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns all nodes', async () => {
    mockCallStore.mockResolvedValueOnce([
      { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'User' } },
    ]);

    const res = await app.request('/api/canvas/nodes');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe('class-1');
    expect(mockCallStore).toHaveBeenCalledWith('getNodes', []);
  });

  it('filters by type', async () => {
    mockCallStore.mockResolvedValueOnce([
      { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, data: { name: 'User' } },
      { id: 'text-1', type: 'textNode', position: { x: 100, y: 0 }, data: { text: 'Note' } },
    ]);

    const res = await app.request('/api/canvas/nodes?type=classNode');
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].type).toBe('classNode');
  });
});

describe('GET /api/canvas/nodes/:id', () => {
  it('returns a node by ID', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'class-1', type: 'classNode' });

    const res = await app.request('/api/canvas/nodes/class-1');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe('class-1');
  });

  it('returns 404 for missing node', async () => {
    mockCallStore.mockResolvedValueOnce(null);

    const res = await app.request('/api/canvas/nodes/nonexistent');
    expect(res.status).toBe(404);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/server/routes/nodes.test.ts
# Expected: FAIL — routes not defined
```

**Step 3: Implement canvas routes**

Create `src/server/routes/canvas.ts`:

```typescript
import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const canvas = new Hono();

canvas.get('/', async (c) => {
  const data = await callStore('getCanvas', []);
  if (!data) return c.json({ error: 'No active canvas' }, 404);
  return c.json({ data });
});

canvas.get('/viewport', async (c) => {
  const data = await callStore('getViewport', []);
  return c.json({ data });
});

canvas.put('/viewport', async (c) => {
  const body = await c.req.json<{ x: number; y: number; zoom: number }>();
  await callStore('saveViewport', [body]);
  return c.json({ data: body });
});

export { canvas };
```

**Step 4: Implement node routes**

Create `src/server/routes/nodes.ts`:

```typescript
import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const nodes = new Hono();

nodes.get('/', async (c) => {
  const allNodes = (await callStore('getNodes', [])) as Array<{ type: string }>;
  const typeFilter = c.req.query('type');
  const data = typeFilter ? allNodes.filter((n) => n.type === typeFilter) : allNodes;
  return c.json({ data });
});

nodes.get('/:id', async (c) => {
  const data = await callStore('getNode', [c.req.param('id')]);
  if (!data) return c.json({ error: 'Node not found' }, 404);
  return c.json({ data });
});

export { nodes };
```

**Step 5: Wire routes into the Hono app**

Update `src/server/app.ts`:

```typescript
import { Hono } from 'hono';
import { canvas } from './routes/canvas.js';
import { nodes } from './routes/nodes.js';

const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/canvas', canvas);
app.route('/canvas/nodes', nodes);

export { app };
```

**Step 6: Run tests to verify they pass**

```bash
npx vitest run src/server/routes/nodes.test.ts
# Expected: PASS
```

**Step 7: Commit**

```bash
git add src/server/routes/ src/server/app.ts
git commit -m "feat: add canvas and node read endpoints"
```

---

### Task 4: Node Mutation Endpoints

**Files:**
- Modify: `src/server/routes/nodes.ts`
- Modify: `src/server/routes/nodes.test.ts`

**Step 1: Add mutation tests to nodes.test.ts**

Append to existing test file:

```typescript
describe('POST /api/canvas/nodes', () => {
  it('creates a class node', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'class-1', type: 'classNode', position: { x: 100, y: 200 } });

    const res = await app.request('/api/canvas/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'classNode', x: 100, y: 200 }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe('class-1');
    expect(mockCallStore).toHaveBeenCalledWith('addClassNode', [100, 200]);
  });

  it('creates a text node', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'text-1', type: 'textNode' });

    const res = await app.request('/api/canvas/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'textNode', x: 50, y: 50, text: 'Hello' }),
    });

    expect(res.status).toBe(201);
    expect(mockCallStore).toHaveBeenCalledWith('addTextNode', [50, 50, { text: 'Hello' }]);
  });

  it('rejects unknown node type', async () => {
    const res = await app.request('/api/canvas/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'badType', x: 0, y: 0 }),
    });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/canvas/nodes/:id', () => {
  it('updates node data', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'class-1', data: { name: 'Updated' } });

    const res = await app.request('/api/canvas/nodes/class-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });

    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('updateNodeData', ['class-1', { name: 'Updated' }]);
  });
});

describe('PATCH /api/canvas/nodes/:id/position', () => {
  it('updates node position', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'class-1', position: { x: 300, y: 400 } });

    const res = await app.request('/api/canvas/nodes/class-1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 300, y: 400 }),
    });

    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('updateNodePosition', ['class-1', 300, 400]);
  });
});

describe('DELETE /api/canvas/nodes/:id', () => {
  it('deletes a node', async () => {
    mockCallStore.mockResolvedValueOnce({ success: true });

    const res = await app.request('/api/canvas/nodes/class-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('removeNode', ['class-1']);
  });
});

describe('POST /api/canvas/nodes/batch', () => {
  it('processes batch operations', async () => {
    mockCallStore
      .mockResolvedValueOnce({ id: 'class-2', type: 'classNode' })   // create
      .mockResolvedValueOnce({ id: 'class-1', data: { name: 'X' } }) // update
      .mockResolvedValueOnce({ success: true });                       // delete

    const res = await app.request('/api/canvas/nodes/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operations: [
          { op: 'create', type: 'classNode', x: 0, y: 0 },
          { op: 'update', id: 'class-1', data: { name: 'X' } },
          { op: 'delete', id: 'text-1' },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.results).toHaveLength(3);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/server/routes/nodes.test.ts
# Expected: FAIL — POST/PATCH/DELETE routes not defined
```

**Step 3: Add mutation routes to nodes.ts**

Append to `src/server/routes/nodes.ts`:

```typescript
nodes.post('/', async (c) => {
  const body = await c.req.json<{ type: string; x: number; y: number; [key: string]: unknown }>();
  const { type, x, y, ...rest } = body;

  if (type === 'classNode') {
    const data = await callStore('addClassNode', [x, y]);
    return c.json({ data }, 201);
  }
  if (type === 'textNode') {
    const options = Object.keys(rest).length > 0 ? rest : undefined;
    const data = await callStore('addTextNode', [x, y, options]);
    return c.json({ data }, 201);
  }
  return c.json({ error: `Unknown node type: ${type}` }, 400);
});

nodes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();
  const data = await callStore('updateNodeData', [id, body]);
  return c.json({ data });
});

nodes.patch('/:id/position', async (c) => {
  const id = c.req.param('id');
  const { x, y } = await c.req.json<{ x: number; y: number }>();
  const data = await callStore('updateNodePosition', [id, x, y]);
  return c.json({ data });
});

nodes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const data = await callStore('removeNode', [id]);
  return c.json({ data });
});

nodes.post('/batch', async (c) => {
  const { operations } = await c.req.json<{
    operations: Array<{ op: string; type?: string; id?: string; x?: number; y?: number; data?: Record<string, unknown> }>;
  }>();

  const results = [];
  for (const op of operations) {
    if (op.op === 'create') {
      const action = op.type === 'classNode' ? 'addClassNode' : 'addTextNode';
      results.push(await callStore(action, [op.x ?? 0, op.y ?? 0]));
    } else if (op.op === 'update' && op.id) {
      results.push(await callStore('updateNodeData', [op.id, op.data ?? {}]));
    } else if (op.op === 'delete' && op.id) {
      results.push(await callStore('removeNode', [op.id]));
    }
  }
  return c.json({ data: { results } });
});
```

**Important:** Register the batch route BEFORE the `/:id` route in `app.ts` to avoid route conflicts, or ensure the `nodes.post('/batch', ...)` is defined before `nodes.get('/:id', ...)` in the file.

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/server/routes/nodes.test.ts
# Expected: ALL PASS
```

**Step 5: Commit**

```bash
git add src/server/routes/nodes.ts src/server/routes/nodes.test.ts
git commit -m "feat: add node mutation endpoints (POST, PATCH, DELETE, batch)"
```

---

### Task 5: Edge Endpoints (Read + Mutation)

**Files:**
- Create: `src/server/routes/edges.ts`
- Create: `src/server/routes/edges.test.ts`
- Modify: `src/server/app.ts`

**Step 1: Write edge endpoint tests**

Create `src/server/routes/edges.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({
  callStore: vi.fn(),
}));

import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('GET /api/canvas/edges', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns all edges', async () => {
    mockCallStore.mockResolvedValueOnce([
      { id: 'edge-1', source: 'class-1', target: 'class-2', data: { relationshipType: 'inheritance' } },
    ]);
    const res = await app.request('/api/canvas/edges');
    const json = await res.json();
    expect(json.data).toHaveLength(1);
  });

  it('filters by source', async () => {
    mockCallStore.mockResolvedValueOnce([
      { id: 'edge-1', source: 'class-1', target: 'class-2' },
      { id: 'edge-2', source: 'class-3', target: 'class-2' },
    ]);
    const res = await app.request('/api/canvas/edges?source=class-1');
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].source).toBe('class-1');
  });
});

describe('POST /api/canvas/edges', () => {
  it('creates an edge', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1', source: 'class-1', target: 'class-2' });

    const res = await app.request('/api/canvas/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'class-1', target: 'class-2', relationshipType: 'inheritance' }),
    });
    expect(res.status).toBe(201);
    expect(mockCallStore).toHaveBeenCalledWith('addEdge', ['class-1', 'class-2', 'inheritance', undefined, undefined]);
  });
});

describe('PATCH /api/canvas/edges/:id', () => {
  it('updates edge data', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1', data: { label: 'uses' } });

    const res = await app.request('/api/canvas/edges/edge-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'uses' }),
    });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('updateEdgeData', ['edge-1', { label: 'uses' }]);
  });
});

describe('PATCH /api/canvas/edges/:id/type', () => {
  it('changes relationship type', async () => {
    mockCallStore.mockResolvedValueOnce({ id: 'edge-1' });

    const res = await app.request('/api/canvas/edges/edge-1/type', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'composition' }),
    });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('updateEdgeType', ['edge-1', 'composition']);
  });
});

describe('DELETE /api/canvas/edges/:id', () => {
  it('deletes an edge', async () => {
    mockCallStore.mockResolvedValueOnce({ success: true });
    const res = await app.request('/api/canvas/edges/edge-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
  });
});
```

**Step 2: Run tests to verify they fail, then implement**

Create `src/server/routes/edges.ts`:

```typescript
import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const edges = new Hono();

edges.get('/', async (c) => {
  const allEdges = (await callStore('getEdges', [])) as Array<{ source: string; target: string }>;
  const sourceFilter = c.req.query('source');
  const targetFilter = c.req.query('target');
  let data = allEdges;
  if (sourceFilter) data = data.filter((e) => e.source === sourceFilter);
  if (targetFilter) data = data.filter((e) => e.target === targetFilter);
  return c.json({ data });
});

edges.get('/:id', async (c) => {
  const data = await callStore('getEdge', [c.req.param('id')]);
  if (!data) return c.json({ error: 'Edge not found' }, 404);
  return c.json({ data });
});

edges.post('/', async (c) => {
  const { source, target, relationshipType, sourceHandle, targetHandle } =
    await c.req.json<{ source: string; target: string; relationshipType: string; sourceHandle?: string; targetHandle?: string }>();
  const data = await callStore('addEdge', [source, target, relationshipType, sourceHandle, targetHandle]);
  return c.json({ data }, 201);
});

edges.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();
  const data = await callStore('updateEdgeData', [id, body]);
  return c.json({ data });
});

edges.patch('/:id/type', async (c) => {
  const id = c.req.param('id');
  const { type } = await c.req.json<{ type: string }>();
  const data = await callStore('updateEdgeType', [id, type]);
  return c.json({ data });
});

edges.delete('/:id', async (c) => {
  const data = await callStore('removeEdge', [c.req.param('id')]);
  return c.json({ data });
});

export { edges };
```

**Step 3: Register edge routes in app.ts**

Add to `src/server/app.ts`:

```typescript
import { edges } from './routes/edges.js';
app.route('/canvas/edges', edges);
```

**Step 4: Run tests, then commit**

```bash
npx vitest run src/server/routes/edges.test.ts
git add src/server/routes/edges.ts src/server/routes/edges.test.ts src/server/app.ts
git commit -m "feat: add edge CRUD endpoints"
```

---

### Task 6: File Management Endpoints

**Files:**
- Create: `src/server/routes/files.ts`
- Create: `src/server/routes/files.test.ts`
- Modify: `src/server/app.ts`

**Step 1: Write tests**

Create `src/server/routes/files.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

vi.mock('../bridge', () => ({ callStore: vi.fn() }));
import { callStore } from '../bridge';
const mockCallStore = vi.mocked(callStore);

describe('GET /api/files', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns file list', async () => {
    mockCallStore.mockResolvedValueOnce([{ path: 'diagram.codecanvas.json', name: 'Diagram' }]);
    const res = await app.request('/api/files');
    const json = await res.json();
    expect(json.data).toHaveLength(1);
  });
});

describe('GET /api/files/active', () => {
  it('returns active file', async () => {
    mockCallStore.mockResolvedValueOnce({ path: 'diagram.codecanvas.json', name: 'Diagram' });
    const res = await app.request('/api/files/active');
    expect(res.status).toBe(200);
  });

  it('returns 404 when no file active', async () => {
    mockCallStore.mockResolvedValueOnce(null);
    const res = await app.request('/api/files/active');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/files/active', () => {
  it('switches active file', async () => {
    mockCallStore.mockResolvedValueOnce({ success: true });
    const res = await app.request('/api/files/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'other.codecanvas.json' }),
    });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('setActiveFile', ['other.codecanvas.json']);
  });
});

describe('POST /api/files', () => {
  it('creates a new file', async () => {
    mockCallStore.mockResolvedValueOnce(undefined);
    const res = await app.request('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', name: 'NewDiagram' }),
    });
    expect(res.status).toBe(201);
    expect(mockCallStore).toHaveBeenCalledWith('createFile', ['', 'NewDiagram']);
  });
});

describe('POST /api/files/save', () => {
  it('saves active file', async () => {
    mockCallStore.mockResolvedValueOnce(undefined);
    const res = await app.request('/api/files/save', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(mockCallStore).toHaveBeenCalledWith('saveActiveFile', []);
  });
});
```

**Step 2: Implement file routes**

Create `src/server/routes/files.ts`:

```typescript
import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const files = new Hono();

files.get('/', async (c) => {
  const data = await callStore('getFiles', []);
  return c.json({ data });
});

files.get('/active', async (c) => {
  const data = await callStore('getActiveFile', []);
  if (!data) return c.json({ error: 'No active file' }, 404);
  return c.json({ data });
});

files.put('/active', async (c) => {
  const { path } = await c.req.json<{ path: string }>();
  const data = await callStore('setActiveFile', [path]);
  return c.json({ data });
});

files.post('/', async (c) => {
  const { path, name } = await c.req.json<{ path: string; name: string }>();
  await callStore('createFile', [path, name]);
  return c.json({ data: { success: true } }, 201);
});

files.post('/save', async (c) => {
  await callStore('saveActiveFile', []);
  return c.json({ data: { success: true } });
});

files.post('/save-all', async (c) => {
  await callStore('saveAllFiles', []);
  return c.json({ data: { success: true } });
});

export { files };
```

**Step 3: Register in app.ts, run tests, commit**

```typescript
import { files } from './routes/files.js';
app.route('/files', files);
```

```bash
npx vitest run src/server/routes/files.test.ts
git add src/server/routes/files.ts src/server/routes/files.test.ts src/server/app.ts
git commit -m "feat: add file management endpoints"
```

---

### Task 7: Search Endpoint with Wildcard Matching (TDD)

**Files:**
- Create: `src/server/search.ts`
- Create: `src/server/search.test.ts`
- Create: `src/server/routes/search.ts`
- Modify: `src/server/app.ts`
- Modify: `src/bridge/client.ts`

**Step 1: Write wildcard matcher tests**

Create `src/server/search.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { wildcardMatch } from './search';

describe('wildcardMatch', () => {
  it('matches exact strings', () => {
    expect(wildcardMatch('hello', 'hello')).toBe(true);
    expect(wildcardMatch('hello', 'world')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(wildcardMatch('Hello', 'hello')).toBe(true);
    expect(wildcardMatch('HELLO', 'hello')).toBe(true);
  });

  it('* matches any sequence', () => {
    expect(wildcardMatch('UserService', '*Service')).toBe(true);
    expect(wildcardMatch('UserService', 'User*')).toBe(true);
    expect(wildcardMatch('UserService', '*erSer*')).toBe(true);
    expect(wildcardMatch('UserService', '*xyz*')).toBe(false);
  });

  it('? matches single character', () => {
    expect(wildcardMatch('cat', 'c?t')).toBe(true);
    expect(wildcardMatch('cut', 'c?t')).toBe(true);
    expect(wildcardMatch('coat', 'c?t')).toBe(false);
  });

  it('handles combined wildcards', () => {
    expect(wildcardMatch('UserService', '?ser*')).toBe(true);
    expect(wildcardMatch('abc', '*')).toBe(true);
    expect(wildcardMatch('', '*')).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/server/search.test.ts
# Expected: FAIL
```

**Step 3: Implement wildcard matcher**

Create `src/server/search.ts`:

```typescript
export function wildcardMatch(text: string, pattern: string): boolean {
  const t = text.toLowerCase();
  const p = pattern.toLowerCase();
  const regex = new RegExp(
    '^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
  );
  return regex.test(t);
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/server/search.test.ts
# Expected: ALL PASS
```

**Step 5: Add search action to bridge client**

Add a `search` case to `handleAction` in `src/bridge/client.ts`:

```typescript
case 'search': {
  // args: [query: string, typeFilter?: string]
  // Import wildcardMatch — but wait, this runs in the browser.
  // Move match logic to the bridge client directly:
  const query = args[0] as string;
  const typeFilter = args[1] as string | undefined;
  const nodes = file?.nodes ?? [];
  const edges = file?.edges ?? [];

  const matchingNodes = nodes
    .filter((n) => {
      if (typeFilter && n.type !== typeFilter) return false;
      return nodeMatchesQuery(n, query);
    });

  const matchingEdges = edges
    .filter((e) => {
      const label = (e.data as { label?: string }).label ?? '';
      return wildcardMatchBrowser(label, query);
    });

  return { nodes: matchingNodes, edges: matchingEdges };
}
```

Add these helper functions to `src/bridge/client.ts`:

```typescript
function wildcardMatchBrowser(text: string, pattern: string): boolean {
  const t = text.toLowerCase();
  const p = pattern.toLowerCase();
  const regex = new RegExp(
    '^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
  );
  return regex.test(t);
}

function nodeMatchesQuery(node: { type: string; data: Record<string, unknown> }, query: string): boolean {
  if (node.type === 'classNode') {
    const d = node.data as { name?: string; properties?: Array<{ name: string }>; methods?: Array<{ name: string }> };
    if (wildcardMatchBrowser(d.name ?? '', query)) return true;
    if (d.properties?.some((p) => wildcardMatchBrowser(p.name, query))) return true;
    if (d.methods?.some((m) => wildcardMatchBrowser(m.name, query))) return true;
    return false;
  }
  if (node.type === 'textNode') {
    return wildcardMatchBrowser((node.data as { text?: string }).text ?? '', query);
  }
  if (node.type === 'groupNode') {
    return wildcardMatchBrowser((node.data as { label?: string }).label ?? '', query);
  }
  return false;
}
```

**Step 6: Create search route**

Create `src/server/routes/search.ts`:

```typescript
import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const search = new Hono();

search.get('/', async (c) => {
  const q = c.req.query('q');
  if (!q) return c.json({ error: 'Missing query parameter q' }, 400);
  const typeFilter = c.req.query('type');
  const data = await callStore('search', [q, typeFilter]);
  return c.json({ data });
});

export { search };
```

**Step 7: Register in app.ts, commit**

```typescript
import { search } from './routes/search.js';
app.route('/canvas/search', search);
```

```bash
git add src/server/search.ts src/server/search.test.ts src/server/routes/search.ts src/bridge/client.ts src/server/app.ts
git commit -m "feat: add wildcard search endpoint for nodes and edges"
```

---

### Task 8: Layout, History, Media, Schema Endpoints

**Files:**
- Create: `src/server/routes/history.ts`
- Create: `src/server/routes/layout.ts`
- Create: `src/server/routes/media.ts`
- Create: `src/server/routes/schema.ts`
- Modify: `src/server/app.ts`

**Step 1: Implement all remaining routes**

Create `src/server/routes/history.ts`:

```typescript
import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const history = new Hono();

history.post('/undo', async (c) => {
  await callStore('undo', []);
  return c.json({ data: { success: true } });
});

history.post('/redo', async (c) => {
  await callStore('redo', []);
  return c.json({ data: { success: true } });
});

export { history };
```

Create `src/server/routes/layout.ts`:

```typescript
import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const layout = new Hono();

layout.post('/align', async (c) => {
  const { rects, alignment } = await c.req.json<{
    rects: Array<{ id: string; x: number; y: number; w: number; h: number }>;
    alignment: string;
  }>();
  await callStore('alignNodes', [rects, alignment]);
  return c.json({ data: { success: true } });
});

layout.post('/distribute', async (c) => {
  const { rects, axis } = await c.req.json<{
    rects: Array<{ id: string; x: number; y: number; w: number; h: number }>;
    axis: string;
  }>();
  await callStore('distributeNodes', [rects, axis]);
  return c.json({ data: { success: true } });
});

layout.post('/group', async (c) => {
  const { rects } = await c.req.json<{
    rects: Array<{ id: string; x: number; y: number; w: number; h: number }>;
  }>();
  const data = await callStore('groupSelectedNodes', [rects]);
  return c.json({ data }, 201);
});

export { layout };
```

Create `src/server/routes/media.ts`:

```typescript
import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const media = new Hono();

media.get('/images', async (c) => {
  const data = await callStore('getImagePaths', []);
  return c.json({ data });
});

media.get('/pdfs', async (c) => {
  const data = await callStore('getPdfPaths', []);
  return c.json({ data });
});

export { media };
```

Create `src/server/routes/schema.ts`:

```typescript
import { Hono } from 'hono';

const schema = new Hono();

schema.get('/', (c) => {
  return c.json({
    data: {
      nodeTypes: ['classNode', 'textNode', 'groupNode'],
      relationshipTypes: ['inheritance', 'implementation', 'composition', 'aggregation', 'dependency', 'association'],
      stereotypes: ['interface', 'abstract', 'enum'],
      visibilities: ['public', 'private', 'protected'],
      edgeStrokeStyles: ['solid', 'dashed', 'dotted', 'double'],
      borderStyles: ['solid', 'dashed', 'dotted', 'double', 'none'],
      textAligns: ['left', 'center', 'right', 'justify'],
    },
  });
});

export { schema };
```

**Step 2: Register all routes in app.ts**

Final `src/server/app.ts`:

```typescript
import { Hono } from 'hono';
import { canvas } from './routes/canvas.js';
import { nodes } from './routes/nodes.js';
import { edges } from './routes/edges.js';
import { files } from './routes/files.js';
import { search } from './routes/search.js';
import { history } from './routes/history.js';
import { layout } from './routes/layout.js';
import { media } from './routes/media.js';
import { schema } from './routes/schema.js';

const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/canvas', canvas);
app.route('/canvas/nodes', nodes);
app.route('/canvas/edges', edges);
app.route('/canvas/search', search);
app.route('/canvas/layout', layout);
app.route('/canvas', history);
app.route('/files', files);
app.route('/media', media);
app.route('/schema', schema);

// Global error handler
app.onError((err, c) => {
  console.error('[Canvas API]', err);
  return c.json({ error: err.message }, 500);
});

export { app };
```

**Step 3: Run full test suite, then commit**

```bash
npx vitest run src/server/
npx tsc --noEmit
git add src/server/routes/ src/server/app.ts
git commit -m "feat: add layout, history, media, and schema endpoints"
```

---

### Task 9: Folder Open Endpoint (Server-Side Scanning)

This task adds `POST /api/folder/open` which scans a folder from the server (Node.js) and loads it into the browser's store.

**Files:**
- Create: `src/server/routes/folder.ts`
- Create: `src/server/fsScanner.ts`
- Create: `src/server/fsScanner.test.ts`
- Modify: `src/bridge/client.ts` (add `loadFolder` action)
- Modify: `src/store/useCanvasStore.ts` (add `loadFolder` action)
- Modify: `src/server/app.ts`

**Step 1: Write filesystem scanner tests**

Create `src/server/fsScanner.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanFolderFs } from './fsScanner';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

vi.mock('node:fs/promises');
const mockFs = vi.mocked(fs);

describe('scanFolderFs', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('finds .codecanvas.json files', async () => {
    mockFs.readdir.mockResolvedValueOnce([
      { name: 'diagram.codecanvas.json', isFile: () => true, isDirectory: () => false },
    ] as never);
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
      version: '1.0', name: 'Diagram', nodes: [], edges: [],
    }));

    const result = await scanFolderFs('/test/folder');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].relativePath).toBe('diagram.codecanvas.json');
  });

  it('finds images', async () => {
    mockFs.readdir.mockResolvedValueOnce([
      { name: 'photo.png', isFile: () => true, isDirectory: () => false },
    ] as never);

    const result = await scanFolderFs('/test/folder');
    expect(result.imagePaths).toContain('photo.png');
  });

  it('skips excluded directories', async () => {
    mockFs.readdir.mockResolvedValueOnce([
      { name: 'node_modules', isFile: () => false, isDirectory: () => true },
      { name: 'src', isFile: () => false, isDirectory: () => true },
    ] as never);
    // src subdir
    mockFs.readdir.mockResolvedValueOnce([] as never);

    const result = await scanFolderFs('/test/folder');
    // node_modules should be skipped, only src scanned
    expect(mockFs.readdir).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Implement filesystem scanner**

Create `src/server/fsScanner.ts`:

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CodeCanvasFile } from '../types/schema.js';

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.svn', '.hg', '__pycache__', '.next', 'dist', 'build']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']);

export interface FsScanResult {
  files: Array<{ relativePath: string; file: CodeCanvasFile }>;
  imagePaths: string[];
  pdfPaths: string[];
  warnings: string[];
}

export async function scanFolderFs(rootPath: string, basePath = ''): Promise<FsScanResult> {
  const result: FsScanResult = { files: [], imagePaths: [], pdfPaths: [], warnings: [] };
  const dirPath = basePath ? path.join(rootPath, basePath) : rootPath;

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const sub = await scanFolderFs(rootPath, relativePath);
      result.files.push(...sub.files);
      result.imagePaths.push(...sub.imagePaths);
      result.pdfPaths.push(...sub.pdfPaths);
      result.warnings.push(...sub.warnings);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();

      if (entry.name.endsWith('.codecanvas.json')) {
        try {
          const content = await fs.readFile(path.join(dirPath, entry.name), 'utf-8');
          const file = JSON.parse(content) as CodeCanvasFile;
          result.files.push({ relativePath, file });
        } catch (err) {
          result.warnings.push(`Failed to parse ${relativePath}: ${err}`);
        }
      } else if (IMAGE_EXTS.has(ext)) {
        result.imagePaths.push(relativePath);
      } else if (ext === '.pdf') {
        result.pdfPaths.push(relativePath);
      }
    }
  }

  result.files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return result;
}
```

**Step 3: Add `loadFolder` action to the Zustand store**

Add to the state interface in `src/store/useCanvasStore.ts` (around line 250):

```typescript
loadFolder: (name: string, files: Record<string, CodeCanvasFile>, imagePaths: string[], pdfPaths: string[]) => void;
```

Add the implementation (in the `set` actions section):

```typescript
loadFolder: (name, files, imagePaths, pdfPaths) => {
  clearImageCache();
  const firstPath = Object.keys(files).sort()[0] ?? null;
  set({
    folderHandle: null,
    folderName: name,
    files,
    fileHandles: {},
    activeFilePath: firstPath,
    lastSavedFiles: structuredClone(files),
    _dirtyFiles: {},
    _undoStack: [],
    _redoStack: [],
    imagePaths,
    pdfPaths,
    previewImagePath: null,
    previewPdfPath: null,
    sidebarOpen: true,
  });
  syncIdCounters(files);
},
```

**Step 4: Add `loadFolder` to bridge client**

Add to `handleAction` in `src/bridge/client.ts`:

```typescript
case 'loadFolder': {
  store.loadFolder(
    args[0] as string,
    args[1] as Record<string, CodeCanvasFile>,
    args[2] as string[],
    args[3] as string[],
  );
  return { success: true };
}
```

**Step 5: Create folder route**

Create `src/server/routes/folder.ts`:

```typescript
import { Hono } from 'hono';
import * as path from 'node:path';
import { callStore } from '../bridge.js';
import { scanFolderFs } from '../fsScanner.js';
import type { CodeCanvasFile } from '../../types/schema.js';

const folder = new Hono();

folder.get('/', async (c) => {
  const data = await callStore('getFolderInfo', []);
  return c.json({ data });
});

folder.post('/open', async (c) => {
  const { path: folderPath } = await c.req.json<{ path: string }>();
  if (!folderPath) return c.json({ error: 'Missing path' }, 400);

  const folderName = path.basename(folderPath);
  const scan = await scanFolderFs(folderPath);

  const files: Record<string, CodeCanvasFile> = {};
  for (const f of scan.files) {
    files[f.relativePath] = f.file;
  }

  await callStore('loadFolder', [folderName, files, scan.imagePaths, scan.pdfPaths]);

  return c.json({
    data: {
      name: folderName,
      fileCount: scan.files.length,
      imageCount: scan.imagePaths.length,
      pdfCount: scan.pdfPaths.length,
      warnings: scan.warnings,
    },
  });
});

export { folder };
```

**Step 6: Register in app.ts**

```typescript
import { folder } from './routes/folder.js';
app.route('/folder', folder);
```

**Step 7: Run all tests, verify build, commit**

```bash
npx vitest run src/server/
npx tsc --noEmit
npm run build
git add src/server/ src/bridge/ src/store/useCanvasStore.ts src/server/app.ts
git commit -m "feat: add folder open endpoint with server-side fs scanning"
```

---

## Verification Checklist

After all tasks are complete:

1. `npx tsc --noEmit` — no type errors
2. `npx vitest run` — all tests pass
3. `npm run build` — builds successfully
4. Manual test: `npm run dev`, then:
   - `curl http://localhost:5173/api/health` → `{"status":"ok"}`
   - `curl http://localhost:5173/api/schema` → lists node types, relationships, etc.
   - Open a folder in the browser UI, then:
   - `curl http://localhost:5173/api/canvas` → returns current canvas state
   - `curl -X POST http://localhost:5173/api/canvas/nodes -H 'Content-Type: application/json' -d '{"type":"classNode","x":100,"y":200}'` → creates a node visible in the browser
   - `curl http://localhost:5173/api/canvas/search?q=*` → returns all nodes/edges
5. Manual test: `curl -X POST http://localhost:5173/api/folder/open -H 'Content-Type: application/json' -d '{"path":"/absolute/path/to/folder"}'` → loads folder, browser updates
