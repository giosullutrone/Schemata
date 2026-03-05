import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type Node, type NodeProps } from '@xyflow/react';
import type { ClassNodeData, ClassNodeSchema, ClassProperty, ClassMethod, Visibility } from '../types/schema';
import { useCanvasStore, generatePropId, generateMethodId } from '../store/useCanvasStore';
import { useScrollBlockOnSelect } from '../hooks/useScrollBlockOnSelect';
import './ClassNode.css';

type ClassNodeType = Node<ClassNodeData, 'classNode'>;

function findClassNode(nodeId: string): ClassNodeSchema | undefined {
  const state = useCanvasStore.getState();
  if (!state.activeFilePath) return undefined;
  const file = state.files[state.activeFilePath];
  if (!file) return undefined;
  const node = file.nodes.find((n: ClassNodeSchema | { id: string; type?: string }) => n.id === nodeId);
  if (node?.type === 'classNode') return node as ClassNodeSchema;
  return undefined;
}

const VISIBILITY_SYMBOLS: Record<Visibility, string> = {
  public: '+',
  private: '-',
  protected: '#',
};

// ---------------------------------------------------------------------------
// InlineEdit
// ---------------------------------------------------------------------------
function InlineEdit({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (newValue: string) => boolean | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    if (draft.trim() !== '' && draft !== value) {
      const result = onCommit(draft.trim());
      if (result === false) {
        setDraft(value);
        setEditing(false);
        setError(true);
        setTimeout(() => setError(false), 1500);
        return;
      }
    } else {
      setDraft(value);
    }
    setEditing(false);
  }, [draft, value, onCommit]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="class-node-inline-input nodrag"
        aria-label="Edit value"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <span
      className={error ? 'class-node-inline-error' : undefined}
      onDoubleClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PropertyRow
// ---------------------------------------------------------------------------
function PropertyRow({
  property,
  nodeId,
  index,
}: {
  property: ClassProperty;
  nodeId: string;
  index: number;
}) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const updateProperty = useCallback(
    (patch: Partial<ClassProperty>) => {
      const node = findClassNode(nodeId);
      if (!node) return;
      const props = [...node.data.properties];
      props[index] = { ...props[index], ...patch };
      updateNodeData(nodeId, { properties: props });
    },
    [nodeId, index, updateNodeData],
  );

  const removeProperty = useCallback(() => {
    const node = findClassNode(nodeId);
    if (!node) return;
    const props = node.data.properties.filter((_: ClassProperty, i: number) => i !== index);
    updateNodeData(nodeId, { properties: props });
  }, [nodeId, index, updateNodeData]);

  const displayText = `${VISIBILITY_SYMBOLS[property.visibility]} ${property.name}: ${property.type}`;

  return (
    <div className="class-node-row">
      <Handle
        type="source"
        position={Position.Right}
        id={property.id}
        className="class-node-sub-handle"
      />
      <InlineEdit
        value={displayText}
        onCommit={(val) => {
          const match = val.match(/^([+\-#])\s*(\w+):\s*(.+)$/);
          if (!match) return false;
          const symToVis: Record<string, Visibility> = { '+': 'public', '-': 'private', '#': 'protected' };
          updateProperty({
            visibility: symToVis[match[1]] ?? property.visibility,
            name: match[2],
            type: match[3].trim(),
          });
        }}
      />
      <span className="class-node-row-remove" onClick={removeProperty}>
        &#x2715;
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MethodRow
// ---------------------------------------------------------------------------
function MethodRow({
  method,
  nodeId,
  index,
}: {
  method: ClassMethod;
  nodeId: string;
  index: number;
}) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const updateMethod = useCallback(
    (patch: Partial<ClassMethod>) => {
      const node = findClassNode(nodeId);
      if (!node) return;
      const methods = [...node.data.methods];
      methods[index] = { ...methods[index], ...patch };
      updateNodeData(nodeId, { methods });
    },
    [nodeId, index, updateNodeData],
  );

  const removeMethod = useCallback(() => {
    const node = findClassNode(nodeId);
    if (!node) return;
    const methods = node.data.methods.filter((_: ClassMethod, i: number) => i !== index);
    updateNodeData(nodeId, { methods });
  }, [nodeId, index, updateNodeData]);

  const params = method.parameters.map((p) => `${p.name}: ${p.type}`).join(', ');
  const displayText = `${VISIBILITY_SYMBOLS[method.visibility]} ${method.name}(${params}): ${method.returnType}`;

  return (
    <div className="class-node-row">
      <Handle
        type="source"
        position={Position.Right}
        id={method.id}
        className="class-node-sub-handle"
      />
      <InlineEdit
        value={displayText}
        onCommit={(val) => {
          const match = val.match(/^([+\-#])\s*(\w+)\(([^)]*)\):\s*(.+)$/);
          if (!match) return false;
          const symToVis: Record<string, Visibility> = { '+': 'public', '-': 'private', '#': 'protected' };
          const paramStr = match[3].trim();
          const parameters = paramStr
            ? paramStr.split(',').map((seg) => {
                const parts = seg.trim().split(':');
                return { name: parts[0].trim(), type: (parts[1] ?? '').trim() };
              })
            : [];
          updateMethod({
            visibility: symToVis[match[1]] ?? method.visibility,
            name: match[2],
            parameters,
            returnType: match[4].trim(),
          });
        }}
      />
      <span className="class-node-row-remove" onClick={removeMethod}>
        &#x2715;
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClassNodeComponent
// ---------------------------------------------------------------------------
function ClassNodeComponent({ id, data, selected, isConnectable }: NodeProps<ClassNodeType>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const containerRef = useRef<HTMLDivElement>(null);
  const propsSectionRef = useRef<HTMLDivElement>(null);
  const methodsSectionRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef([propsSectionRef, methodsSectionRef]).current;
  const blockPan = useScrollBlockOnSelect(containerRef, sectionRefs, selected);

  const headerStyle = data.color
    ? { borderBottom: `2px solid ${data.color}`, background: `${data.color}11` }
    : undefined;

  const borderStyle = data.color ? { borderColor: data.color } : undefined;

  const addProperty = useCallback(() => {
    const node = findClassNode(id);
    if (!node) return;
    const newProp: ClassProperty = { id: generatePropId(), name: 'field', type: 'string', visibility: 'private' };
    updateNodeData(id, { properties: [...node.data.properties, newProp] });
  }, [id, updateNodeData]);

  const addMethod = useCallback(() => {
    const node = findClassNode(id);
    if (!node) return;
    const newMethod: ClassMethod = {
      id: generateMethodId(),
      name: 'method',
      parameters: [],
      returnType: 'void',
      visibility: 'public',
    };
    updateNodeData(id, { methods: [...node.data.methods, newMethod] });
  }, [id, updateNodeData]);

  return (
    <div
      ref={containerRef}
      className={`class-node${selected ? ' selected' : ''}${blockPan ? ' nowheel' : ''}`}
      style={borderStyle}
    >
      <NodeResizer
        minWidth={150}
        minHeight={80}
        isVisible={!!selected}
      />
      {/* Handles on all four sides */}
      <Handle type="target" position={Position.Top} id="top" isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={isConnectable} />
      <Handle type="target" position={Position.Left} id="left" isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="right" isConnectable={isConnectable} />

      {/* Header */}
      <div className="class-node-header" style={headerStyle}>
        {data.stereotype && (
          <div className="class-node-stereotype">
            &laquo;{data.stereotype}&raquo;
          </div>
        )}
        <div className="class-node-name">
          <InlineEdit
            value={data.name}
            onCommit={(val) => updateNodeData(id, { name: val })}
          />
        </div>
      </div>

      {/* Properties section */}
      <div className="class-node-section" ref={propsSectionRef}>
        {data.properties.map((prop, i) => (
          <PropertyRow key={prop.id} property={prop} nodeId={id} index={i} />
        ))}
        <div className="class-node-add-btn nodrag" onClick={addProperty}>
          + property
        </div>
      </div>

      {/* Methods section */}
      <div className="class-node-section" ref={methodsSectionRef}>
        {data.methods.map((method, i) => (
          <MethodRow key={method.id} method={method} nodeId={id} index={i} />
        ))}
        <div className="class-node-add-btn nodrag" onClick={addMethod}>
          + method
        </div>
      </div>
    </div>
  );
}

export default memo(ClassNodeComponent);
