import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type Node, type NodeProps } from '@xyflow/react';
import type { AnnotationNodeData } from '../types/schema';
import { useCanvasStore } from '../store/useCanvasStore';
import './AnnotationNode.css';

type AnnotationNodeType = Node<AnnotationNodeData, 'annotationNode'>;

function AnnotationNodeComponent({ id, data, selected }: NodeProps<AnnotationNodeType>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.comment);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== data.comment) {
      updateNodeData(id, { comment: trimmed || 'Comment' });
    }
  }, [draft, data.comment, id, updateNodeData]);

  return (
    <div className={`annotation-node${selected ? ' selected' : ''}`}>
      <NodeResizer
        minWidth={120}
        minHeight={40}
        isVisible={!!selected}
      />
      {/* All handles are source type so dragging FROM annotation always makes it the source */}
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      {editing ? (
        <textarea
          ref={textareaRef}
          className="annotation-node-textarea nodrag nowheel"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(data.comment);
              setEditing(false);
            }
          }}
        />
      ) : (
        <div
          className="annotation-node-text"
          onDoubleClick={() => {
            setDraft(data.comment);
            setEditing(true);
          }}
        >
          {data.comment}
        </div>
      )}
    </div>
  );
}

export default memo(AnnotationNodeComponent);
