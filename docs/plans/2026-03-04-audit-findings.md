# Schemata Audit Findings — 2026-03-04

## Bugs / Correctness Issues

### 1. Delete key doesn't work (Windows)

**File:** `src/App.tsx:551`

`deleteKeyCode="Backspace"` only handles macOS. Windows users expect the Delete key to remove selected nodes/edges.

**Fix:** Change to `deleteKeyCode={['Backspace', 'Delete']}`.

---

### 2. Sidebar node-click from a different file doesn't select the node

**Files:** `src/components/Sidebar.tsx:293-298`, `src/components/Sidebar.tsx:131-133`

When clicking a node listed under a non-active file, the caller does `setActiveFile(fp)` then `handleNodeClick()`. Zustand state updates synchronously, but React hasn't re-rendered the new file's nodes into ReactFlow yet. The `setNodes` selection update inside `handleNodeClick` operates on the old file's stale nodes, so the clicked node doesn't get selected.

**Fix:** Use `setTimeout(pan, 50)` unconditionally when switching files (or move the `setActiveFile` call inside `handleNodeClick` and always use the timeout path when file differs).

---

## UX Issues

### 3. Duplicate context menu logic (sidebar vs canvas)

**Files:** `src/components/Sidebar.tsx:518-580`, `src/components/ContextMenu.tsx:131-147`

Color picker, stereotype options, and delete are implemented separately in both the sidebar context menu and the canvas context menu. A bug fix or feature addition in one won't automatically apply to the other.

**Fix:** Extract shared menu items (color row, stereotype submenu, delete) into a reusable component or hook.

---

### 4. No "Save All" for multi-file workflows

**File:** `src/store/useCanvasStore.ts`

Only `saveActiveFile()` exists. Users with unsaved changes across multiple files must click each file and press Ctrl+S individually.

**Fix:** Add a `saveAllFiles()` action that iterates `_dirtyFiles` and writes each to its handle. Bind to Ctrl+Shift+S.

---

### 5. Silent discard on malformed property/method edits

**File:** `src/components/ClassNode.tsx:131-139` (property), `src/components/ClassNode.tsx:195-210` (method)

If the user edits a property or method and the result doesn't match the expected format (`+/−/# name: type` for properties, `+/−/# name(params): returnType` for methods), the edit is silently discarded and the text reverts. There's no visual feedback that the format was wrong.

**Fix:** Show a brief validation hint (e.g. red border or tooltip) when the regex doesn't match, or accept partial edits more leniently.

---

### 6. No keyboard shortcuts for node creation

**File:** `src/App.tsx`

Double-click on canvas creates a node, but there's no keyboard shortcut. Power users navigating via keyboard can't create nodes without the mouse.

**Fix:** Add shortcuts like `N` (new class node at viewport center) and `Shift+N` (new annotation). Guard behind `!isEditing` check.

---

## Performance

### 7. Sidebar tree functions recreated every render

**File:** `src/components/Sidebar.tsx:184-320`

`renderTreeNodes`, `renderFolder`, and `renderFileNode` are plain functions defined inside the component body. They close over state and are recreated on every render, causing the entire tree to re-render on any state change. For large folder trees this could become sluggish.

**Fix:** Extract folder/file/node rows into separate `memo`'d components that receive props instead of closing over parent state.

---

## Missing Test Coverage

### 8. Store actions (~15% covered)

**File:** `src/store/undoMiddleware.test.ts`

Only undo/redo is tested (8 tests). The following actions have zero test coverage:

**Edge operations:**
- `addEdge` — creates edge with correct type and handles
- `removeEdge` — cascades to annotation nodes attached to the edge
- `removeEdges` — batch removal with annotation cascade
- `updateEdgeData` — partial data merge
- `updateEdgeType` — relationship type change

**Node operations:**
- `addAnnotation` — creates annotation node + edge to parent
- `groupSelectedNodes` — creates group node with correct bounds
- `removeNode` — cascades to child annotations and connected edges
- `removeNodes` — batch removal with cascade
- `renameFile` — updates file name in active file

**State guards:**
- `setCanvasNodes` — reference equality guard (no-op when `file.nodes === nodes`)
- `setCanvasEdges` — reference equality guard
- `saveViewport` — skip-update optimization when viewport unchanged

### 9. Store utilities (0% covered)

**File:** `src/store/useCanvasStore.ts`

- `migrateFile` — property/method ID migration (partially tested via fileIO deserialization, but the actual migration path with missing IDs is not tested)
- `deduplicateNodes` — removes duplicate node IDs, keeps last occurrence
- `syncIdCounters` — scans all files and sets ID counters above highest existing IDs

### 10. Existing test coverage (good)

For reference, these modules have solid coverage:
- `src/utils/fileIO.test.ts` — 17 tests (serialize, deserialize, validate, migration)
- `src/utils/folderTree.test.ts` — 5 tests (empty, flat, nested, sorting, fileName)
- `src/utils/alignment.test.ts` — 10 tests (snap, guides, edge alignment, dedup)
- `src/types/schema.test.ts` — 4 tests (type construction, optional fields)
- `src/utils/debounce.test.ts` — 2 tests (delay, dedup)
