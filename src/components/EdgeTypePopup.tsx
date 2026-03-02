import { useEffect, useRef } from 'react';
import type { RelationshipType } from '../types/schema';
import './EdgeTypePopup.css';

const EDGE_OPTIONS: { type: RelationshipType; label: string; icon: string }[] = [
  { type: 'inheritance', label: 'Inherits', icon: '△' },
  { type: 'implementation', label: 'Implements', icon: '▷' },
  { type: 'composition', label: 'Composition', icon: '◆' },
  { type: 'aggregation', label: 'Aggregation', icon: '◇' },
  { type: 'dependency', label: 'Dependency', icon: '⇢' },
  { type: 'association', label: 'Association', icon: '→' },
];

interface EdgeTypePopupProps {
  x: number;
  y: number;
  onSelect: (type: RelationshipType) => void;
  onClose: () => void;
}

export default function EdgeTypePopup({ x, y, onSelect, onClose }: EdgeTypePopupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div className="edge-type-popup" ref={ref} style={{ left: x, top: y }}>
      {EDGE_OPTIONS.map(({ type, label, icon }) => (
        <div key={type} className="edge-type-popup-item" onClick={() => onSelect(type)}>
          <span className="edge-type-popup-item-icon">{icon}</span>
          {label}
        </div>
      ))}
    </div>
  );
}
