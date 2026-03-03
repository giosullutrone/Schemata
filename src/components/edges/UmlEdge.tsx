import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { ClassEdgeData, RelationshipType } from '../../types/schema';
import { useCanvasStore } from '../../store/useCanvasStore';
import './UmlEdge.css';

type ClassEdge = Edge<ClassEdgeData>;

interface UmlEdgeConfig {
  strokeDasharray?: string;
  markerStart?: string;
  markerEnd?: string;
}

const EDGE_CONFIG: Record<RelationshipType, UmlEdgeConfig> = {
  inheritance: { markerEnd: 'url(#uml-inheritance)' },
  implementation: { strokeDasharray: '6 3', markerEnd: 'url(#uml-implementation)' },
  composition: { markerStart: 'url(#uml-composition)' },
  aggregation: { markerStart: 'url(#uml-aggregation)' },
  dependency: { strokeDasharray: '6 3', markerEnd: 'url(#uml-dependency)' },
  association: { markerEnd: 'url(#uml-association)' },
};

export default function UmlEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style,
}: EdgeProps<ClassEdge>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);

  const relationshipType: RelationshipType = data?.relationshipType ?? 'association';

  const config = EDGE_CONFIG[relationshipType] ?? EDGE_CONFIG.association;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color = data?.color ?? '#b1b1b7';
  const label = data?.label ?? '';

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitLabel = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== label) {
      updateEdgeData(id, { label: trimmed || undefined });
    }
  }, [draft, label, id, updateEdgeData]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: config.strokeDasharray,
        }}
        markerStart={config.markerStart}
        markerEnd={config.markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          className="uml-edge-label"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            borderColor: selected ? '#1a192b' : '#e2e2e2',
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setDraft(label);
            setEditing(true);
          }}
        >
          {editing ? (
            <input
              ref={inputRef}
              className="class-node-inline-input nodrag nopan"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel();
                if (e.key === 'Escape') {
                  setDraft(label);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <span>{label || relationshipType}</span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
