import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { NodeResizer, type Node, type NodeProps } from '@xyflow/react';
import type { GroupNodeData } from '../types/schema';
import { useCanvasStore } from '../store/useCanvasStore';
import './GroupNode.css';

type GroupNodeType = Node<GroupNodeData, 'groupNode'>;

function GroupNodeComponent({ id, data, selected }: NodeProps<GroupNodeType>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

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
      {editing ? (
        <input
          ref={inputRef}
          className="group-node-label-input nodrag nowheel"
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
