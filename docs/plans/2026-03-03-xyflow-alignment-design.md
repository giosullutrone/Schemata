# CodeCanvas: xyflow Standard Alignment

## Problem

CodeCanvas uses @xyflow/react but diverges from standard patterns in several ways, causing bugs (missing `onEdgesChange`), performance issues (`useEdges()` in every edge), and missing standard UX components.

## Changes

### 1. Edge Architecture Refactor

**Current:** 6 edge types all mapping to same `UmlEdge` component. Edge component uses `useEdges()` to find its own type — O(n) per edge, re-renders all edges on any change.

**New:** Single `uml` edge type. Relationship stored in `data.relationshipType`. Component reads directly from props.

- `edgeTypes` becomes `{ uml: UmlEdge }`
- `ClassEdgeSchema.type` becomes `'uml'` (ReactFlow routing)
- New field `data.relationshipType: RelationshipType` carries the UML meaning
- Store methods updated: `addEdge` sets `type: 'uml'`, `updateEdgeType` updates `data.relationshipType`
- `UmlEdge` reads `data.relationshipType` from props, removes `useEdges()` import

### 2. App.tsx — ReactFlow Props & Handlers

- Add `onEdgesChange` handler using `applyEdgeChanges` (mirrors `onNodesChange`)
- Add `connectionMode={ConnectionMode.Loose}` — any handle accepts source or target
- Add `snapToGrid={true}`, `snapGrid={[20, 20]}`
- Add `onReconnect` handler using `reconnectEdge()` utility
- Add `defaultEdgeOptions={{ type: 'uml' }}`
- Add `<Background variant="dots" gap={20} />`
- Add `<Controls />`
- Add `<MiniMap />`

### 3. ClassNode.tsx — Handle Fix

- Destructure `isConnectable` from `NodeProps`
- Forward `isConnectable` to all 4 Handle components

### 4. UmlEdge.tsx — Cleanup

- Read `data.relationshipType` from props instead of `useEdges()` lookup
- Forward `style` prop from `EdgeProps`
- Remove `useEdges` import

### 5. Schema & Store

- Add `relationshipType: RelationshipType` to `ClassEdgeData`
- `ClassEdgeSchema.type` becomes literal `'uml'`
- Store `addEdge`: sets `type: 'uml'`, `data: { relationshipType, label }`
- Store `updateEdgeType`: updates `data.relationshipType` instead of edge `type`
- Add `setCanvasEdges` method (mirrors `setCanvasNodes` for `onEdgesChange`)
- Add viewport field to `CanvasData`: `viewport?: { x: number; y: number; zoom: number }`

### 6. Viewport Persistence

- Save viewport via `getViewport()` when switching canvases
- Restore viewport via `setViewport()` when switching to a canvas
- Store viewport in `CanvasData.viewport`

### 7. Dark Mode

- `colorMode` state in App: `'light' | 'dark' | 'system'`
- Pass `colorMode` to ReactFlow (built-in dark mode for canvas, edges, minimap, controls, grid)
- Toggle in Toolbar, preference stored in `localStorage`
- CSS updates for custom components: ClassNode, ContextMenu, EdgeTypePopup, Toolbar, CanvasSelector, UmlEdge label, AlignmentGuides
- Use CSS class `.dark` on root or CSS custom properties

## Not Included

- Floating edges (dynamic edge endpoints) — deferred to separate pass
- `onBeforeDelete` confirmation dialog
