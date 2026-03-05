import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCanvasStore } from '../store/useCanvasStore';
import { resolveImageUrl } from '../utils/imageCache';
import { useScrollBlockOnSelect } from '../hooks/useScrollBlockOnSelect';
import type { TextNodeData } from '../types/schema';
import './TextNode.css';

function MarkdownMedia({ src, alt, folderHandle, activeFilePath, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & {
  folderHandle: FileSystemDirectoryHandle | null;
  activeFilePath: string | null;
}) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const isPdf = src?.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    if (!src) return;
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      setResolvedSrc(src);
      return;
    }
    if (!folderHandle) return;
    let cancelled = false;
    resolveImageUrl(folderHandle, activeFilePath ?? '', src).then((url) => {
      if (!cancelled && url) setResolvedSrc(url);
    });
    return () => { cancelled = true; };
  }, [src, folderHandle, activeFilePath]);

  if (!resolvedSrc) {
    return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>[{alt || (isPdf ? 'pdf' : 'image')}]</span>;
  }

  if (isPdf) {
    return (
      <embed
        src={resolvedSrc}
        type="application/pdf"
        className="text-node-pdf"
        title={alt || 'PDF document'}
      />
    );
  }

  return <img src={resolvedSrc} alt={alt} {...props} />;
}

function TextNodeComponent({ id, data, selected, isConnectable }: NodeProps) {
  const d = data as unknown as TextNodeData;
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const folderHandle = useCanvasStore((s) => s.folderHandle);
  const activeFilePath = useCanvasStore((s) => s.activeFilePath);
  const shouldEdit = useCanvasStore((s) => s.editingNodeId === id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const blockPan = useScrollBlockOnSelect(containerRef, contentRef, selected);

  // Trigger editing from context menu
  useEffect(() => {
    if (shouldEdit) {
      setDraft(d.text);
      setEditing(true);
      useCanvasStore.getState().setEditingNodeId(null);
    }
  }, [shouldEdit, d.text]);

  // Sync draft from store when not editing (e.g. after undo/redo)
  useEffect(() => {
    if (!editing) {
      setDraft(d.text);
    }
  }, [d.text, editing]);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
    }
  }, [editing]);

  const commit = useCallback(() => {
    if (draft !== d.text) {
      updateNodeData(id, { text: draft });
    }
    setEditing(false);
  }, [draft, d.text, id, updateNodeData]);

  const color = d.color;
  const borderStyle = d.borderStyle ?? 'solid';
  const opacity = d.opacity ?? 1;
  const textAlign = d.textAlign ?? 'left';

  const remarkPlugins = useMemo(() => [remarkGfm], []);
  const mdComponents = useMemo(() => ({
    a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    ),
    img: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
      <MarkdownMedia src={src} alt={alt} folderHandle={folderHandle} activeFilePath={activeFilePath} {...props} />
    ),
  }), [folderHandle, activeFilePath]);

  const nodeStyle: React.CSSProperties = {
    borderStyle,
    ...(borderStyle === 'double' ? { borderWidth: 4 } : {}),
    opacity,
    ...(color ? { borderColor: color, backgroundColor: `${color}18` } : {}),
  };

  return (
    <div ref={containerRef} className={`text-node${selected ? ' selected' : ''}${blockPan ? ' nowheel' : ''}`} style={nodeStyle}>
      <NodeResizer isVisible={!!selected} minWidth={120} minHeight={40} />
      <Handle type="source" position={Position.Top} id="top" className="text-node-sub-handle" isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="right" className="text-node-sub-handle" isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} id="bottom" className="text-node-sub-handle" isConnectable={isConnectable} />
      <Handle type="source" position={Position.Left} id="left" className="text-node-sub-handle" isConnectable={isConnectable} />
      {editing ? (
        <textarea
          ref={textareaRef}
          className="text-node-textarea nodrag nowheel"
          aria-label="Edit markdown text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setDraft(d.text);
              setEditing(false);
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              commit();
            }
          }}
        />
      ) : (
        <div
          ref={contentRef}
          className="text-node-content"
          style={{ textAlign }}
          onDoubleClick={() => {
            setDraft(d.text);
            setEditing(true);
          }}
        >
          {d.text ? (
            <div className="text-node-markdown">
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                components={mdComponents}
              >
                {d.text}
              </ReactMarkdown>
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Double-click to edit...</span>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(TextNodeComponent);
