---
name: canvas-api
description: "Use when the user asks to create/modify UML diagrams, add/connect class nodes, search the canvas, lay out diagrams, manage files, export diagrams, duplicate nodes, explore hierarchy, find orphans, get stats, or any Schemata API operation."
---

# Schemata API Skill

You have access to the Schemata REST API running as Vite dev middleware. Use `curl` via the Bash tool to read and manipulate the UML diagram canvas.

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
7. **Verify layout visually** — Export PNG → save to /tmp → read with Read tool (see workflow 14)

## API Reference

All responses wrap data in `{ "data": ... }`. Errors return `{ "error": "message" }`.

### Canvas

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/health | — | Liveness check → `{ "status": "ok" }` |
| GET | /api/canvas | — | Get active canvas: nodes, edges, viewport |
| GET | /api/canvas/viewport | — | Get viewport `{ x, y, zoom }` |
| PUT | /api/canvas/viewport | `{ "x": 0, "y": 0, "zoom": 1 }` | Set viewport |
| POST | /api/canvas/clear | — | Clear all nodes and edges (atomic undo) |
| POST | /api/canvas/viewport/fit | `{ "padding": 50 }` | Auto-fit viewport to show all content |

### Nodes

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/canvas/nodes | ?type=classNode | List nodes, optional type filter |
| GET | /api/canvas/nodes/:id | — | Get node by ID |
| POST | /api/canvas/nodes | `{ "type": "classNode", "x": 100, "y": 200 }` | Create node (classNode accepts optional `name`, `properties`, `methods`, `stereotype`, `color` inline) |
| POST | /api/canvas/nodes/batch | `{ "operations": [...] }` | Batch create/update/delete (each create op can include `data` for inline population) |
| PATCH | /api/canvas/nodes/positions | `{ "positions": [{"id":"class-1","x":100,"y":200}, ...] }` | Batch update positions (atomic undo, max 200) |
| DELETE | /api/canvas/nodes/batch | `{ "ids": ["class-1", "class-2"] }` | Bulk delete nodes (max 100) |
| POST | /api/canvas/nodes/duplicate | `{ "ids": ["class-1"], "offsetX": 30, "offsetY": 30 }` | Duplicate nodes (remaps edges) |
| GET | /api/canvas/nodes/orphans | — | Get nodes with no edges |
| GET | /api/canvas/nodes/overlaps | — | Get overlapping node pairs (excludes parent–child group overlaps) |
| GET | /api/canvas/nodes/groups/:id/children | — | Get child nodes within a group |
| GET | /api/canvas/nodes/:id/connections | — | Get edges and connected nodes for a node |
| GET | /api/canvas/nodes/:id/hierarchy | ?direction=both | Get inheritance/implementation hierarchy (ancestors, descendants, or both) |
| PATCH | /api/canvas/nodes/:id | `{ "name": "User" }` | Update node data (shallow merge) |
| PATCH | /api/canvas/nodes/:id/position | `{ "x": 300, "y": 400 }` | Move single node |
| PATCH | /api/canvas/nodes/groups/:id/fit | `{ "nodeIds": ["class-1", "class-2"], "padding": 20 }` | Resize group to fit listed nodes |
| GET | /api/canvas/nodes/:id/distance/:otherId | — | Get x/y distance between two nodes |
| DELETE | /api/canvas/nodes/:id | — | Delete node (returns the deleted node, or 404) |

**Node types:** `classNode`, `textNode`, `groupNode`

**classNode** — For UML classes only (with name, properties, methods). Do NOT use classNode for plain text, annotations, titles, or descriptions — use `textNode` instead.  Can include `name`, `properties`, `methods`, `stereotype`, `color` directly on POST (single-call creation). If omitted, starts as `name: "NewClass"` with empty properties/methods.

**textNode** — For annotations, labels, titles, descriptions, and any free-form text. Always use `textNode` (not `classNode`) when the content is text rather than a UML class with properties/methods. Optional extra fields: `text`, `color`, `borderStyle`, `opacity`, `parentId` (node to connect to), `parentType` (`"classNode"` or `"groupNode"`).

**groupNode** — Created only via `POST /api/canvas/layout/group` (not directly via POST /api/canvas/nodes). Groups visually contain other nodes.

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
| GET | /api/canvas/edges | ?source=id&target=id&relationshipType=inheritance | List edges, optional filters |
| GET | /api/canvas/edges/:id | — | Get edge by ID |
| POST | /api/canvas/edges | `{ "source": "class-1", "target": "class-2", "relationshipType": "inheritance" }` | Create edge (validates nodes exist) |
| POST | /api/canvas/edges/batch | `{ "edges": [...] }` | Batch create edges (atomic undo, max 100, validates nodes) |
| PATCH | /api/canvas/edges/:id | `{ "label": "uses" }` | Update edge data |
| PATCH | /api/canvas/edges/:id/type | `{ "type": "composition" }` | Change relationship type |
| DELETE | /api/canvas/edges/:id | — | Delete edge |
| DELETE | /api/canvas/edges/batch | `{ "ids": ["edge-1", "edge-2"] }` | Bulk delete edges |

**Relationship types:** `inheritance`, `implementation`, `composition`, `aggregation`, `dependency`, `association`

**Optional edge fields (on create and update):** `label`, `color`, `strokeStyle`, `labelWidth`, `labelHeight`, `sourceHandle`, `targetHandle`

**Connection handles:** Each node has 4 side handles: `top`, `bottom`, `left`, `right`. Additionally, each class node property has a handle `prop-{id}` and each method has `method-{id}` — use these to connect edges directly to specific members.

**Auto closest handles (default):** When `sourceHandle` and/or `targetHandle` are omitted, the API automatically computes the closest handle pair based on node positions. For example, if the source node is above the target, `sourceHandle: "bottom"` and `targetHandle: "top"` are used. This produces clean, short edge paths without manual handle selection. You may override one or both handles when you need a specific routing (e.g., forcing a left-to-right connection for horizontal layouts, or connecting to a specific property/method handle).

**Edge stroke styles:** `solid`, `dashed`, `dotted`, `double`

**Batch edge format:** `{ "edges": [{ "source": "class-1", "target": "class-2", "relationshipType": "inheritance", "label": "uses", "color": "#E74C3C", "strokeStyle": "dashed" }, ...] }`

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
| POST | /api/canvas/layout/auto | `{ "strategy": "grid", "gap": 40 }` | Auto-layout all nodes (`grid` or `hierarchical`) |

**rects format:** `[{ "id": "class-1", "x": 100, "y": 200, "w": 180, "h": 120 }, ...]`

**alignment values:** `left`, `center`, `right`, `top`, `middle`, `bottom`

**axis values:** `horizontal`, `vertical`

**Auto-layout strategies:**
- `grid` — arranges nodes in a grid with configurable `gap` (default 40px). Uses measured dimensions for accurate spacing.
- `hierarchical` — arranges inheritance/implementation trees top-down, with roots at top and descendants below. Non-tree nodes placed in a separate row.

### Files

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/files | — | List all open files |
| GET | /api/files/active | — | Get active file |
| PUT | /api/files/active | `{ "path": "models/auth.schemata.json" }` | Switch active file |
| POST | /api/files | `{ "path": "", "name": "NewDiagram" }` | Create new file |
| POST | /api/files/save | — | Save active file |
| POST | /api/files/save-all | — | Save all files |
| POST | /api/files/refresh | — | Rescan folder for new/removed files |
| DELETE | /api/files/:path | — | Delete a file |
| PATCH | /api/files/:path/rename | `{ "name": "NewName" }` | Rename file display name |

### Folder

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/folder | — | Get loaded folder info |
| POST | /api/folder/open | `{ "path": "/absolute/path" }` | Open folder from disk |

### Stats

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/canvas/stats | — | Get canvas statistics (node/edge counts by type, file count, dirty files) |

### Export

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/canvas/export | ?format=json | Export canvas (formats: `json`, `png`, `svg`). PNG/SVG return data URL or SVG string. |
| GET | /api/canvas/export | ?format=png&raw=true | Raw binary PNG (saves directly with `curl -o file.png`). Also works for SVG. |

### Settings

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/settings | — | Get current settings (colorMode, snapToGrid, sidebarCollapsed) |
| PATCH | /api/settings | `{ "colorMode": "dark" }` | Update settings |

### Media & Schema

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/media/images | — | List image asset paths |
| GET | /api/media/pdfs | — | List PDF asset paths |
| GET | /api/schema | — | Get all valid enum values and standard swatch colors |

## Example Workflows

**Important:** POST responses return the created object with its auto-generated ID. Always read the `id` from the response before using it in subsequent calls. Examples below use `class-1` etc. for readability — in practice, capture the ID from the response.

### 1. Create a class with properties and methods (single call)

```bash
# Create a fully populated class node in one POST
curl -s -X POST http://localhost:5173/api/canvas/nodes \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "classNode", "x": 200, "y": 100,
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
# Response: { "data": { "id": "class-1", "data": { "name": "User", ... } } }
```

### 2. Create two classes and connect with inheritance

```bash
# Create parent class
curl -s -X POST http://localhost:5173/api/canvas/nodes \
  -H 'Content-Type: application/json' \
  -d '{"type":"classNode","x":300,"y":100,"name":"Animal"}'

# Create child class
curl -s -X POST http://localhost:5173/api/canvas/nodes \
  -H 'Content-Type: application/json' \
  -d '{"type":"classNode","x":300,"y":350,"name":"Dog"}'

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

### 4. Batch create with inline data

```bash
curl -s -X POST http://localhost:5173/api/canvas/nodes/batch \
  -H 'Content-Type: application/json' \
  -d '{
    "operations": [
      {"op":"create","type":"classNode","x":100,"y":100,"data":{"name":"User","color":"#e8f5e9"}},
      {"op":"create","type":"classNode","x":400,"y":100,"data":{"name":"Order","color":"#e3f2fd"}},
      {"op":"create","type":"classNode","x":250,"y":350,"data":{"name":"Product"}}
    ]
  }'
# Returns { "data": { "results": [{ "id": "class-1", ... }, ...] } }
# Each node is already named — no separate PATCH needed
```

### 5. Batch create edges (atomic undo)

```bash
curl -s -X POST http://localhost:5173/api/canvas/edges/batch \
  -H 'Content-Type: application/json' \
  -d '{
    "edges": [
      {"source":"class-2","target":"class-1","relationshipType":"composition"},
      {"source":"class-2","target":"class-3","relationshipType":"aggregation"},
      {"source":"class-1","target":"class-3","relationshipType":"dependency","label":"uses"}
    ]
  }'
# All edges created in a single undo step
```

### 6. Batch reposition nodes (atomic undo)

```bash
# Move multiple nodes in one call — single undo step
curl -s -X PATCH http://localhost:5173/api/canvas/nodes/positions \
  -H 'Content-Type: application/json' \
  -d '{
    "positions": [
      {"id":"class-1","x":100,"y":100},
      {"id":"class-2","x":400,"y":100},
      {"id":"class-3","x":250,"y":350}
    ]
  }'
```

### 7. Layout and organize

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

### 8. Auto-layout

```bash
# Grid layout (default) — arranges all nodes in a grid
curl -s -X POST http://localhost:5173/api/canvas/layout/auto \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"grid","gap":50}'

# Hierarchical layout — arranges by inheritance tree
curl -s -X POST http://localhost:5173/api/canvas/layout/auto \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"hierarchical"}'

# Fit viewport to show all content after layout
curl -s -X POST http://localhost:5173/api/canvas/viewport/fit \
  -H 'Content-Type: application/json' \
  -d '{"padding":60}'
```

### 9. File management

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
  -d '{"path":"authentication.schemata.json"}'
# Save
curl -s -X POST http://localhost:5173/api/files/save
```

### 10. Open a project folder

```bash
# Open folder from disk
curl -s -X POST http://localhost:5173/api/folder/open \
  -H 'Content-Type: application/json' \
  -d '{"path":"/Users/alice/Projects/MyDiagrams"}'
# Check what was loaded
curl -s http://localhost:5173/api/canvas
```

### 11. Undo a mistake

```bash
# Undo last action
curl -s -X POST http://localhost:5173/api/canvas/undo
# Verify state
curl -s http://localhost:5173/api/canvas/nodes
# Redo if undo was wrong
curl -s -X POST http://localhost:5173/api/canvas/redo
```

### 12. Clear canvas and start fresh

```bash
# Clear all nodes and edges (single undo step)
curl -s -X POST http://localhost:5173/api/canvas/clear
# Canvas is now empty but file is preserved
```

### 13. Duplicate and explore connections

```bash
# Duplicate nodes with offset
curl -s -X POST http://localhost:5173/api/canvas/nodes/duplicate \
  -H 'Content-Type: application/json' \
  -d '{"ids":["class-1","class-2"],"offsetX":50,"offsetY":50}'

# Get connections for a node
curl -s http://localhost:5173/api/canvas/nodes/class-1/connections

# Get inheritance hierarchy
curl -s 'http://localhost:5173/api/canvas/nodes/class-1/hierarchy?direction=descendants'

# Find orphan nodes (no edges)
curl -s http://localhost:5173/api/canvas/nodes/orphans

# Detect overlapping nodes (excludes group–child overlaps)
curl -s http://localhost:5173/api/canvas/nodes/overlaps
# → { "data": [{ "nodeA": "class-1", "nodeB": "class-2", "overlapArea": 5000 }, ...] }
# Use this after layout to find and fix visual collisions
```

### 14. Canvas stats and export

```bash
# Get stats overview
curl -s http://localhost:5173/api/canvas/stats

# Export as JSON
curl -s 'http://localhost:5173/api/canvas/export?format=json'

# Export as SVG
curl -s 'http://localhost:5173/api/canvas/export?format=svg'

# Export raw PNG directly to file (no base64 decoding needed)
curl -s -o /tmp/schemata-layout.png 'http://localhost:5173/api/canvas/export?format=png&raw=true'
# Then use the Read tool on /tmp/schemata-layout.png to view it
```

### 15. Bulk operations

```bash
# Batch create edges
curl -s -X POST http://localhost:5173/api/canvas/edges/batch \
  -H 'Content-Type: application/json' \
  -d '{"edges":[
    {"source":"class-1","target":"class-2","relationshipType":"inheritance"},
    {"source":"class-3","target":"class-1","relationshipType":"composition"}
  ]}'

# Bulk delete nodes
curl -s -X DELETE http://localhost:5173/api/canvas/nodes/batch \
  -H 'Content-Type: application/json' \
  -d '{"ids":["class-1","class-2","class-3"]}'

# Bulk delete edges
curl -s -X DELETE http://localhost:5173/api/canvas/edges/batch \
  -H 'Content-Type: application/json' \
  -d '{"ids":["edge-1","edge-2","edge-3"]}'
```

### 16. Resize group to fit nodes

```bash
# Resize group-1 to encompass class-1 and class-2 with default 20px padding
curl -s -X PATCH http://localhost:5173/api/canvas/nodes/groups/group-1/fit \
  -H 'Content-Type: application/json' \
  -d '{"nodeIds":["class-1","class-2"]}'

# With custom padding
curl -s -X PATCH http://localhost:5173/api/canvas/nodes/groups/group-1/fit \
  -H 'Content-Type: application/json' \
  -d '{"nodeIds":["class-1","class-2","class-3"],"padding":40}'
```

### 17. Measure distance between nodes

```bash
# Get x/y distance and Euclidean distance between two nodes
curl -s http://localhost:5173/api/canvas/nodes/class-1/distance/class-2
# → { "data": { "from": { "id": "class-1", "x": 100, "y": 100 }, "to": { "id": "class-2", "x": 400, "y": 500 }, "dx": 300, "dy": 400, "distance": 500 } }
```

### 18. Visual layout verification via PNG export

Use this to see the actual rendered layout and iterate on positioning. This is essential for large diagrams — always verify visually before considering layout done.

```bash
# Preferred: raw PNG export (no decoding needed)
curl -s -o /tmp/schemata-layout.png 'http://localhost:5173/api/canvas/export?format=png&raw=true'
# Then use the Read tool on /tmp/schemata-layout.png to view it

# Alternative: base64 JSON export (if raw doesn't work)
curl -s 'http://localhost:5173/api/canvas/export?format=png' | python3 -c "
import json, sys, base64
raw = json.load(sys.stdin)
if 'data' in raw and raw['data']:
    b64 = raw['data'].split(',', 1)[1]
    with open('/tmp/schemata-layout.png', 'wb') as f:
        f.write(base64.b64decode(b64))
    print('Saved to /tmp/schemata-layout.png')
else:
    print('Export failed:', raw)
"
```

**If export times out** (bridge timeout — browser tab not focused), wait and retry:
```bash
sleep 2 && curl -s -o /tmp/schemata-layout.png --max-time 30 'http://localhost:5173/api/canvas/export?format=png&raw=true'
```

**Iterate:** Export → Read image → identify issues → reposition nodes → re-export → verify again.

### 19. Building large architecture diagrams

For diagrams with many nodes (20+), follow this phased workflow:

```bash
# Phase 1: Create all nodes with batch + inline data (single call)
curl -s -X POST http://localhost:5173/api/canvas/nodes/batch \
  -H 'Content-Type: application/json' \
  -d '{"operations":[
    {"op":"create","type":"classNode","x":0,"y":0,"data":{"name":"User","stereotype":"interface","color":"#e3f2fd"}},
    {"op":"create","type":"classNode","x":0,"y":0,"data":{"name":"Order","color":"#e8f5e9"}}
  ]}'
# IMPORTANT: Capture IDs from the response — IDs never recycle after deletion

# Phase 2: Add properties/methods to nodes that need them
curl -s -X PATCH http://localhost:5173/api/canvas/nodes/class-1 \
  -H 'Content-Type: application/json' \
  -d '{"properties":[...],"methods":[...]}'

# Phase 3: Batch create all edges (single call, single undo)
curl -s -X POST http://localhost:5173/api/canvas/edges/batch \
  -H 'Content-Type: application/json' \
  -d '{"edges":[
    {"source":"class-1","target":"class-2","relationshipType":"composition"},
    {"source":"class-2","target":"class-3","relationshipType":"inheritance"}
  ]}'

# Phase 4: Auto-layout for initial positioning
curl -s -X POST http://localhost:5173/api/canvas/layout/auto \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"hierarchical"}'

# Phase 5: Get measured dimensions (browser-rendered sizes)
curl -s http://localhost:5173/api/canvas/nodes | python3 -c "
import json, sys
for n in json.load(sys.stdin)['data']:
    m = n.get('measured', {})
    print(f'{n[\"id\"]:10s} x={n[\"position\"][\"x\"]:5.0f} y={n[\"position\"][\"y\"]:5.0f} w={m.get(\"width\",180):4.0f} h={m.get(\"height\",100):4.0f}  {n[\"data\"].get(\"name\",\"\")}')"

# Phase 6: Fine-tune positions (batch — single undo)
curl -s -X PATCH http://localhost:5173/api/canvas/nodes/positions \
  -H 'Content-Type: application/json' \
  -d '{"positions":[{"id":"class-1","x":100,"y":100},{"id":"class-2","x":400,"y":100}]}'

# Phase 7: Create groups using measured dimensions as rects
curl -s -X POST http://localhost:5173/api/canvas/layout/group \
  -H 'Content-Type: application/json' \
  -d '{"rects":[{"id":"class-1","x":100,"y":100,"w":201,"h":182},{"id":"class-2","x":350,"y":100,"w":180,"h":150}]}'
curl -s -X PATCH http://localhost:5173/api/canvas/nodes/group-1 \
  -H 'Content-Type: application/json' -d '{"label":"My Group","color":"#e3f2fd"}'

# Phase 8: Add text annotations
curl -s -X POST http://localhost:5173/api/canvas/nodes \
  -H 'Content-Type: application/json' \
  -d '{"type":"textNode","x":500,"y":100,"text":"### Section Title\n\nDescription here.","color":"#e3f2fd","borderStyle":"dashed"}'

# Phase 9: Fit viewport and export PNG to verify
curl -s -X POST http://localhost:5173/api/canvas/viewport/fit \
  -H 'Content-Type: application/json' -d '{}'
curl -s -o /tmp/schemata-layout.png 'http://localhost:5173/api/canvas/export?format=png&raw=true'
# Read with Read tool, iterate as needed

# Phase 10: Save
curl -s -X POST http://localhost:5173/api/files/save
```

## Tips

### IDs and State
- **IDs are auto-generated**: `class-N`, `text-N`, `edge-N`, `group-N`
- **IDs never recycle**: Deleting `text-1` through `text-5` means the next text node is `text-6`, not `text-1`. Always capture the ID from POST responses instead of guessing.
- **Read before mutate**: Always GET current state before making changes
- **Save frequently**: The canvas is in-memory; use `POST /api/files/save` to persist

### Creating Nodes
- **Single-call creation**: POST classNode with `name`, `properties`, `methods`, `stereotype`, `color` inline — no separate PATCH needed.
- **Batch with inline data**: Use `/nodes/batch` with `data` field on each create op for named nodes in one call (up to 100).
- **Properties/methods are arrays**: To add one, send the full updated array (not just the new item)
- **Text nodes as annotations**: Create textNode with `parentId` to auto-connect to a class

### Text Nodes
- **Use textNode for text, not classNode**: If the content is text (annotations, titles, descriptions, comments), always use `textNode`. Never put text into a `classNode` — classNodes are strictly for UML classes with properties and methods.
- **Width is auto-determined by content**: Text nodes auto-size to fit their text. Use explicit `\n` line breaks to control width — long unbroken lines produce very wide nodes.
- **Markdown supported**: Text nodes render markdown. Use `###` headers, `**bold**`, `\n` newlines.
- **Color and border**: Set `color` for background tint, `borderStyle` for visual emphasis (`"dashed"` works well for comments).

### Batch Operations
- **Batch positions**: Use `PATCH /nodes/positions` to move many nodes in one call with a single undo step (max 200).
- **Batch edges**: Use `POST /edges/batch` to create many edges in one call with a single undo step (max 100).
- **Batch delete nodes**: Use `DELETE /nodes/batch` to remove many nodes at once (max 100).
- **Batch delete edges**: Use `DELETE /edges/batch` to remove many edges at once (max 100).
- **Node validation**: Edge creation (both single and batch) validates that source and target nodes exist before creating.

### Groups and Layout
- **Auto-layout**: Use `POST /layout/auto` with `"strategy":"grid"` or `"strategy":"hierarchical"` for automatic positioning. Great as a starting point before fine-tuning.
- **Groups**: Use `POST /api/canvas/layout/group` with rects to create groupNodes. Position child nodes first, then create the group.
- **Moving groups moves children**: When you move a group node via `PATCH /nodes/:id/position` or `PATCH /nodes/positions`, all child nodes inside the group are automatically moved by the same delta. This matches the UI drag behavior.
- **Measured dimensions**: GET nodes returns `measured.width` and `measured.height` — the actual browser-rendered pixel sizes. Use these for accurate `rects` in layout/group and fitGroupToNodes calls.
- **Overlap detection**: Use `GET /nodes/overlaps` after layout to find visual collisions. Returns pairs with `overlapArea` in pixels². Group–child overlaps are excluded (they're expected). Fix overlaps by repositioning with `PATCH /nodes/positions`.
- **Fit groups after moves**: When you reposition nodes inside a group (not the group itself), the group boundary does NOT auto-resize. Call `PATCH /nodes/groups/:id/fit` with the updated nodeIds to resize the group.
- **Label and color groups**: After creating a group, PATCH it with `{"label":"Name","color":"#hex"}` for visual organization.
- **Measure spacing**: Use `/nodes/:id/distance/:otherId` to check distances before aligning or distributing

### Styling and Color Consistency

Using consistent colors across nodes and edges makes diagrams significantly easier to read. Choose a color palette upfront and apply it systematically by layer/domain/concern.

**Standard swatch colors:** Fetch the app's built-in color palette via `GET /api/schema` — the `colors` array returns `[{ "hex": "#4A90D9", "name": "Blue" }, ...]`. These are the same colors available in the UI's context menu. Use these for edges and accents to stay consistent with the visual theme.

**Recommended approach:** Assign one color per logical group or architectural layer. Use the same palette for both node backgrounds and group backgrounds, with swatch colors for edges.

**Example palettes:**

| Layer | Node color | Group color | Purpose |
|-------|-----------|-------------|---------|
| Data model | `#e3f2fd` (light blue) | `#e3f2fd` | Entities, schemas, interfaces |
| Business logic | `#e8f5e9` (light green) | `#e8f5e9` | Services, controllers, use cases |
| Infrastructure | `#f3e5f5` (light purple) | `#f3e5f5` | Server, routes, adapters |
| Utilities | `#fff9c4` (light yellow) | `#fff9c4` | Helpers, shared utilities |
| Warning/critical | `#fce4ec` (light red) | `#fce4ec` | Deprecated, to-be-refactored |

**Edge colors by relationship type (using swatch colors):**

| Relationship | Suggested color | Suggested stroke |
|-------------|----------------|-----------------|
| inheritance | (default — no color) | `solid` |
| implementation | (default) | `dashed` |
| composition | `#4A90D9` (Blue swatch) | `solid` |
| aggregation | `#2ECC71` (Green swatch) | `solid` |
| dependency | `#E67E22` (Orange swatch) | `dashed` |
| association | `#34495E` (Dark Gray swatch) | `solid` |

**Styling nodes on create:**
```bash
curl -s -X POST http://localhost:5173/api/canvas/nodes \
  -H 'Content-Type: application/json' \
  -d '{"type":"classNode","x":100,"y":100,"name":"UserService","color":"#e8f5e9","stereotype":"service"}'
```

**Styling edges on create (handles auto-computed from positions):**
```bash
curl -s -X POST http://localhost:5173/api/canvas/edges \
  -H 'Content-Type: application/json' \
  -d '{
    "source":"class-1","target":"class-2","relationshipType":"dependency",
    "label":"calls","color":"#E65100","strokeStyle":"dashed"
  }'
```

**Override handles for explicit routing (e.g., forced left→right):**
```bash
curl -s -X POST http://localhost:5173/api/canvas/edges \
  -H 'Content-Type: application/json' \
  -d '{
    "source":"class-1","target":"class-2","relationshipType":"dependency",
    "sourceHandle":"right","targetHandle":"left"
  }'
```

**Batch edges with consistent styling:**
```bash
curl -s -X POST http://localhost:5173/api/canvas/edges/batch \
  -H 'Content-Type: application/json' \
  -d '{"edges":[
    {"source":"class-1","target":"class-2","relationshipType":"composition","color":"#1565C0"},
    {"source":"class-1","target":"class-3","relationshipType":"dependency","color":"#E65100","strokeStyle":"dashed","label":"uses"},
    {"source":"class-2","target":"class-3","relationshipType":"association","color":"#757575"}
  ]}'
```

**Key principles:**
- Pick colors **before** creating nodes — retrofitting is tedious
- Use **pastel/light** colors for node and group backgrounds (dark backgrounds clash with text)
- Use **saturated** colors for edge lines (they need to stand out against the canvas)
- Keep inheritance/implementation edges in the **default color** — they're the structural backbone and should look neutral
- Color-code **dependency** and **association** edges to distinguish them at a glance
- Groups should match the color of the nodes they contain

### Edges
- **Auto closest handles**: Omit `sourceHandle`/`targetHandle` and the API picks the closest pair based on node positions. This is the recommended default — only specify handles when you need explicit routing (e.g., horizontal left→right layouts, connecting to a specific property/method handle).
- **Node validation**: Edge creation validates source/target exist — no more silent broken edges.
- **Style on create**: Pass `label`, `color`, `strokeStyle` directly on `POST /edges` and `POST /edges/batch` — no separate PATCH needed.
- **Reduce clutter on large diagrams**: If A composes B and both depend on C, the B→C dependency edge is visually implied through A. Remove transitive dependency edges with `DELETE /edges/batch` to keep the diagram readable.
- **Label key edges**: Use `label` on create or `PATCH /edges/:id` with `{"label":"description"}` to annotate important relationships (e.g., "RPC calls", "reads state").
- **Wildcards in search**: `*` matches any characters, `?` matches exactly one

### Visual Verification
- **Always verify layout visually**: For any non-trivial diagram, export PNG → save to `/tmp` → read with the Read tool. This is the only reliable way to see the actual rendered layout.
- **Raw PNG export**: Use `?format=png&raw=true` with `curl -o /tmp/file.png` — no Python base64 decoding needed.
- **Fit viewport first**: Call `POST /canvas/viewport/fit` before exporting to ensure all content is visible.
- **Export timeout**: PNG export has a 30-second timeout (increased from 10s). If you get "Bridge timeout", the browser tab may not be focused — wait 2 seconds and retry.
- **Iterate**: Export → identify issues (overlaps, edge congestion, spacing) → reposition → re-export. Expect 2-3 rounds for large diagrams.

### Canvas Management
- **Clear canvas**: Use `POST /canvas/clear` to remove all nodes and edges while keeping the file. Undoable.
- **Delete returns data**: `DELETE /nodes/:id` returns the deleted node data (useful for confirming what was removed) or 404 if not found.

### Advanced
- **Hierarchy traversal**: Use `/nodes/:id/hierarchy` to explore class trees (direction: `ancestors`, `descendants`, `both`)
- **Duplicate preserves edges**: `/nodes/duplicate` clones nodes AND remaps edges between duplicated nodes
- **Stats for overview**: Use `/canvas/stats` to quickly assess diagram complexity before making changes
