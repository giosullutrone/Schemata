# Agentic Collaboration API Design

## Goal

Expose CodeCanvas as a tool that external LLM agents can use via REST API, enabling human-agent collaboration for code design and document exploration on a visual canvas.

## Use Cases

**Code design:** User and agent collaboratively shape class diagrams. Agent creates classes, properties, methods, and relationships. User arranges and refines visually.

**Document exploration:** User and agent explore topics, PDFs, and write content together. Agent creates text nodes with analysis/summaries, connects related concepts, organizes spatially.

## Architecture

### Runtime Model

- **Target platform:** Desktop app (Electron/Tauri)
- **Server:** Lightweight Hono HTTP server running as Vite middleware (dev) or in Electron main process / Tauri sidecar (production)
- **Port:** Configurable, default `21847`
- **Agent model:** External agents connect to `localhost` REST endpoints (canvas is a passive tool)
- **Protocol:** Plain REST API, request-response only (no SSE/WebSocket for agents)

### Communication Bridge

The server runs in Node.js (Vite middleware), while the Zustand store lives in the browser. They communicate via Vite's built-in HMR WebSocket (`import.meta.hot`):

1. Agent calls REST endpoint on Vite server
2. Server sends message over HMR channel to browser
3. Browser-side bridge handler calls the appropriate Zustand store action
4. Browser sends result back over HMR channel
5. Server returns JSON response to agent

For Electron: bridge swaps to IPC. For Tauri: Tauri commands. The REST endpoints and store mappings stay identical.

### Approach

Thin wrapper over Zustand store actions (Approach 1). Each endpoint maps directly to an existing store action. No abstraction layer — the API has exact feature parity with the UI.

### File Structure

```
src/
  server/
    index.ts          -- Hono app setup, CORS, error handling
    bridge.ts         -- HMR WebSocket bridge (server side)
    routes/
      canvas.ts       -- GET /api/canvas (full state)
      nodes.ts        -- CRUD for nodes
      edges.ts        -- CRUD for edges
      files.ts        -- File/workspace management
      folder.ts       -- Folder open/info
      search.ts       -- Wildcard search across nodes/edges
      history.ts      -- Undo/redo
      schema.ts       -- Discovery endpoint
  bridge/
    client.ts         -- Browser-side bridge handler (import.meta.hot)
```

### Key Behaviors

- All mutations push to the undo stack (same as UI interactions)
- All responses are JSON
- Error format: `{ error: string }`
- CORS enabled for `localhost` only
- Server auto-starts when the app launches

---

## API Endpoints (31 total)

### Folder & Workspace

| Method | Endpoint | Store Action | Description |
|--------|----------|-------------|-------------|
| `POST` | `/api/folder/open` | new action (fs-based) | Open folder by absolute path. Scans for `.codecanvas.json`, images, PDFs. |
| `GET` | `/api/folder` | read store state | Current folder info (name, file count) |

### Files

| Method | Endpoint | Store Action | Description |
|--------|----------|-------------|-------------|
| `GET` | `/api/files` | read `files` keys | List all canvas files |
| `GET` | `/api/files/active` | read `activeFilePath` | Get active file path + data |
| `PUT` | `/api/files/active` | `setActiveFile(path)` | Switch active canvas |
| `POST` | `/api/files` | `createFile(path, name)` | Create new canvas file |
| `POST` | `/api/files/save` | `saveActiveFile()` | Save current file |
| `POST` | `/api/files/save-all` | `saveAllFiles()` | Save all dirty files |

### Canvas State

| Method | Endpoint | Store Action | Description |
|--------|----------|-------------|-------------|
| `GET` | `/api/canvas` | read full file state | All nodes + edges + viewport |
| `GET` | `/api/canvas/viewport` | read viewport | Current zoom/pan |
| `PUT` | `/api/canvas/viewport` | `saveViewport(vp)` | Set zoom/pan position |

### Nodes

| Method | Endpoint | Store Action | Description |
|--------|----------|-------------|-------------|
| `GET` | `/api/canvas/nodes` | read nodes | List all nodes. Filter: `?type=classNode` |
| `GET` | `/api/canvas/nodes/:id` | read single node | Get node by ID |
| `POST` | `/api/canvas/nodes` | `addClassNode` / `addTextNode` | Create node (type in body) |
| `PATCH` | `/api/canvas/nodes/:id` | `updateNodeData(id, data)` | Update node properties |
| `PATCH` | `/api/canvas/nodes/:id/position` | `updateNodePosition(id, x, y)` | Move node |
| `DELETE` | `/api/canvas/nodes/:id` | `removeNode(id)` | Delete node |
| `POST` | `/api/canvas/nodes/batch` | multiple actions | Batch create/update/delete |

### Edges

| Method | Endpoint | Store Action | Description |
|--------|----------|-------------|-------------|
| `GET` | `/api/canvas/edges` | read edges | List all. Filter: `?source=X`, `?target=Y` |
| `GET` | `/api/canvas/edges/:id` | read single edge | Get edge by ID |
| `POST` | `/api/canvas/edges` | `addEdge(src, tgt, type)` | Create edge |
| `PATCH` | `/api/canvas/edges/:id` | `updateEdgeData(id, data)` | Update label, color, etc. |
| `PATCH` | `/api/canvas/edges/:id/type` | `updateEdgeType(id, type)` | Change relationship type |
| `DELETE` | `/api/canvas/edges/:id` | `removeEdge(id)` | Delete edge |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/canvas/search` | Search nodes and edges by content. Params: `?q=*Service*` (wildcard, case-insensitive), `?type=classNode` (optional). Searches node names, text, property/method names, and edge labels. |

Wildcard: `*` matches any characters, `?` matches single character.

### Layout

| Method | Endpoint | Store Action | Description |
|--------|----------|-------------|-------------|
| `POST` | `/api/canvas/layout/align` | `alignNodes(rects, dir)` | Align nodes |
| `POST` | `/api/canvas/layout/distribute` | `distributeNodes(rects, axis)` | Even spacing |
| `POST` | `/api/canvas/layout/group` | `groupSelectedNodes(rects)` | Create group |

### History

| Method | Endpoint | Store Action | Description |
|--------|----------|-------------|-------------|
| `POST` | `/api/canvas/undo` | `undo()` | Undo last action |
| `POST` | `/api/canvas/redo` | `redo()` | Redo |

### Media & Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/media/images` | List workspace image paths |
| `GET` | `/api/media/pdfs` | List workspace PDF paths |
| `GET` | `/api/schema` | Available node types, relationship types, stereotypes, colors |
