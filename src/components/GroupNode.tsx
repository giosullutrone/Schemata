import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type Node, type NodeProps } from '@xyflow/react';
import type { GroupNodeData } from '../types/schema';
import { useCanvasStore } from '../store/useCanvasStore';
import './GroupNode.css';

type GroupNodeType = Node<GroupNodeData, 'groupNode'>;

function GroupNodeComponent({ id, data, selected }: NodeProps<GroupNodeType>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Make the React Flow wrapper transparent to pointer events so edges and
  // child node handles inside the group are reachable.  React Flow sets
  // pointerEvents:'all' as an inline style on the wrapper and can re-render
  // the wrapper independently of this memoized component, so we use a
  // MutationObserver to persistently enforce the override.
  useEffect(() => {
    const wrapper = containerRef.current?.parentElement;
    if (!wrapper) return;
    wrapper.style.pointerEvents = 'none';
    const observer = new MutationObserver(() => {
      if (wrapper.style.pointerEvents !== 'none') {
        wrapper.style.pointerEvents = 'none';
      }
    });
    observer.observe(wrapper, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, []);

  // Sync draft from store when not editing (e.g. after undo/redo)
  useEffect(() => {
    if (!editing) {
      setDraft(data.label);
    }
  }, [data.label, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== data.label) {
      updateNodeData(id, { label: trimmed || 'Group' });
    }
  }, [draft, data.label, id, updateNodeData]);

  const color = data.color ?? '#4A90D9';

  return (
    <div
      ref={containerRef}
      className={`group-node${selected ? ' selected' : ''}`}
      style={{
        borderColor: color,
        backgroundColor: `${color}12`,
      }}
    >
      <NodeResizer
        minWidth={100}
        minHeight={60}
        isVisible={!!selected}
        lineStyle={{ borderColor: color }}
      />
      {/* Not selected: border-only hit zone (clip-path) for selection.
          Selected: full-area drag zone for moving the group. */}
      <div className="group-drag-zone" />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      {editing ? (
        <input
          ref={inputRef}
          className="group-node-label-input nodrag nowheel"
          aria-label="Edit group label"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') {
              setDraft(data.label);
              setEditing(false);
            }
          }}
        />
      ) : (
        <div
          className="group-node-label nodrag"
          onDoubleClick={() => {
            setDraft(data.label);
            setEditing(true);
          }}
        >
          {data.label}
        </div>
      )}
    </div>
  );
}

export default memo(GroupNodeComponent);
