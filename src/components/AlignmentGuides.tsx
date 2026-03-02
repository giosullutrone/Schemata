import type { GuideLine } from '../utils/alignment';
import { useReactFlow } from '@xyflow/react';
import './AlignmentGuides.css';

interface AlignmentGuidesProps {
  guides: GuideLine[];
}

export default function AlignmentGuides({ guides }: AlignmentGuidesProps) {
  const { flowToScreenPosition } = useReactFlow();

  return (
    <>
      {guides.map((guide, i) => {
        if (guide.orientation === 'horizontal') {
          const screenPos = flowToScreenPosition({ x: 0, y: guide.pos });
          return (
            <div
              key={`h-${i}`}
              className="alignment-guide horizontal"
              style={{ top: screenPos.y }}
            />
          );
        } else {
          const screenPos = flowToScreenPosition({ x: guide.pos, y: 0 });
          return (
            <div
              key={`v-${i}`}
              className="alignment-guide vertical"
              style={{ left: screenPos.x }}
            />
          );
        }
      })}
    </>
  );
}
