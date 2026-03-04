# Annotation to Text Node Redesign

## Goal

Replace the annotation node with a general-purpose text node that supports markdown rendering, configurable border styles, text alignment, and operates as a fully independent node (no cascade deletion, no parent tracking).

## Architecture

The current `annotationNode` becomes `textNode`. It is a generic textual node that renders markdown content. Comments (created via "Add comment" context menu) are just text nodes with specific default styling (dashed border, orange color, reduced opacity) plus an auto-created association edge.

## Data Model

```ts
interface TextNodeData {
  text: string;
  color?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  opacity?: number;
}
```

**Removed:** `parentId`, `parentType` (no longer needed since cascade deletion is removed).

**Migration:** Old `annotationNode` with `comment` field becomes `textNode` with `text` field, `borderStyle: 'dashed'`, `opacity: 0.85`.

## Interaction Changes

| Action | Before | After |
|--------|--------|-------|
| Double-click pane | Create class node | Create text node |
| Shift+double-click pane | Create annotation | Create class node |
| N key | Create class node | Create text node |
| Shift+N | Create annotation | Create class node |
| "Add comment" (context menu) | Create annotation + edge | Create text node (comment defaults) + edge |
| Delete node with annotations | Cascade-delete annotations | No cascade; edge removed, text node stays |

## Text Node Component

- **View mode:** Renders markdown via `react-markdown` + `remark-gfm` (full markdown: headers, bold, italic, code, lists, tables, blockquotes, links, images, code blocks). Respects `textAlign`, `borderStyle`, `opacity`, `color`.
- **Edit mode:** Raw markdown textarea. Double-click to enter, blur/Escape to exit.
- Four directional source handles (unchanged from current annotation).
- NodeResizer (unchanged).

## Defaults

| Property | Standalone text node | Comment (via "Add comment") |
|----------|---------------------|----------------------------|
| color | none | `#F39C12` |
| borderStyle | `solid` | `dashed` |
| opacity | `1.0` | `0.85` |
| textAlign | `left` | `left` |

## Context Menu

For `textNode` right-click:
1. Color swatches (existing `ColorRow`)
2. Border style row (solid, dashed, dotted, double, none) -- icon-based, similar to color swatches
3. Text alignment row (left, center, right, justify) -- icon-based
4. Separator
5. "Add comment"
6. Separator
7. Delete

`BorderStyleRow` and `TextAlignRow` are shared components in `contextMenuItems.tsx`.

## Store Changes

- Rename `addAnnotation` to `addTextNode(x, y, options?)` where options can include `color`, `borderStyle`, `opacity` for comment defaults.
- "Add comment" action creates text node + association edge in one operation (no parent tracking stored).
- Remove cascade deletion logic from `removeNode` and `removeEdge` (annotations with matching `parentId` are no longer auto-deleted).
- ID prefix changes from `annotation-` to `text-`.

## Sidebar

- Badge: `T` with className `text` (was `A` / `annotation`).
- Display name: first line of `data.text` truncated, or `"Text"` if empty.

## Dependencies

- `react-markdown` + `remark-gfm` (full markdown rendering)

## Files Touched

| File | Change |
|------|--------|
| `src/types/schema.ts` | Rename types, update fields |
| `src/components/AnnotationNode.tsx` | Delete, replace with `TextNode.tsx` |
| `src/components/AnnotationNode.css` | Delete, replace with `TextNode.css` |
| `src/components/contextMenuItems.tsx` | Add `BorderStyleRow`, `TextAlignRow` |
| `src/components/ContextMenu.tsx` | Add border/align rows for textNode |
| `src/store/useCanvasStore.ts` | Rename action, remove cascade, update defaults |
| `src/App.tsx` | Swap double-click/N behavior, update nodeTypes |
| `src/components/Sidebar.tsx` | Badge + display name |
| `src/utils/fileIO.ts` | Migration in `migrateFile` |
| Tests | Update all references |
