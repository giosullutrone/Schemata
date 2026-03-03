import { useEffect, useRef, useCallback } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { RelationshipType } from '../types/schema';
import './ContextMenu.css';

const COLORS = ['#4A90D9', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#34495E', '#E67E22'];

const RELATIONSHIP_TYPES: RelationshipType[] = [
  'inheritance', 'implementation', 'composition', 'aggregation', 'dependency', 'association',
];

interface ContextMenuProps {
  x: number;
  y: number;
  type: 'node' | 'edge';
  targetId: string;
  onClose: () => void;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
}

export default function ContextMenu({ x, y, type, targetId, onClose, screenToFlowPosition }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const addAnnotation = useCanvasStore((s) => s.addAnnotation);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);
  const updateEdgeType = useCanvasStore((s) => s.updateEdgeType);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const handleColorSelect = useCallback(
    (color: string) => {
      if (type === 'node') {
        updateNodeData(targetId, { color });
      } else {
        updateEdgeData(targetId, { color });
      }
      onClose();
    },
    [type, targetId, updateNodeData, updateEdgeData, onClose]
  );

  const handleDelete = useCallback(() => {
    if (type === 'node') {
      removeNode(targetId);
    } else {
      removeEdge(targetId);
    }
    onClose();
  }, [type, targetId, removeNode, removeEdge, onClose]);

  const handleChangeType = useCallback(
    (newType: RelationshipType) => {
      updateEdgeType(targetId, newType);
      onClose();
    },
    [targetId, updateEdgeType, onClose]
  );

  const handleAddStereotype = useCallback(() => {
    updateNodeData(targetId, { stereotype: 'interface' });
    onClose();
  }, [targetId, updateNodeData, onClose]);

  const handleAddComment = useCallback(() => {
    const flowPos = screenToFlowPosition({ x: x + 220, y });
    addAnnotation(targetId, type, flowPos.x, flowPos.y);
    onClose();
  }, [targetId, type, x, y, screenToFlowPosition, addAnnotation, onClose]);

  return (
    <div className="context-menu" ref={ref} style={{ left: x, top: y }}>
      <div className="context-menu-color-row">
        {COLORS.map((color) => (
          <div
            key={color}
            className="context-menu-color-swatch"
            style={{ background: color }}
            onClick={() => handleColorSelect(color)}
          />
        ))}
      </div>
      <div className="context-menu-separator" />

      {type === 'node' && (
        <>
          <div className="context-menu-item" onClick={handleAddStereotype}>
            Set stereotype
          </div>
          <div className="context-menu-separator" />
        </>
      )}

      {type === 'edge' && (
        <>
          {RELATIONSHIP_TYPES.map((rt) => (
            <div key={rt} className="context-menu-item" onClick={() => handleChangeType(rt)}>
              → {rt}
            </div>
          ))}
          <div className="context-menu-separator" />
        </>
      )}

      <div className="context-menu-item" onClick={handleAddComment}>
        Add comment
      </div>
      <div className="context-menu-separator" />
      <div className="context-menu-item danger" onClick={handleDelete}>
        Delete
      </div>
    </div>
  );
}
