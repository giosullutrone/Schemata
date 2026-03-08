# Text Node Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace annotation nodes with general-purpose text nodes supporting markdown, configurable border styles, text alignment, and no cascade deletion.

**Architecture:** Rename `annotationNode` to `textNode` across schema, store, and components. Replace the annotation component with a new TextNode that renders markdown via `react-markdown` + `remark-gfm`. Add `BorderStyleRow` and `TextAlignRow` shared components to context menus. Swap double-click/N shortcuts so text nodes are the default creation action. Remove cascade deletion and `parentId`/`parentType` tracking.

**Tech Stack:** React 19, TypeScript, Zustand 5, @xyflow/react v12, react-markdown, remark-gfm, Vitest

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install react-markdown and remark-gfm**

Run:
```bash
npm install react-markdown remark-gfm
```

**Step 2: Verify installation**

Run: `npm ls react-markdown remark-gfm`
Expected: Both packages listed without errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-markdown and remark-gfm dependencies"
```

---

### Task 2: Update Schema Types

**Files:**
- Modify: `src/types/schema.ts`
- Modify: `src/types/schema.test.ts`

**Step 1: Update the schema test**

In `src/types/schema.test.ts`, find any tests that reference `annotationNode`, `AnnotationNodeData`, or `comment` field and update them. The `validateFile` function in `src/utils/fileIO.ts` checks node types — add `textNode` as a valid type.

Update the test file: change all `'annotationNode'` references to `'textNode'`, and `comment:` fields to `text:` fields. If tests create annotation nodes, update them:

```typescript
// Before:
{ id: 'a1', type: 'annotationNode', position: { x: 0, y: 0 }, data: { comment: 'test', parentId: 'c1', parentType: 'node' } }
// After:
{ id: 'a1', type: 'textNode', position: { x: 0, y: 0 }, data: { text: 'test' } }
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/types/schema.test.ts`
Expected: FAIL (schema types don't match)

**Step 3: Update schema types**

In `src/types/schema.ts`, replace:

Lines 49-55 — replace `AnnotationNodeData`:
```typescript
export interface TextNodeData {
  [key: string]: unknown;
  text: string;
  color?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  opacity?: number;
}
```

Lines 57-62 — replace `AnnotationNodeSchema`:
```typescript
export interface TextNodeSchema {
  id: string;
  type: 'textNode';
  position: { x: number; y: number };
  data: TextNodeData;
}
```

Line 78 — update union type:
```typescript
export type CanvasNodeSchema = ClassNodeSchema | TextNodeSchema | GroupNodeSchema;
```

Also update any exports: replace `AnnotationNodeData` with `TextNodeData`, `AnnotationNodeSchema` with `TextNodeSchema`.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/types/schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/schema.ts src/types/schema.test.ts
git commit -m "feat: rename AnnotationNodeData to TextNodeData, update schema"
```

---

### Task 3: Update Store — Rename Action & Remove Cascade

**Files:**
- Modify: `src/store/useCanvasStore.ts`
- Modify: `src/store/storeActions.test.ts`
- Modify: `src/store/undoMiddleware.test.ts`

**Step 1: Update store action tests**

In `src/store/storeActions.test.ts`:

1. Find the `addAnnotation` describe block (around lines 158-186). Rename it to `addTextNode` and update:
```typescript
describe('addTextNode', () => {
  beforeEach(() => {
    setup({
      nodes: [
        { id: 'class-1', type: 'classNode', position: { x: 100, y: 100 }, data: { name: 'A', properties: [], methods: [] } },
      ],
    });
  });

  it('should create standalone text node without edge', () => {
    useCanvasStore.getState().addTextNode(320, 100);
    const file = getFile();
    expect(file.nodes).toHaveLength(2);
    const textNode = file.nodes.find((n) => n.type === 'textNode');
    expect(textNode).toBeDefined();
    expect(textNode!.data.text).toBe('');
    expect(file.edges).toHaveLength(0);
  });

  it('should create comment text node with edge when parentId provided', () => {
    useCanvasStore.getState().addTextNode(320, 100, {
      parentId: 'class-1',
      parentType: 'node',
      color: '#F39C12',
      borderStyle: 'dashed',
      opacity: 0.85,
    });
    const file = getFile();
    expect(file.nodes).toHaveLength(2);
    const textNode = file.nodes.find((n) => n.type === 'textNode');
    expect(textNode).toBeDefined();
    expect(textNode!.data.color).toBe('#F39C12');
    expect(textNode!.data.borderStyle).toBe('dashed');
    expect(file.edges).toHaveLength(1);
    expect(file.edges[0].source).toBe(textNode!.id);
    expect(file.edges[0].target).toBe('class-1');
  });

  it('should use left handle when text node is to the left of parent', () => {
    useCanvasStore.getState().addTextNode(0, 100, { parentId: 'class-1', parentType: 'node' });
    const edge = getFile().edges[0];
    expect(edge.sourceHandle).toBe('right');
    expect(edge.targetHandle).toBe('left');
  });
});
```

2. Find the `removeEdge` cascade test (around line 84-88). The test that checks annotation cascade should now verify text nodes are NOT cascade-deleted:
```typescript
it('should NOT cascade delete text nodes when removing edge', () => {
  // Setup: add a text node that was created as a comment
  useCanvasStore.getState().addTextNode(320, 100, { parentId: 'class-1', parentType: 'node' });
  const textNode = getFile().nodes.find((n) => n.type === 'textNode');
  expect(textNode).toBeDefined();
  // Remove the edge connecting text node to class
  const edgeToRemove = getFile().edges.find((e) => e.source === textNode!.id);
  expect(edgeToRemove).toBeDefined();
  useCanvasStore.getState().removeEdge(edgeToRemove!.id);
  // Text node should still exist
  expect(getFile().nodes.find((n) => n.id === textNode!.id)).toBeDefined();
});
```

3. Find the `removeNode` cascade test (around line 231-236). Update to verify no cascade:
```typescript
it('should NOT cascade delete text nodes when removing parent node', () => {
  useCanvasStore.getState().addTextNode(320, 100, { parentId: 'class-1', parentType: 'node' });
  const textNodeId = getFile().nodes.find((n) => n.type === 'textNode')!.id;
  useCanvasStore.getState().removeNode('class-1');
  // Text node should survive, only its connecting edge is removed
  expect(getFile().nodes.find((n) => n.id === textNodeId)).toBeDefined();
  expect(getFile().edges).toHaveLength(0);
});
```

4. Update ALL other test references: `'annotationNode'` → `'textNode'`, `data.comment` → `data.text`, `data.parentId` → removed, `addAnnotation(...)` → `addTextNode(...)`.

In `src/store/undoMiddleware.test.ts`, update if any references to `addAnnotation` exist. The undo tests likely use `addClassNode` only, but check.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store/storeActions.test.ts`
Expected: FAIL (store methods don't exist yet)

**Step 3: Update the store**

In `src/store/useCanvasStore.ts`:

1. **Rename ID generator** (line 31-33): Change `generateAnnotationId` and `nextAnnotationId` to `generateTextNodeId` and `nextTextNodeId`. Change the prefix from `annotation-` to `text-`:
```typescript
let nextTextNodeId = 1;
function generateTextNodeId(): string {
  return `text-${nextTextNodeId++}`;
}
```

2. **Update interface** (line 207): Replace `addAnnotation` signature:
```typescript
addTextNode: (x: number, y: number, options?: {
  parentId?: string;
  parentType?: 'node' | 'edge';
  color?: string;
  borderStyle?: string;
  opacity?: number;
  text?: string;
}) => void;
```

3. **Replace `addAnnotation` implementation** (lines 527-572) with `addTextNode`:
```typescript
addTextNode: (x, y, options) => {
  pushUndo(get, set);
  updateActiveFile(get, set, (file) => {
    const nodeId = generateTextNodeId();
    const {
      parentId,
      parentType,
      color,
      borderStyle,
      opacity,
      text = '',
    } = options ?? {};

    const newNode = {
      id: nodeId,
      type: 'textNode' as const,
      position: { x, y },
      data: {
        text,
        ...(color != null && { color }),
        ...(borderStyle != null && { borderStyle }),
        ...(opacity != null && { opacity }),
      },
    };

    let newEdges = file.edges;
    if (parentId) {
      let targetNodeId = parentId;
      if (parentType === 'edge') {
        const parentEdge = file.edges.find((e) => e.id === parentId);
        if (parentEdge) targetNodeId = parentEdge.source;
      }

      const targetNode = file.nodes.find((n) => n.id === targetNodeId);
      const isLeft = targetNode ? x < targetNode.position.x : false;
      const sourceHandle = isLeft ? 'right' : 'left';
      const targetHandle = isLeft ? 'left' : 'right';

      if (targetNodeId) {
        newEdges = [
          ...file.edges,
          {
            id: generateEdgeId(),
            source: nodeId,
            target: targetNodeId,
            sourceHandle,
            targetHandle,
            type: 'uml' as const,
            data: { relationshipType: 'association' as const },
          },
        ];
      }
    }

    return { ...file, nodes: [...file.nodes, newNode], edges: newEdges };
  });
},
```

4. **Remove cascade logic from `removeNode`** (lines 598-613). Replace with simple removal:
```typescript
removeNode: (nodeId) => {
  pushUndo(get, set);
  updateActiveFile(get, set, (file) => ({
    ...file,
    nodes: file.nodes.filter((n) => n.id !== nodeId),
    edges: file.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
  }));
},
```

5. **Remove cascade logic from `removeEdge`** (lines 681-695). Replace with simple removal:
```typescript
removeEdge: (edgeId) => {
  pushUndo(get, set);
  updateActiveFile(get, set, (file) => ({
    ...file,
    edges: file.edges.filter((e) => e.id !== edgeId),
  }));
},
```

6. **Update `reset` function**: If the reset function resets `nextAnnotationId`, rename to `nextTextNodeId`:
```typescript
nextTextNodeId = 1;
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/store/`
Expected: PASS

**Step 5: Commit**

```bash
git add src/store/useCanvasStore.ts src/store/storeActions.test.ts src/store/undoMiddleware.test.ts
git commit -m "feat: rename addAnnotation to addTextNode, remove cascade deletion"
```

---

### Task 4: Add Migration Logic

**Files:**
- Modify: `src/utils/fileIO.ts`
- Modify: `src/utils/fileIO.test.ts`

**Step 1: Write migration test**

Add to `src/utils/fileIO.test.ts`:
```typescript
it('should migrate annotationNode to textNode', () => {
  const file: SchemataFile = {
    version: '1.0',
    name: 'Test',
    nodes: [
      {
        id: 'a1',
        type: 'annotationNode' as unknown as 'textNode',
        position: { x: 0, y: 0 },
        data: { comment: 'Hello', parentId: 'c1', parentType: 'node', color: '#F39C12' } as unknown as TextNodeData,
      },
    ],
    edges: [],
  };
  const migrated = migrateFile(file);
  const node = migrated.nodes[0];
  expect(node.type).toBe('textNode');
  expect((node.data as TextNodeData).text).toBe('Hello');
  expect((node.data as TextNodeData).borderStyle).toBe('dashed');
  expect((node.data as TextNodeData).opacity).toBe(0.85);
  expect((node.data as Record<string, unknown>).comment).toBeUndefined();
  expect((node.data as Record<string, unknown>).parentId).toBeUndefined();
  expect((node.data as Record<string, unknown>).parentType).toBeUndefined();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/fileIO.test.ts`
Expected: FAIL

**Step 3: Add migration logic to `migrateFile`**

In `src/utils/fileIO.ts`, inside the `migrateFile` function, add annotation-to-text migration. Find the existing migration loop over nodes and add:

```typescript
// Migrate annotationNode → textNode
if ((node.type as string) === 'annotationNode') {
  changed = true;
  const oldData = node.data as Record<string, unknown>;
  node.type = 'textNode' as CanvasNodeSchema['type'];
  node.data = {
    text: (oldData.comment as string) ?? '',
    ...(oldData.color != null && { color: oldData.color }),
    borderStyle: 'dashed',
    opacity: 0.85,
  } as unknown as typeof node.data;
}
```

Also update `validateFile` (around line 47) to accept `'textNode'` as a valid node type instead of (or in addition to) `'annotationNode'`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/fileIO.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/fileIO.ts src/utils/fileIO.test.ts
git commit -m "feat: add annotationNode to textNode migration"
```

---

### Task 5: Create TextNode Component

**Files:**
- Create: `src/components/TextNode.tsx`
- Create: `src/components/TextNode.css`
- Delete: `src/components/AnnotationNode.tsx`
- Delete: `src/components/AnnotationNode.css`

**Step 1: Create `src/components/TextNode.css`**

```css
.text-node {
  padding: 8px 10px;
  border-radius: 4px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  min-width: 120px;
  min-height: 40px;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--node-bg);
  border: 2px solid var(--border-primary);
  box-shadow: 0 1px 4px var(--shadow);
}

.text-node.selected {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 1px var(--text-primary);
}

.text-node-content {
  flex: 1;
  overflow-y: auto;
  cursor: text;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
}

.text-node-textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  color: var(--text-primary);
  width: 100%;
  min-height: 60px;
}

/* Markdown styles */
.text-node-markdown {
  line-height: 1.5;
}

.text-node-markdown h1 { font-size: 1.6em; font-weight: 700; margin: 0.3em 0; }
.text-node-markdown h2 { font-size: 1.3em; font-weight: 700; margin: 0.3em 0; }
.text-node-markdown h3 { font-size: 1.1em; font-weight: 700; margin: 0.2em 0; }
.text-node-markdown h4 { font-size: 1em; font-weight: 700; margin: 0.2em 0; }
.text-node-markdown h5 { font-size: 0.9em; font-weight: 700; margin: 0.2em 0; }
.text-node-markdown h6 { font-size: 0.85em; font-weight: 700; margin: 0.2em 0; }

.text-node-markdown p { margin: 0.3em 0; }
.text-node-markdown ul, .text-node-markdown ol { margin: 0.3em 0; padding-left: 1.5em; }
.text-node-markdown li { margin: 0.1em 0; }

.text-node-markdown code {
  background: var(--bg-input);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.9em;
}

.text-node-markdown pre {
  background: var(--bg-input);
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0.3em 0;
}

.text-node-markdown pre code {
  background: none;
  padding: 0;
}

.text-node-markdown blockquote {
  border-left: 3px solid var(--border-primary);
  margin: 0.3em 0;
  padding: 0.2em 0.8em;
  color: var(--text-muted);
}

.text-node-markdown table {
  border-collapse: collapse;
  margin: 0.3em 0;
  width: 100%;
}

.text-node-markdown th, .text-node-markdown td {
  border: 1px solid var(--border-secondary);
  padding: 4px 8px;
  text-align: left;
}

.text-node-markdown th {
  background: var(--bg-input);
  font-weight: 600;
}

.text-node-markdown a {
  color: #4A90D9;
  text-decoration: underline;
}

.text-node-markdown img {
  max-width: 100%;
  border-radius: 4px;
}

.text-node-markdown hr {
  border: none;
  border-top: 1px solid var(--border-secondary);
  margin: 0.5em 0;
}

.text-node-sub-handle {
  width: 6px !important;
  height: 6px !important;
  min-width: 6px !important;
  min-height: 6px !important;
  background: var(--text-muted) !important;
  border: 1px solid var(--border-secondary) !important;
  opacity: 0;
  transition: opacity 0.15s;
}

.text-node:hover .text-node-sub-handle {
  opacity: 1;
}
```

**Step 2: Create `src/components/TextNode.tsx`**

```tsx
import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCanvasStore } from '../store/useCanvasStore';
import type { TextNodeData } from '../types/schema';
import './TextNode.css';

function TextNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as TextNodeData;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
    }
  }, [editing]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed !== d.text) {
      updateNodeData(id, { text: trimmed });
    }
    setEditing(false);
  }, [draft, d.text, id, updateNodeData]);

  const color = d.color;
  const borderStyle = d.borderStyle ?? 'solid';
  const opacity = d.opacity ?? 1;
  const textAlign = d.textAlign ?? 'left';

  const nodeStyle: React.CSSProperties = {
    borderStyle,
    opacity,
    ...(color ? { borderColor: color, backgroundColor: `${color}18` } : {}),
  };

  return (
    <div className={`text-node${selected ? ' selected' : ''}`} style={nodeStyle}>
      <NodeResizer isVisible={!!selected} minWidth={120} minHeight={40} />
      <Handle type="source" position={Position.Top} id="top" className="text-node-sub-handle" />
      <Handle type="source" position={Position.Right} id="right" className="text-node-sub-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="text-node-sub-handle" />
      <Handle type="source" position={Position.Left} id="left" className="text-node-sub-handle" />
      {editing ? (
        <textarea
          ref={textareaRef}
          className="text-node-textarea nodrag nowheel"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(d.text);
              setEditing(false);
            }
          }}
        />
      ) : (
        <div
          className="text-node-content"
          style={{ textAlign }}
          onDoubleClick={() => {
            setDraft(d.text);
            setEditing(true);
          }}
        >
          {d.text ? (
            <ReactMarkdown className="text-node-markdown" remarkPlugins={[remarkGfm]}>
              {d.text}
            </ReactMarkdown>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Double-click to edit...</span>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(TextNodeComponent);
```

**Step 3: Delete old annotation files**

```bash
rm src/components/AnnotationNode.tsx src/components/AnnotationNode.css
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: May have errors in files that still import AnnotationNode — that's fine, we'll fix in the next task.

**Step 5: Commit**

```bash
git add src/components/TextNode.tsx src/components/TextNode.css
git rm src/components/AnnotationNode.tsx src/components/AnnotationNode.css
git commit -m "feat: create TextNode component with markdown rendering"
```

---

### Task 6: Update App.tsx — Node Types & Interaction Swap

**Files:**
- Modify: `src/App.tsx`

**Step 1: Update imports and nodeTypes**

Replace the AnnotationNode import (around line 6) with TextNode:
```typescript
import TextNode from './components/TextNode';
```

Update `nodeTypes` (line 36):
```typescript
const nodeTypes = { classNode: ClassNode, textNode: TextNode, groupNode: GroupNode };
```

**Step 2: Swap double-click behavior**

In `handlePaneDoubleClick` (lines 414-427), swap the logic — plain double-click creates text node, shift creates class node:
```typescript
const handlePaneDoubleClick = useCallback(
  (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    if (event.shiftKey) {
      addClassNode(position.x, position.y);
    } else {
      addTextNode(position.x, position.y);
    }
  },
  [screenToFlowPosition, addClassNode, addTextNode]
);
```

**Step 3: Swap N key shortcut**

In the N key handler (lines 168-187), swap — N creates text node, Shift+N creates class node:
```typescript
if (e.shiftKey) {
  addClassNode(center.x, center.y);
} else {
  addTextNode(center.x, center.y);
}
```

Update the hook reference from `addAnnotation` to `addTextNode`:
```typescript
const addTextNode = useCanvasStore((s) => s.addTextNode);
```

Update the `useEffect` deps array to include `addTextNode` instead of `addAnnotation`.

**Step 4: Update all other `addAnnotation` references**

Search for all `addAnnotation` usage in App.tsx and replace with `addTextNode`. Remove the old `addAnnotation` hook if present.

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: May still have errors in ContextMenu/Sidebar (next tasks)

**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: swap double-click/N shortcuts, register textNode type"
```

---

### Task 7: Update ContextMenu — Add Comment & New Rows

**Files:**
- Modify: `src/components/ContextMenu.tsx`
- Modify: `src/components/contextMenuItems.tsx`
- Modify: `src/components/ContextMenu.css`

**Step 1: Add BorderStyleRow and TextAlignRow to contextMenuItems.tsx**

Append to `src/components/contextMenuItems.tsx`:

```tsx
const BORDER_STYLES: { value: string; label: string; preview: React.CSSProperties }[] = [
  { value: 'solid', label: 'Solid', preview: { borderBottom: '3px solid currentColor' } },
  { value: 'dashed', label: 'Dashed', preview: { borderBottom: '3px dashed currentColor' } },
  { value: 'dotted', label: 'Dotted', preview: { borderBottom: '3px dotted currentColor' } },
  { value: 'double', label: 'Double', preview: { borderBottom: '4px double currentColor' } },
  { value: 'none', label: 'None', preview: { borderBottom: '3px solid transparent' } },
];

export function BorderStyleRow({ onSelect, current }: { onSelect: (style: string) => void; current?: string }) {
  return (
    <div className="context-menu-icon-row">
      {BORDER_STYLES.map((bs) => (
        <div
          key={bs.value}
          className={`context-menu-icon-swatch${current === bs.value ? ' active' : ''}`}
          title={bs.label}
          onClick={() => onSelect(bs.value)}
        >
          <div style={{ width: '100%', ...bs.preview }} />
        </div>
      ))}
    </div>
  );
}

const TEXT_ALIGNS: { value: string; label: string; icon: string }[] = [
  { value: 'left', label: 'Left', icon: '\u2261' },
  { value: 'center', label: 'Center', icon: '\u2261' },
  { value: 'right', label: 'Right', icon: '\u2261' },
  { value: 'justify', label: 'Justify', icon: '\u2261' },
];

export function TextAlignRow({ onSelect, current }: { onSelect: (align: string) => void; current?: string }) {
  return (
    <div className="context-menu-icon-row">
      {TEXT_ALIGNS.map((ta) => (
        <div
          key={ta.value}
          className={`context-menu-icon-swatch${current === ta.value ? ' active' : ''}`}
          title={ta.label}
          onClick={() => onSelect(ta.value)}
          style={{ textAlign: ta.value as React.CSSProperties['textAlign'] }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            {ta.value === 'left' && (
              <>
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="1" y="7" width="10" height="2" rx="0.5" />
                <rect x="1" y="12" width="12" height="2" rx="0.5" />
              </>
            )}
            {ta.value === 'center' && (
              <>
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="3" y="7" width="10" height="2" rx="0.5" />
                <rect x="2" y="12" width="12" height="2" rx="0.5" />
              </>
            )}
            {ta.value === 'right' && (
              <>
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="5" y="7" width="10" height="2" rx="0.5" />
                <rect x="3" y="12" width="12" height="2" rx="0.5" />
              </>
            )}
            {ta.value === 'justify' && (
              <>
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="1" y="7" width="14" height="2" rx="0.5" />
                <rect x="1" y="12" width="14" height="2" rx="0.5" />
              </>
            )}
          </svg>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Add CSS for icon rows**

Add to `src/components/ContextMenu.css`:

```css
.context-menu-icon-row {
  display: flex;
  gap: 4px;
  padding: 6px 16px;
}

.context-menu-icon-swatch {
  width: 28px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid var(--border-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.context-menu-icon-swatch:hover {
  border-color: var(--text-primary);
  color: var(--text-primary);
}

.context-menu-icon-swatch.active {
  border-color: var(--text-primary);
  background: var(--bg-input);
  color: var(--text-primary);
}
```

**Step 3: Update ContextMenu.tsx**

1. Replace `addAnnotation` import with `addTextNode`:
```typescript
const addTextNode = useCanvasStore((s) => s.addTextNode);
```

2. Import new components:
```typescript
import { ColorRow, StereotypeMenuItems, BorderStyleRow, TextAlignRow } from './contextMenuItems';
```

3. Update `handleAddComment` to use `addTextNode` with comment defaults:
```typescript
const handleAddComment = useCallback(() => {
  const flowPos = screenToFlowPosition({ x: x + 220, y });
  addTextNode(flowPos.x, flowPos.y, {
    parentId: targetId,
    parentType: type === 'edge' ? 'edge' : 'node',
    color: '#F39C12',
    borderStyle: 'dashed',
    opacity: 0.85,
    text: 'Comment',
  });
  onClose();
}, [targetId, type, x, y, screenToFlowPosition, addTextNode, onClose]);
```

4. Add handlers for border style and text align:
```typescript
const handleBorderStyle = useCallback((style: string) => {
  updateNodeData(targetId, { borderStyle: style });
  onClose();
}, [targetId, updateNodeData, onClose]);

const handleTextAlign = useCallback((align: string) => {
  updateNodeData(targetId, { textAlign: align });
  onClose();
}, [targetId, updateNodeData, onClose]);
```

5. Add text node context menu items. In the render, after the classNode stereotype section, add a textNode section:
```tsx
{type === 'node' && nodeType === 'textNode' && (
  <>
    <BorderStyleRow
      onSelect={handleBorderStyle}
      current={/* pass from props or read from store */}
    />
    <TextAlignRow
      onSelect={handleTextAlign}
      current={/* pass from props or read from store */}
    />
    <div className="context-menu-separator" />
  </>
)}
```

Note: The ContextMenu component receives `targetId` but may not have direct access to node data. You'll need to read it from the store. Add:
```typescript
const targetNodeData = useCanvasStore((s) => {
  const fp = s.activeFilePath;
  if (!fp || type !== 'node') return null;
  const node = s.files[fp]?.nodes.find((n) => n.id === targetId);
  return node?.data as Record<string, unknown> | null;
});
```

Then pass `current` props:
```tsx
<BorderStyleRow
  onSelect={handleBorderStyle}
  current={(targetNodeData?.borderStyle as string) ?? 'solid'}
/>
<TextAlignRow
  onSelect={handleTextAlign}
  current={(targetNodeData?.textAlign as string) ?? 'left'}
/>
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Should compile (Sidebar not yet updated may cause issues)

**Step 5: Commit**

```bash
git add src/components/ContextMenu.tsx src/components/contextMenuItems.tsx src/components/ContextMenu.css
git commit -m "feat: add border style and text align rows to context menu"
```

---

### Task 8: Update Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Step 1: Update getNodeDisplayName**

Change the annotation line (line 10):
```typescript
if (node.type === 'textNode') return (node.data.text as string)?.split('\n')[0] || 'Text';
```

**Step 2: Update getNodeBadge**

Change the annotation line (line 17):
```typescript
if (node.type === 'textNode') return { label: 'T', className: 'text' };
```

**Step 3: Update "Add comment" handler**

Find the "Add comment" click handler in the sidebar context menu (around lines 561-579). Replace `addAnnotation` with `addTextNode`:
```typescript
addTextNode(nodeData.position.x + 220, nodeData.position.y, {
  parentId: nodeId,
  parentType: 'node',
  color: '#F39C12',
  borderStyle: 'dashed',
  opacity: 0.85,
  text: 'Comment',
});
```

Update the store hook: replace `addAnnotation` with `addTextNode`:
```typescript
const addTextNode = useCanvasStore((s) => s.addTextNode);
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: update sidebar for textNode badge, display name, and add comment"
```

---

### Task 9: Run All Tests & Build

**Files:** (none — verification only)

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Fix any failing tests**

If tests reference `annotationNode`, `data.comment`, `data.parentId`, or `addAnnotation`, update them to use `textNode`, `data.text`, and `addTextNode`.

**Step 3: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit any test fixes**

```bash
git add -A
git commit -m "fix: update remaining test references for textNode migration"
```

---

### Task 10: Final Verification

**Manual testing checklist:**

1. Open a folder with `.schemata.json` files
2. **Double-click pane** → creates text node (not class node)
3. **Shift+double-click pane** → creates class node
4. **N key** → creates text node at center
5. **Shift+N** → creates class node at center
6. **Double-click text node** → enters edit mode, type `# Hello` then click away → renders as h1
7. **Right-click text node** → shows color swatches, border style row, text align row, "Add comment", Delete
8. **Set border style** to dashed → node border changes
9. **Set text align** to center → text renders centered
10. **Right-click class node → "Add comment"** → creates text node with dashed border, orange color, 0.85 opacity, connected by edge
11. **Delete the class node** → text node stays, edge removed
12. **Markdown features:** `**bold**`, `*italic*`, `` `code` ``, `- list`, `| table |`, `> blockquote`, `[link](url)`
13. **Dark mode** → all text node styles use CSS variables correctly
14. **Open old file with `annotationNode`** → migrates to `textNode` automatically
