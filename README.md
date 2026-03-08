# Schemata

**Visual UML diagram editor with built-in Claude Code collaboration.**

![React](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue) ![Vite](https://img.shields.io/badge/Vite-6-purple) ![License](https://img.shields.io/badge/License-MIT-green)

---

## What is Schemata?

Schemata is an interactive UML class diagram editor built with React and [xyflow](https://github.com/xyflow/xyflow). It lets you visually design software architecture — classes, relationships, annotations — and persist everything as `.schemata.json` files.

What makes it unique: Schemata exposes a REST API that Claude Code can use to read and manipulate diagrams programmatically. Describe what you want in natural language, and Claude builds the diagram for you — or you build it visually and Claude extends it. Both directions work seamlessly.

---

## Features

### Canvas Editing
- **Class nodes** — UML 3-compartment layout with properties, methods, visibility, stereotypes (`interface`, `abstract`, `enum`)
- **Text nodes** — Markdown-enabled annotations with customizable borders, alignment, and opacity
- **Group nodes** — Visual containers to organize related classes
- **Inline editing** — Double-click any field to edit in place
- **Multi-select** — Shift+click or drag-select, then align, distribute, or group

### UML Relationships
Six relationship types with distinct visual markers:

| Type | Line | Marker |
|------|------|--------|
| Inheritance | Solid | Hollow triangle |
| Implementation | Dashed | Hollow triangle |
| Composition | Solid | Filled diamond |
| Aggregation | Solid | Hollow diamond |
| Dependency | Dashed | Open arrow |
| Association | Solid | Open arrow |

### File Management
- Open project folders and browse `.schemata.json` files in a sidebar tree
- Create, switch, rename, and delete diagram files
- Auto-save with debounced writes
- Works with the File System Access API (Chrome/Edge) or via the REST API

### Layout & Alignment
- Snap-to-grid (20×20px) or snap-to-guide alignment
- Align selected nodes: left, center, right, top, middle, bottom
- Distribute nodes evenly across horizontal or vertical axes
- Group nodes into visual containers

### Themes & Export
- Light and dark mode (follows system preference or manual toggle)
- Export diagrams as PNG or SVG
- Configurable snap modes: grid, guides, or none

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/schemata.git
cd schemata

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Click **Open Folder** to load a directory with `.schemata.json` files, or start a new diagram from scratch.

### Creating Your First Diagram

1. Press **Shift+N** to create a class node
2. Double-click the class name to rename it
3. Right-click to add properties and methods
4. Drag from a node handle to another node to create a relationship
5. Press **Ctrl+S** to save

---

## Claude Code Plugin

Schemata ships with a Claude Code plugin that lets Claude read and manipulate your diagrams through natural language.

### Installation

```bash
# Register the local marketplace
claude plugin marketplace add /path/to/schemata/schemata-plugin

# Install the plugin
claude plugin install schemata@schemata-marketplace
```

> Replace `/path/to/schemata` with the actual path to your clone.

Make sure the Schemata dev server is running (`npm run dev`) before using the plugin.

### What It Enables

Once installed, you can ask Claude things like:

- *"Create a class diagram for a user authentication system"*
- *"Add an inheritance relationship between Dog and Animal"*
- *"Add a `login` method to the UserService class"*
- *"Group all the database-related classes together"*
- *"Search for all classes with 'Service' in the name"*

Claude uses the `canvas-api` skill to issue curl commands against Schemata's REST API, creating and modifying nodes and edges in real time on your canvas.

### Example: Claude Creating a Diagram

When you ask Claude to create a class diagram, it runs commands like:

```bash
# Create a class node
curl -s -X POST http://localhost:5173/api/canvas/nodes \
  -H 'Content-Type: application/json' \
  -d '{"type":"classNode","x":200,"y":100}'

# Name it and add methods
curl -s -X PATCH http://localhost:5173/api/canvas/nodes/class-1 \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "UserService",
    "methods": [
      {"id":"m1","name":"authenticate","parameters":[{"name":"token","type":"string"}],"returnType":"boolean","visibility":"public"}
    ]
  }'

# Connect two classes with inheritance
curl -s -X POST http://localhost:5173/api/canvas/edges \
  -H 'Content-Type: application/json' \
  -d '{"source":"class-2","target":"class-1","relationshipType":"inheritance"}'
```

You see the diagram update live in the browser as Claude works.

---

## File Format

Schemata persists diagrams as `.schemata.json` files — plain JSON that's easy to version control and diff.

```json
{
  "version": "1.0",
  "name": "Authentication System",
  "nodes": [
    {
      "id": "class-1",
      "type": "classNode",
      "position": { "x": 200, "y": 100 },
      "data": {
        "name": "User",
        "stereotype": "abstract",
        "properties": [
          { "id": "p1", "name": "email", "type": "String", "visibility": "private" }
        ],
        "methods": [
          { "id": "m1", "name": "login", "parameters": [{ "name": "password", "type": "String" }], "returnType": "boolean", "visibility": "public" }
        ]
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "class-2",
      "target": "class-1",
      "type": "uml",
      "data": { "relationshipType": "inheritance" }
    }
  ]
}
```

**Node types:** `classNode`, `textNode`, `groupNode`

**Relationship types:** `inheritance`, `implementation`, `composition`, `aggregation`, `dependency`, `association`

---

## REST API

The API runs as Hono middleware on the Vite dev server at `http://localhost:5173/api`. All responses use `{ "data": ... }` or `{ "error": "message" }`.

### Endpoints

| Category | Method | Path | Description |
|----------|--------|------|-------------|
| **Health** | GET | `/api/health` | Liveness check |
| **Canvas** | GET | `/api/canvas` | Get active canvas (nodes, edges, viewport) |
| | GET | `/api/canvas/viewport` | Get viewport position and zoom |
| | PUT | `/api/canvas/viewport` | Set viewport |
| **Nodes** | GET | `/api/canvas/nodes` | List nodes (optional `?type=` filter) |
| | GET | `/api/canvas/nodes/:id` | Get node by ID |
| | POST | `/api/canvas/nodes` | Create node |
| | POST | `/api/canvas/nodes/batch` | Batch create/update/delete |
| | PATCH | `/api/canvas/nodes/:id` | Update node data |
| | PATCH | `/api/canvas/nodes/:id/position` | Move node |
| | DELETE | `/api/canvas/nodes/:id` | Delete node |
| **Edges** | GET | `/api/canvas/edges` | List edges (optional `?source=`/`?target=`) |
| | GET | `/api/canvas/edges/:id` | Get edge by ID |
| | POST | `/api/canvas/edges` | Create edge |
| | PATCH | `/api/canvas/edges/:id` | Update edge data |
| | PATCH | `/api/canvas/edges/:id/type` | Change relationship type |
| | DELETE | `/api/canvas/edges/:id` | Delete edge |
| **Search** | GET | `/api/canvas/search` | Wildcard search (`?q=User*&type=classNode`) |
| **History** | POST | `/api/canvas/undo` | Undo last action |
| | POST | `/api/canvas/redo` | Redo last undone action |
| **Layout** | POST | `/api/canvas/layout/align` | Align nodes |
| | POST | `/api/canvas/layout/distribute` | Distribute nodes evenly |
| | POST | `/api/canvas/layout/group` | Group nodes into a container |
| **Files** | GET | `/api/files` | List open files |
| | GET | `/api/files/active` | Get active file |
| | PUT | `/api/files/active` | Switch active file |
| | POST | `/api/files` | Create new file |
| | POST | `/api/files/save` | Save active file |
| | POST | `/api/files/save-all` | Save all files |
| **Folder** | GET | `/api/folder` | Get loaded folder info |
| | POST | `/api/folder/open` | Open folder from disk |
| **Media** | GET | `/api/media/images` | List image assets |
| | GET | `/api/media/pdfs` | List PDF assets |
| **Schema** | GET | `/api/schema` | Get valid enum values |

For detailed request/response examples, see [`schemata-plugin/skills/canvas-api/SKILL.md`](schemata-plugin/skills/canvas-api/SKILL.md).

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Shift+N** | Create class node |
| **N** | Create text node |
| **Ctrl+A** | Select all |
| **Ctrl+C / V** | Copy / Paste |
| **Ctrl+D** | Duplicate selection |
| **Ctrl+Z** | Undo |
| **Ctrl+Shift+Z** / **Ctrl+Y** | Redo |
| **Ctrl+S** | Save |
| **Ctrl+Shift+S** | Save all |
| **Ctrl+B** | Toggle sidebar |
| **Ctrl+0** | Zoom to fit |
| **Delete** / **Backspace** | Delete selection |

---

## Tech Stack

- **[React 19](https://react.dev)** — UI framework
- **[xyflow](https://github.com/xyflow/xyflow)** — Canvas rendering and interaction
- **[Zustand](https://github.com/pmndrs/zustand)** — State management with undo/redo middleware
- **[Hono](https://hono.dev)** — REST API (runs as Vite dev middleware)
- **[Vite](https://vite.dev)** — Build tool and dev server
- **[TypeScript](https://www.typescriptlang.org)** — Type safety
- **[Vitest](https://vitest.dev)** — Unit testing
- **[react-markdown](https://github.com/remarkjs/react-markdown)** — Markdown rendering in text nodes
- **[html-to-image](https://github.com/nicolo-ribaudo/html-to-image)** — PNG/SVG export

---

## Development

### Scripts

```bash
npm run dev       # Start dev server with API middleware
npm run build     # TypeScript check + production build
npm run test      # Run unit tests (Vitest)
npm run lint      # ESLint check
npm run preview   # Preview production build
```

### Project Structure

```
src/
├── components/       # React components (ClassNode, TextNode, GroupNode, Sidebar, etc.)
│   └── edges/        # UML edge renderers and marker configs
├── server/           # Hono REST API
│   └── routes/       # Endpoint handlers (canvas, nodes, edges, files, etc.)
├── store/            # Zustand state management + undo middleware
├── types/            # TypeScript interfaces (.schemata.json schema)
├── utils/            # File I/O, folder tree, alignment, image cache
├── bridge/           # Client-server communication layer
├── hooks/            # Custom React hooks
└── test/             # Test setup

schemata-plugin/      # Claude Code plugin
├── .claude-plugin/
│   └── plugin.json   # Plugin manifest
└── skills/
    └── canvas-api/
        └── SKILL.md  # API reference and workflow examples
```

### Testing

Tests cover state management, API endpoints, file I/O, search, and layout operations:

```bash
npm run test
```

---

## License

MIT
