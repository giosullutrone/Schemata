# Schemata Design

A visual code architecture tool built with @xyflow/react for collaborative class diagram design between developers and Claude Code.

## Overview

Schemata is a monolithic SPA (Vite + React + TypeScript) that renders UML-style class diagrams on an interactive canvas. Nodes represent classes with properties and methods. Edges represent UML relationships. The architecture is persisted as a `.schemata.json` file that Claude Code can read and write, enabling fully collaborative design — either side can add, modify, or remove elements.

## File Format (`.schemata.json`)

```json
{
  "version": "1.0",
  "name": "MyProject Architecture",
  "canvases": {
    "main": {
      "name": "Main Architecture",
      "nodes": [
        {
          "id": "class-1",
          "type": "classNode",
          "position": { "x": 100, "y": 200 },
          "data": {
            "name": "UserService",
            "stereotype": "interface",
            "comment": "Handles all user-related operations",
            "color": "#4A90D9",
            "properties": [
              { "name": "db", "type": "Database", "visibility": "private", "comment": "Main database connection" }
            ],
            "methods": [
              {
                "name": "getUser",
                "parameters": [{ "name": "id", "type": "string" }],
                "returnType": "User",
                "visibility": "public",
                "comment": "Returns null if not found"
              }
            ]
          }
        }
      ],
      "edges": [
        {
          "id": "edge-1",
          "source": "class-1",
          "target": "class-2",
          "type": "dependency",
          "data": {
            "label": "uses",
            "comment": "Injected via constructor",
            "color": "#E74C3C"
          }
        }
      ]
    }
  }
}
```

### Key decisions

- Multi-canvas support built into the format via the `canvases` map
- Nodes follow React Flow's structure with a `data` payload for class details
- Visibility uses `public`, `private`, `protected`
- Edge types: `inheritance`, `implementation`, `composition`, `aggregation`, `dependency`, `association`
- Comments on nodes, properties, methods, and edges
- Colors on nodes (header/border) and edges (line/arrowhead)

## Node Component (UML Class Box)

Three-compartment UML layout:

```
+----------------------------+
|       <<interface>>        |  <- optional stereotype
|        UserService         |  <- class name (bold)
+----------------------------+
| - db: Database             |  <- properties
| - cache: Cache             |     (visibility symbol + name + type)
+----------------------------+
| + getUser(id: string): User|  <- methods
| + deleteUser(id: string): void |
+----------------------------+
```

### Visual details

- Visibility symbols: `+` public, `-` private, `#` protected
- Stereotypes: Optional label above the name (`<<interface>>`, `<<abstract>>`, `<<enum>>`)
- White background, subtle border, monospace font for types
- Connection handles on all four sides
- Comment icon in the top-right corner (visible when comment exists, faint on hover when empty)
- Color applies to the header section and border

### Inline editing

- Double-click any text to edit in place (Enter to confirm, Escape to cancel)
- `+` button at the bottom of properties and methods sections to add entries
- Hover reveals `x` on each property/method row to remove it
- Comment icon click expands a text area for the comment
- Right-click context menu for color picker, delete

## Edge Types (UML Relationships)

| Type             | Line Style  | Arrow                       |
|------------------|-------------|-----------------------------|
| Inheritance      | Solid line  | Hollow triangle at target   |
| Implementation   | Dashed line | Hollow triangle at target   |
| Composition      | Solid line  | Filled diamond at source    |
| Aggregation      | Solid line  | Hollow diamond at source    |
| Dependency       | Dashed line | Open arrow at target        |
| Association      | Solid line  | Open arrow at target        |

### Edge interactions

- Drag from a handle to another node; a popup appears to select relationship type
- Label defaults to the type name, editable via double-click
- Right-click context menu: change type, color, comment, delete

## App Layout

```
+-------------------------------------------------+
|  Toolbar                                        |
|  [New Class] [Save] [Load] [Canvas Selector v]  |
+-------------------------------------------------+
|                                                 |
|              Canvas (React Flow)                |
|                                                 |
+-------------------------------------------------+
```

- Toolbar: actions for creating nodes, save/load, canvas switching
- Canvas: React Flow viewport filling remaining space
- No sidebar — all editing is inline

### Canvas management

- Dropdown selector in toolbar listing all canvases
- Create new canvas (prompts for name)
- Rename/delete canvas via right-click on dropdown items

### File operations

- Save: Ctrl+S or toolbar button, writes via File System Access API (fallback: download)
- Load: toolbar button or drag-and-drop
- Auto-save: debounced (500ms) after every change when a file handle is open

## Alignment Guides

When dragging a node, thin guide lines appear for alignment:

- Horizontal guides: top, center, or bottom alignment with other nodes
- Vertical guides: left, center, or right alignment with other nodes
- Snap threshold: ~5px
- Visual: thin dashed lines in light blue, extending across the canvas
- Implemented via `onNodeDrag` callback with SVG overlay

## State Management

- Zustand for global app state: current canvas ID, file handle, canvas data, undo/redo history
- React Flow's internal state for positions, viewport, selection
- `onNodesChange`/`onEdgesChange` callbacks sync React Flow state to Zustand, triggering auto-save

## Interactions Summary

### Canvas
- Pan: click+drag empty space
- Zoom: scroll wheel
- Select: click node/edge, shift+click for multi-select
- Delete: select + Backspace/Delete
- Undo/Redo: Ctrl+Z / Ctrl+Shift+Z

### Nodes
- Create: toolbar button, appears at viewport center
- Move: drag
- Auto-size to content (no manual resize)
- All text editable via double-click
- `+` buttons to add properties/methods
- `x` on hover to remove properties/methods
- Comment icon, right-click for color/delete

### Edges
- Create: drag handle to handle, select type from popup
- Label editable via double-click
- Right-click for type/color/comment/delete

### Files
- Save: Ctrl+S or toolbar
- Load: toolbar or drag-and-drop
- Auto-save: debounced after every change

## Project Structure

```
src/
  components/
    ClassNode.tsx        -- Custom UML class node
    EdgeTypes.tsx        -- Custom edge renderers (6 types)
    Toolbar.tsx          -- Top toolbar
    CanvasSelector.tsx   -- Canvas dropdown
    CommentPopover.tsx   -- Reusable comment editor
  store/
    useCanvasStore.ts    -- Zustand store
  types/
    schema.ts            -- TypeScript types for the file format
  utils/
    fileIO.ts            -- Save/load logic
  App.tsx
  main.tsx
```

## Tech Stack

- Vite + React + TypeScript
- @xyflow/react for the canvas
- Zustand for state management
- Clean visual style consistent with @xyflow/react aesthetics
