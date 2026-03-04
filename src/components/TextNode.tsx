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
