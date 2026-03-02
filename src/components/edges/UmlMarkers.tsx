export default function UmlMarkers() {
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
      <defs>
        <marker
          id="uml-inheritance"
          viewBox="0 0 20 20"
          markerWidth={16}
          markerHeight={16}
          refX={20}
          refY={10}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 20 10 L 0 20 Z" fill="white" stroke="currentColor" strokeWidth={1.5} />
        </marker>
        <marker
          id="uml-implementation"
          viewBox="0 0 20 20"
          markerWidth={16}
          markerHeight={16}
          refX={20}
          refY={10}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 20 10 L 0 20 Z" fill="white" stroke="currentColor" strokeWidth={1.5} />
        </marker>
        <marker
          id="uml-composition"
          viewBox="0 0 20 20"
          markerWidth={16}
          markerHeight={16}
          refX={0}
          refY={10}
          orient="auto-start-reverse"
        >
          <path d="M 10 0 L 20 10 L 10 20 L 0 10 Z" fill="currentColor" stroke="currentColor" strokeWidth={1} />
        </marker>
        <marker
          id="uml-aggregation"
          viewBox="0 0 20 20"
          markerWidth={16}
          markerHeight={16}
          refX={0}
          refY={10}
          orient="auto-start-reverse"
        >
          <path d="M 10 0 L 20 10 L 10 20 L 0 10 Z" fill="white" stroke="currentColor" strokeWidth={1.5} />
        </marker>
        <marker
          id="uml-dependency"
          viewBox="0 0 20 20"
          markerWidth={14}
          markerHeight={14}
          refX={20}
          refY={10}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 20 10 L 0 20" fill="none" stroke="currentColor" strokeWidth={1.5} />
        </marker>
        <marker
          id="uml-association"
          viewBox="0 0 20 20"
          markerWidth={14}
          markerHeight={14}
          refX={20}
          refY={10}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 20 10 L 0 20" fill="none" stroke="currentColor" strokeWidth={1.5} />
        </marker>
      </defs>
    </svg>
  );
}
