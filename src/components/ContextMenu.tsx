import { useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { RelationshipType, Stereotype } from '../types/schema';
import { ColorRow, StereotypeMenuItems, BorderStyleRow, TextAlignRow } from './contextMenuItems';
import './ContextMenu.css';

const RELATIONSHIP_TYPES: RelationshipType[] = [
  'inheritance', 'implementation', 'composition', 'aggregation', 'dependency', 'association',
];

interface ContextMenuProps {
  x: number;
  y: number;
  type: 'node' | 'edge' | 'selection';
  targetId: string;
  nodeType?: string;
  onClose: () => void;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  selectedNodeRects?: { id: string; x: number; y: number; w: number; h: number }[];
}

export default function ContextMenu({ x, y, type, targetId, nodeType, onClose, screenToFlowPosition, selectedNodeRects }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const addTextNode = useCanvasStore((s) => s.addTextNode);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);
  const updateEdgeType = useCanvasStore((s) => s.updateEdgeType);
  const groupSelectedNodes = useCanvasStore((s) => s.groupSelectedNodes);
  const setEditingNodeId = useCanvasStore((s) => s.setEditingNodeId);

  const targetNodeData = useCanvasStore((s) => {
    const fp = s.activeFilePath;
    if (!fp || type !== 'node') return null;
    const node = s.files[fp]?.nodes.find((n) => n.id === targetId);
    return node?.data as Record<string, unknown> | null;
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [onClose]);

  // Clamp menu position to stay within viewport
  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const clampedX = Math.min(x, window.innerWidth - rect.width - 4);
    const clampedY = Math.min(y, window.innerHeight - rect.height - 4);
    ref.current.style.left = `${Math.max(0, clampedX)}px`;
    ref.current.style.top = `${Math.max(0, clampedY)}px`;
  }, [x, y]);

  const handleColorSelect = useCallback(
    (color: string) => {
      if (type === 'node') {
        updateNodeData(targetId, { color });
      } else if (type === 'edge') {
        updateEdgeData(targetId, { color });
      }
      onClose();
    },
    [type, targetId, updateNodeData, updateEdgeData, onClose]
  );

  const handleDelete = useCallback(() => {
    if (type === 'node') {
      removeNode(targetId);
    } else if (type === 'edge') {
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

  const handleSetStereotype = useCallback(
    (stereotype: Stereotype | undefined) => {
      updateNodeData(targetId, { stereotype });
      onClose();
    },
    [targetId, updateNodeData, onClose]
  );

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

  const handleBorderStyle = useCallback((style: string) => {
    updateNodeData(targetId, { borderStyle: style });
    onClose();
  }, [targetId, updateNodeData, onClose]);

  const handleTextAlign = useCallback((align: string) => {
    updateNodeData(targetId, { textAlign: align });
    onClose();
  }, [targetId, updateNodeData, onClose]);

  const handleAddToGroup = useCallback(() => {
    if (selectedNodeRects && selectedNodeRects.length > 0) {
      groupSelectedNodes(selectedNodeRects);
    }
    onClose();
  }, [selectedNodeRects, groupSelectedNodes, onClose]);

  return (
    <div className="context-menu" ref={ref} style={{ left: x, top: y }} role="menu" aria-label="Context menu">
      {type === 'selection' ? (
        <>
          <div className="context-menu-item" role="menuitem" onClick={handleAddToGroup}>
            Add to group
          </div>
        </>
      ) : (
        <>
          <ColorRow onSelect={handleColorSelect} />
          <div className="context-menu-separator" />

          {type === 'node' && nodeType === 'classNode' && (
            <>
              <StereotypeMenuItems onSet={handleSetStereotype} current={targetNodeData?.stereotype as Stereotype | undefined} />
              <div className="context-menu-separator" />
            </>
          )}

          {type === 'node' && nodeType === 'textNode' && (
            <>
              <div className="context-menu-item" role="menuitem" onClick={() => { setEditingNodeId(targetId); onClose(); }}>
                Edit
              </div>
              <div className="context-menu-separator" />
              <BorderStyleRow
                onSelect={handleBorderStyle}
                current={(targetNodeData?.borderStyle as string) ?? 'solid'}
              />
              <TextAlignRow
                onSelect={handleTextAlign}
                current={(targetNodeData?.textAlign as string) ?? 'left'}
              />
              <div className="context-menu-separator" />
            </>
          )}

          {type === 'edge' && (
            <>
              {RELATIONSHIP_TYPES.map((rt) => (
                <div key={rt} className="context-menu-item" role="menuitem" onClick={() => handleChangeType(rt)}>
                  → {rt}
                </div>
              ))}
              <div className="context-menu-separator" />
            </>
          )}

          <div className="context-menu-item" role="menuitem" onClick={handleAddComment}>
            Add comment
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item danger" role="menuitem" onClick={handleDelete}>
            Delete
          </div>
        </>
      )}
    </div>
  );
}
