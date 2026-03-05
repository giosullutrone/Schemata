# CodeCanvas Claude Code Plugin — Design

**Goal:** Create a standalone Claude Code plugin that teaches Claude how to manipulate UML diagrams on the CodeCanvas via its REST API (31 endpoints running as Vite middleware).

**Architecture:** A single-skill plugin. The skill's SKILL.md contains trigger metadata, a compact API reference, workflow guidance, and example curl workflows. Claude uses the Bash tool to issue curl commands — no MCP server or extra infrastructure needed.

---

## Plugin Structure

```
codecanvas-plugin/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── canvas-api/
        └── SKILL.md
```

### plugin.json

```json
{
  "name": "codecanvas",
  "description": "Claude Code plugin for manipulating UML diagrams via the CodeCanvas REST API",
  "version": "1.0.0"
}
```

---

## Skill Design

### Triggering

The skill triggers on canvas-related user requests — creating classes, drawing relationships, laying out diagrams, searching the canvas, managing files, etc.

Frontmatter description (tuned for reliable triggering):

```yaml
name: canvas-api
description: >
  This skill should be used when the user asks to "create a class diagram",
  "add a class node", "connect two classes", "add an inheritance relationship",
  "lay out the diagram", "search the canvas", "add a text note",
  "create a UML diagram", "modify the canvas", "save the diagram",
  "open a project folder", "undo", or mentions CodeCanvas API operations.
  Activates for any request involving visual diagram manipulation on the CodeCanvas.
```

### SKILL.md Body Sections

#### 1. Prerequisites

Remind Claude the Vite dev server must be running. The API lives at `http://localhost:5173/api` (port may vary). Always verify with `GET /api/health` first.

#### 2. Workflow Guidance

Recommended order of operations:
- Verify server: `GET /api/health`
- Check available types: `GET /api/schema`
- Read current state: `GET /api/canvas/nodes` before making changes
- Create nodes first, then edges
- Use `POST /api/canvas/undo` if something goes wrong
- Save work: `POST /api/files/save`

#### 3. API Reference (Inline)

Compact table of all 31 endpoints:

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | /api/health | — | Server liveness check |
| GET | /api/canvas | — | Get active canvas (nodes, edges, metadata) |
| GET | /api/canvas/viewport | — | Get viewport (x, y, zoom) |
| PUT | /api/canvas/viewport | `{x, y, zoom}` | Set viewport |
| GET | /api/canvas/nodes | ?type= | List nodes, optional type filter |
| GET | /api/canvas/nodes/:id | — | Get node by ID |
| POST | /api/canvas/nodes | `{type, x, y, ...}` | Create node (classNode or textNode) |
| POST | /api/canvas/nodes/batch | `{operations: [...]}` | Batch create/update/delete |
| PATCH | /api/canvas/nodes/:id | `{key: value, ...}` | Update node data |
| PATCH | /api/canvas/nodes/:id/position | `{x, y}` | Move node |
| DELETE | /api/canvas/nodes/:id | — | Delete node |
| GET | /api/canvas/edges | ?source=&target= | List edges, optional filters |
| GET | /api/canvas/edges/:id | — | Get edge by ID |
| POST | /api/canvas/edges | `{source, target, relationshipType, sourceHandle?, targetHandle?}` | Create edge |
| PATCH | /api/canvas/edges/:id | `{key: value, ...}` | Update edge data |
| PATCH | /api/canvas/edges/:id/type | `{type}` | Change relationship type |
| DELETE | /api/canvas/edges/:id | — | Delete edge |
| GET | /api/canvas/search | ?q=&type= | Wildcard search nodes/edges |
| POST | /api/canvas/undo | — | Undo last action |
| POST | /api/canvas/redo | — | Redo last undone action |
| POST | /api/canvas/layout/align | `{rects, alignment}` | Align nodes |
| POST | /api/canvas/layout/distribute | `{rects, axis}` | Distribute nodes |
| POST | /api/canvas/layout/group | `{rects}` | Group selected nodes |
| GET | /api/files | — | List all open files |
| GET | /api/files/active | — | Get active file |
| PUT | /api/files/active | `{path}` | Switch active file |
| POST | /api/files | `{path, name}` | Create new file |
| POST | /api/files/save | — | Save active file |
| POST | /api/files/save-all | — | Save all files |
| GET | /api/folder | — | Get loaded folder info |
| POST | /api/folder/open | `{path}` | Open folder from disk |
| GET | /api/media/images | — | List image asset paths |
| GET | /api/media/pdfs | — | List PDF asset paths |
| GET | /api/schema | — | Get all valid enum values |

#### 4. Example Workflows

Eight curl-based examples showing common multi-step operations:

1. **Create a class with properties and methods** — POST classNode, PATCH to add properties/methods
2. **Create two classes and connect with inheritance** — POST two classNodes, POST edge with `relationshipType: "inheritance"`
3. **Search and update a node** — GET search with wildcard, PATCH the found node
4. **Batch create a multi-class diagram** — POST batch with multiple create + update operations
5. **Layout and organize** — GET nodes to collect rects, POST align/distribute
6. **File management** — GET files, POST create, PUT switch active, POST save
7. **Open a project folder** — POST folder/open with path, GET canvas to see contents
8. **Undo a mistake** — POST undo, GET canvas to verify state

#### 5. Tips

- All responses wrap data in `{ data: ... }`
- Use batch endpoint for multiple operations in one call
- Node types: `classNode`, `textNode`
- Relationship types: check `GET /api/schema` for current list (inheritance, implementation, association, aggregation, composition, dependency)
- Wildcard search: `*` matches any chars, `?` matches one char
- Port defaults to `5173` but may vary — check the running Vite server

---

## Decisions

- **No MCP server**: The REST API is already well-designed. Claude uses curl via Bash. Adding an MCP proxy doubles maintenance.
- **No slash commands**: The skill handles freeform requests. Fixed commands would be too rigid for the variety of canvas operations.
- **Inline API reference**: ~1-2k tokens but guarantees Claude always has the full API available when the skill triggers.
- **Single skill**: All 31 endpoints are logically connected (they all manipulate the same canvas). Splitting into multiple skills would cause triggering ambiguity.

---

## Files to Create

| File | Description |
|------|-------------|
| `codecanvas-plugin/.claude-plugin/plugin.json` | Plugin manifest |
| `codecanvas-plugin/skills/canvas-api/SKILL.md` | Skill definition with API reference and examples |
