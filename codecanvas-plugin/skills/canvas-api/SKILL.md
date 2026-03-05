---
name: canvas-api
description: >
  This skill should be used when the user asks to "create a class diagram",
  "add a class node", "connect two classes", "add an inheritance relationship",
  "lay out the diagram", "search the canvas", "add a text note",
  "create a UML diagram", "modify the canvas", "save the diagram",
  "open a project folder", "undo a change", or mentions CodeCanvas API operations.
  Activates for any request involving visual diagram manipulation on the CodeCanvas.
version: 1.0.0
---

# CodeCanvas API Skill

You have access to the CodeCanvas REST API running as Vite dev middleware. Use `curl` via the Bash tool to read and manipulate the UML diagram canvas.

## Prerequisites

- The Vite dev server must be running (default: `http://localhost:5173`)
- Always verify with `curl http://localhost:5173/api/health` first
- If the port differs, check the running Vite process

## Workflow

1. **Verify server** — `GET /api/health`
2. **Check types** — `GET /api/schema` for valid enums (relationship types, stereotypes, etc.)
3. **Read state** — `GET /api/canvas/nodes` before making changes
4. **Create nodes first**, then connect with edges
5. **Undo mistakes** — `POST /api/canvas/undo`
6. **Save work** — `POST /api/files/save`

## API Reference

All responses wrap data in `{ "data": ... }`. Errors return `{ "error": "message" }`.

### Canvas

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/health | — | Liveness check → `{ "status": "ok" }` |
| GET | /api/canvas | — | Get active canvas: nodes, edges, viewport |
| GET | /api/canvas/viewport | — | Get viewport `{ x, y, zoom }` |
| PUT | /api/canvas/viewport | `{ "x": 0, "y": 0, "zoom": 1 }` | Set viewport |

### Nodes

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/canvas/nodes | ?type=classNode | List nodes, optional type filter |
| GET | /api/canvas/nodes/:id | — | Get node by ID |
| POST | /api/canvas/nodes | `{ "type": "classNode", "x": 100, "y": 200 }` | Create node |
| POST | /api/canvas/nodes/batch | `{ "operations": [...] }` | Batch create/update/delete |
| PATCH | /api/canvas/nodes/:id | `{ "name": "User" }` | Update node data (shallow merge) |
| PATCH | /api/canvas/nodes/:id/position | `{ "x": 300, "y": 400 }` | Move node |
| DELETE | /api/canvas/nodes/:id | — | Delete node |

**Node types:** `classNode`, `textNode`, `groupNode`

**classNode** — Created with `type: "classNode"`. Always starts as `name: "NewClass"` with empty properties/methods. Update via PATCH.

**textNode** — Created with `type: "textNode"`. Optional extra fields: `text`, `color`, `borderStyle`, `opacity`, `parentId`, `parentType`.

**classNode data shape:**
```json
{
  "name": "User",
  "stereotype": "abstract",
  "color": "#e8f5e9",
  "properties": [
    { "id": "p1", "name": "email", "type": "String", "visibility": "private" }
  ],
  "methods": [
    { "id": "m1", "name": "login", "parameters": [{ "name": "password", "type": "String" }], "returnType": "boolean", "visibility": "public" }
  ]
}
```

**Updating properties/methods:** Send the **entire** updated array, not just new entries.

### Edges

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/canvas/edges | ?source=id&target=id | List edges, optional filters |
| GET | /api/canvas/edges/:id | — | Get edge by ID |
| POST | /api/canvas/edges | `{ "source": "class-1", "target": "class-2", "relationshipType": "inheritance" }` | Create edge |
| PATCH | /api/canvas/edges/:id | `{ "label": "uses" }` | Update edge data |
| PATCH | /api/canvas/edges/:id/type | `{ "type": "composition" }` | Change relationship type |
| DELETE | /api/canvas/edges/:id | — | Delete edge |

**Relationship types:** `inheritance`, `implementation`, `composition`, `aggregation`, `dependency`, `association`

**Optional edge fields:** `sourceHandle`, `targetHandle` (on create); `label`, `color`, `strokeStyle`, `labelWidth`, `labelHeight` (on update)

**Edge stroke styles:** `solid`, `dashed`, `dotted`, `double`

### Search

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/canvas/search | ?q=User*&type=classNode | Wildcard search (`*` = any, `?` = one char) |

### History

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | /api/canvas/undo | — | Undo last action |
| POST | /api/canvas/redo | — | Redo last undone action |

### Layout

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | /api/canvas/layout/align | `{ "rects": [...], "alignment": "top" }` | Align nodes |
| POST | /api/canvas/layout/distribute | `{ "rects": [...], "axis": "horizontal" }` | Distribute evenly |
| POST | /api/canvas/layout/group | `{ "rects": [...] }` | Group into a groupNode |

**rects format:** `[{ "id": "class-1", "x": 100, "y": 200, "w": 180, "h": 120 }, ...]`

**alignment values:** `left`, `center`, `right`, `top`, `middle`, `bottom`

**axis values:** `horizontal`, `vertical`

### Files

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/files | — | List all open files |
| GET | /api/files/active | — | Get active file |
| PUT | /api/files/active | `{ "path": "models/auth.codecanvas.json" }` | Switch active file |
| POST | /api/files | `{ "path": "", "name": "NewDiagram" }` | Create new file |
| POST | /api/files/save | — | Save active file |
| POST | /api/files/save-all | — | Save all files |

### Folder

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/folder | — | Get loaded folder info |
| POST | /api/folder/open | `{ "path": "/absolute/path" }` | Open folder from disk |

### Media & Schema

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/media/images | — | List image asset paths |
| GET | /api/media/pdfs | — | List PDF asset paths |
| GET | /api/schema | — | Get all valid enum values |

## Example Workflows

### 1. Create a class with properties and methods

```bash
# Create the class node
curl -s -X POST http://localhost:5173/api/canvas/nodes \
  -H 'Content-Type: application/json' \
  -d '{"type":"classNode","x":200,"y":100}'
# Response: { "data": { "id": "class-1", ... } }

# Add properties and methods
curl -s -X PATCH http://localhost:5173/api/canvas/nodes/class-1 \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "User",
    "stereotype": "abstract",
    "properties": [
      {"id":"p1","name":"email","type":"String","visibility":"private"},
      {"id":"p2","name":"active","type":"boolean","visibility":"private"}
    ],
    "methods": [
      {"id":"m1","name":"login","parameters":[{"name":"password","type":"String"}],"returnType":"boolean","visibility":"public"},
      {"id":"m2","name":"logout","parameters":[],"returnType":"void","visibility":"public"}
    ]
  }'
```

### 2. Create two classes and connect with inheritance

```bash
# Create parent class
curl -s -X POST http://localhost:5173/api/canvas/nodes \
  -H 'Content-Type: application/json' \
  -d '{"type":"classNode","x":300,"y":100}'
# → class-1

# Create child class
curl -s -X POST http://localhost:5173/api/canvas/nodes \
  -H 'Content-Type: application/json' \
  -d '{"type":"classNode","x":300,"y":350}'
# → class-2

# Name them
curl -s -X PATCH http://localhost:5173/api/canvas/nodes/class-1 \
  -H 'Content-Type: application/json' -d '{"name":"Animal"}'
curl -s -X PATCH http://localhost:5173/api/canvas/nodes/class-2 \
  -H 'Content-Type: application/json' -d '{"name":"Dog"}'

# Connect with inheritance (Dog extends Animal)
curl -s -X POST http://localhost:5173/api/canvas/edges \
  -H 'Content-Type: application/json' \
  -d '{"source":"class-2","target":"class-1","relationshipType":"inheritance"}'
```

### 3. Search and update a node

```bash
# Search for nodes matching "User*"
curl -s 'http://localhost:5173/api/canvas/search?q=User*&type=classNode'
# → { "data": { "nodes": [{ "id": "class-1", ... }], "edges": [] } }

# Update the found node
curl -s -X PATCH http://localhost:5173/api/canvas/nodes/class-1 \
  -H 'Content-Type: application/json' -d '{"name":"UserAccount"}'
```

### 4. Batch create a multi-class diagram

```bash
curl -s -X POST http://localhost:5173/api/canvas/nodes/batch \
  -H 'Content-Type: application/json' \
  -d '{
    "operations": [
      {"op":"create","type":"classNode","x":100,"y":100},
      {"op":"create","type":"classNode","x":400,"y":100},
      {"op":"create","type":"classNode","x":250,"y":350}
    ]
  }'
# Then update names and add edges as needed
```

### 5. Layout and organize

```bash
# Get current nodes to build rects
curl -s http://localhost:5173/api/canvas/nodes
# Extract IDs and positions, then align:
curl -s -X POST http://localhost:5173/api/canvas/layout/align \
  -H 'Content-Type: application/json' \
  -d '{
    "rects": [
      {"id":"class-1","x":100,"y":200,"w":180,"h":120},
      {"id":"class-2","x":350,"y":250,"w":180,"h":100}
    ],
    "alignment": "top"
  }'

# Distribute evenly (needs 3+ nodes)
curl -s -X POST http://localhost:5173/api/canvas/layout/distribute \
  -H 'Content-Type: application/json' \
  -d '{
    "rects": [
      {"id":"class-1","x":100,"y":100,"w":180,"h":120},
      {"id":"class-2","x":300,"y":100,"w":180,"h":120},
      {"id":"class-3","x":500,"y":100,"w":180,"h":120}
    ],
    "axis": "horizontal"
  }'
```

### 6. File management

```bash
# List files
curl -s http://localhost:5173/api/files
# Create new file
curl -s -X POST http://localhost:5173/api/files \
  -H 'Content-Type: application/json' \
  -d '{"path":"","name":"Authentication"}'
# Switch active file
curl -s -X PUT http://localhost:5173/api/files/active \
  -H 'Content-Type: application/json' \
  -d '{"path":"authentication.codecanvas.json"}'
# Save
curl -s -X POST http://localhost:5173/api/files/save
```

### 7. Open a project folder

```bash
# Open folder from disk
curl -s -X POST http://localhost:5173/api/folder/open \
  -H 'Content-Type: application/json' \
  -d '{"path":"/Users/alice/Projects/MyDiagrams"}'
# Check what was loaded
curl -s http://localhost:5173/api/canvas
```

### 8. Undo a mistake

```bash
# Undo last action
curl -s -X POST http://localhost:5173/api/canvas/undo
# Verify state
curl -s http://localhost:5173/api/canvas/nodes
# Redo if undo was wrong
curl -s -X POST http://localhost:5173/api/canvas/redo
```

## Tips

- **IDs are auto-generated**: `class-N`, `text-N`, `edge-N`, `group-N`
- **Read before mutate**: Always GET current state before making changes
- **Batch for efficiency**: Use `/nodes/batch` when creating multiple nodes
- **Properties/methods are arrays**: To add one, send the full updated array (not just the new item)
- **Save frequently**: The canvas is in-memory; use `POST /api/files/save` to persist
- **Wildcards in search**: `*` matches any characters, `?` matches exactly one
- **Groups**: Use layout/group to visually group related classes
- **Text nodes as annotations**: Create textNode with `parentId` to auto-connect to a class
