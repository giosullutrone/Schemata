# File Tree Sidebar Design

## Overview

Replace the top toolbar and canvas selector dropdown with a collapsible left sidebar that provides a tree view of canvases and their nodes, file operations, and drag-and-drop management. A floating settings gear in the top-right handles snap/color mode.

## Layout

```
┌───────────┬──────────────────────────┐
│           │                     ⚙   │
│  Sidebar  │                          │
│  (240px)  │     ReactFlow Canvas     │
│           │                          │
│           │                          │
└───────────┴──────────────────────────┘
```

- Sidebar: 240px wide, left side, collapsible via `Ctrl+B` or hamburger button
- When collapsed: canvas takes full width, small `☰` tab on left edge to reopen
- Floating gear icon: `position: absolute; top: 12px; right: 12px` inside canvas area
- No toolbar component at all

## Sidebar Structure

```
┌─────────────────────┐
│ ☰  Project Name   💾│  header: toggle, editable name, save
├─────────────────────┤
│ + Canvas  📂 Open   │  action row: new canvas, open/load file
├─────────────────────┤
│ ▼ Main              │  canvas (expanded, active)
│   ├ UserService  C  │    C = class, A = annotation, G = group
│   ├ Comment      A  │
│   └ Core         G  │
│ ▶ Diagrams         │  canvas (collapsed)
│ ▶ Notes            │  canvas (collapsed)
└─────────────────────┘
```

## Components

### New Files
- `src/components/Sidebar.tsx` + `Sidebar.css` — sidebar container, header, action row, tree, inline context menus
- `src/components/SettingsPopover.tsx` + `SettingsPopover.css` — floating gear + popover with snap/color toggles

### Deleted Files
- `src/components/Toolbar.tsx` + `Toolbar.css`
- `src/components/CanvasSelector.tsx` + `CanvasSelector.css`

### Modified Files
- `src/App.tsx` — new layout, sidebar inside ReactFlowProvider, settings popover, `Ctrl+B` shortcut
- `src/store/useCanvasStore.ts` — new methods + state fields

## Tree Behavior

### Canvas Rows
- Click: switch to that canvas (save current viewport first)
- Expand/collapse chevron: show/hide child nodes
- Only the active canvas is expandable (shows its nodes)
- Right-click context menu: Rename, Delete (if >1 canvas)
- Draggable: reorder among other canvases

### Node Rows (children of active canvas)
- Click: pan canvas to center the node + select it
- Right-click context menu: Color swatches, Delete, Set stereotype (classNode only)
- Draggable: drag onto a different canvas row to move the node there
- Node type badge: small pill showing C (class), A (annotation), G (group)

### New Canvas Creation
- "+ Canvas" button in action row
- Creates canvas with inline text field for naming (no browser prompt)

## Drag & Drop

### Canvas Reorder
- Native HTML5 drag events (`onDragStart`, `onDragOver`, `onDrop`)
- Visual: 2px `var(--guide-color)` insertion line between canvases
- On drop: rebuild `canvases` Record in new key order

### Node Move Between Canvases
- Drag node row onto a canvas row
- Visual: target canvas row highlights with `var(--bg-active)`
- On drop: remove node from source canvas, add to target at `{x:0, y:0}`
- Edges with both endpoints in the source canvas where one endpoint is the moved node get removed
- Annotation nodes whose `parentId` matches a removed edge/node also get cleaned up

## Store Changes

### New State
- `sidebarOpen: boolean` (default `true`, persisted to localStorage)
- `fileHandle: FileSystemFileHandle | null` (moved from Toolbar local state)

### New Methods
- `moveNodeToCanvas(nodeId, fromCanvasId, toCanvasId)` — transfer node, clean edges, push undo
- `reorderCanvases(orderedIds: string[])` — rebuild Record in order, push undo
- `setSidebarOpen(open: boolean)` — toggle sidebar
- `setFileHandle(handle)` — store file handle for save

### No Schema Changes
`CodeCanvasFile` remains identical. Canvas order is implicit in Record key insertion order.

## Sidebar ↔ ReactFlow Communication

Sidebar is rendered inside `ReactFlowProvider` so it can use `useReactFlow()`:
- `setCenter(x, y)` to pan to a clicked node
- Update node `selected` field via store's `setCanvasNodes` to highlight it

## Settings Popover

- 32x32px circular gear button, top-right of canvas
- Click toggles a small popover card
- Contains: snap mode cycle button + color mode cycle button
- Same toggle logic as current toolbar buttons
- Click-outside to close

## Styling

All via existing CSS variable system:
- Sidebar bg: `var(--bg-secondary)`, right border: `var(--border-secondary)`
- Tree item hover: `var(--bg-hover)`, active: `var(--bg-active)`
- Node badges: `font-size: 10px`, muted color
- Drag indicators: `var(--guide-color)` for lines, `var(--bg-active)` for highlights
- Collapse: CSS transition on `width` with `overflow: hidden`
- Context menus: reuse `.context-menu` styling pattern

## Keyboard Shortcuts
- `Ctrl+B` / `Cmd+B`: toggle sidebar
- `Ctrl+S` / `Cmd+S`: save (moves from Toolbar to App-level, already partly there)
