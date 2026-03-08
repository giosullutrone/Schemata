import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { searchNodes } from '../utils/canvasSearch';
import './CanvasSearch.css';

interface CanvasSearchProps {
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
}

export default function CanvasSearch({ onClose, onFocusNode }: CanvasSearchProps) {
  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const onFocusNodeRef = useRef(onFocusNode);
  onFocusNodeRef.current = onFocusNode;

  const activeFile = useCanvasStore((s) =>
    s.activeFilePath ? s.files[s.activeFilePath] ?? null : null
  );

  const matches = useMemo(
    () => (activeFile ? searchNodes(activeFile.nodes, query) : []),
    [activeFile, query]
  );

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // When matches change (new query or nodes changed), reset index and focus first match
  const prevMatchIdsRef = useRef('');
  useEffect(() => {
    const matchIds = matches.map((m) => m.id).join(',');
    if (matchIds === prevMatchIdsRef.current) return;
    prevMatchIdsRef.current = matchIds;
    setMatchIndex(0);
    if (matches.length > 0) {
      onFocusNodeRef.current(matches[0].id);
    }
  }, [matches]);

  const focusMatch = useCallback(
    (index: number) => {
      if (matches.length > 0 && matches[index]) {
        onFocusNodeRef.current(matches[index].id);
      }
    },
    [matches]
  );

  const goNext = useCallback(() => {
    if (matches.length === 0) return;
    setMatchIndex((i) => {
      const next = (i + 1) % matches.length;
      focusMatch(next);
      return next;
    });
  }, [matches.length, focusMatch]);

  const goPrev = useCallback(() => {
    if (matches.length === 0) return;
    setMatchIndex((i) => {
      const prev = (i - 1 + matches.length) % matches.length;
      focusMatch(prev);
      return prev;
    });
  }, [matches.length, focusMatch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          goPrev();
        } else {
          goNext();
        }
      }
    },
    [onClose, goNext, goPrev]
  );

  return (
    <div className="canvas-search">
      <input
        ref={inputRef}
        className="canvas-search-input"
        type="text"
        placeholder="Search nodes..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {query && (
        <span className="canvas-search-count">
          {matches.length === 0
            ? 'No results'
            : `${matchIndex + 1} / ${matches.length}`}
        </span>
      )}
      <div className="canvas-search-nav">
        <button onClick={goPrev} title="Previous (Shift+Enter)" disabled={matches.length === 0}>
          &#x25B2;
        </button>
        <button onClick={goNext} title="Next (Enter)" disabled={matches.length === 0}>
          &#x25BC;
        </button>
      </div>
      <button className="canvas-search-close" onClick={onClose} title="Close (Esc)">
        &times;
      </button>
    </div>
  );
}
