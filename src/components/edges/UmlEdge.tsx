import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { ClassEdgeData, ClassEdgeSchema, RelationshipType } from '../../types/schema';
import { useCanvasStore } from '../../store/useCanvasStore';
import { EDGE_CONFIG } from './edgeConfig';
import './UmlEdge.css';

type ClassEdge = Edge<ClassEdgeData>;

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
  const draftRef = useRef('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const committingRef = useRef(false);
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);

  // Keep refs in sync with data so the ResizeObserver callback avoids stale closures
  const dataWidthRef = useRef(data?.labelWidth);
  const dataHeightRef = useRef(data?.labelHeight);
  dataWidthRef.current = data?.labelWidth;
  dataHeightRef.current = data?.labelHeight;

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

  // Auto-enter editing when label transitions to '' (triggered by onEdgeDoubleClick).
  // Intentionally excludes `editing` from deps: we only want this to fire when
  // data.label CHANGES to '', not when editing changes independently. Including
  // `editing` causes a race condition — after commitLabel() calls setEditing(false)
  // and updateEdgeData(), the local state change (editing=false) can arrive in a
  // render before the Zustand prop change (data.label='uses'), creating an
  // intermediate render where data.label is still '' and editing is false, which
  // re-triggers this effect and wipes the draft.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (data?.label === '' && !editing) {
      setDraft('');
      draftRef.current = '';
      setEditing(true);
    }
  }, [data?.label]);

  useEffect(() => {
    if (editing) {
      committingRef.current = false;
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Persist CSS-resize dimensions so they survive edge remounts (e.g., reconnection).
  // Uses setCanvasEdges (no undo push) to avoid flooding the undo stack on every resize frame.
  const setCanvasEdges = useCanvasStore((s) => s.setCanvasEdges);
  useEffect(() => {
    const el = labelRef.current;
    if (!el || editing) return;

    const observer = new ResizeObserver(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w !== dataWidthRef.current || h !== dataHeightRef.current) {
        const store = useCanvasStore.getState();
        const af = store.activeFilePath;
        if (!af) return;
        const edges = store.files[af]?.edges;
        if (!edges) return;
        const updated = edges.map((e) =>
          e.id === id ? { ...e, data: { ...e.data, labelWidth: w, labelHeight: h } } : e
        ) as ClassEdgeSchema[];
        setCanvasEdges(updated);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [editing, id, setCanvasEdges]);

  const commitLabel = useCallback(
    (cancelled?: boolean) => {
      if (committingRef.current) return;
      committingRef.current = true;
      setEditing(false);
      if (cancelled) {
        // Clean up empty label marker from double-click creation
        if (data?.label === '') {
          updateEdgeData(id, { label: undefined });
        }
        return;
      }
      // Read from ref to avoid stale closure over draft state
      const trimmed = draftRef.current.trim();
      // Clear stored dimensions so the container auto-sizes to new text
      updateEdgeData(id, { label: trimmed || undefined, labelWidth: undefined, labelHeight: undefined });
    },
    [id, data?.label, updateEdgeData]
  );

  const markerId = `uml-${relationshipType}-${id}`;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 20 20"
          markerWidth={config.markerWidth}
          markerHeight={config.markerHeight}
          refX={config.markerRefX}
          refY={10}
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
          overflow="visible"
        >
          <path d={config.markerPath} fill={config.markerFilled === false ? 'white' : color} stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: config.strokeDasharray,
          opacity: 1,
        }}
        markerStart={config.markerPosition === 'start' ? `url(#${markerId})` : undefined}
        markerEnd={config.markerPosition === 'end' ? `url(#${markerId})` : undefined}
      />
      {(label || editing || data?.label === '') && (
        <EdgeLabelRenderer>
          <div
            ref={labelRef}
            className={`uml-edge-label nodrag nopan nowheel${editing ? ' editing' : ''}`}
            data-edge-id={id}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              borderColor: color,
              zIndex: 1001,
              ...(data?.labelWidth != null && data?.labelHeight != null
                ? { width: data.labelWidth, height: data.labelHeight, boxSizing: 'border-box' as const }
                : {}),
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setDraft(label);
              draftRef.current = label;
              setEditing(true);
            }}
          >
            {editing ? (
              <textarea
                ref={inputRef}
                className="uml-edge-label-input nodrag nopan"
                aria-label="Edit edge label"
                value={draft}
                rows={1}
                onChange={(e) => {
                  setDraft(e.target.value);
                  draftRef.current = e.target.value;
                }}
                onBlur={() => commitLabel()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    commitLabel();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    commitLabel(true);
                  }
                }}
              />
            ) : (
              <span>{label}</span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
