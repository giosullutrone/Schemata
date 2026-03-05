import type { GuideLine } from '../utils/alignment';
import { useStore } from '@xyflow/react';
import './AlignmentGuides.css';

interface AlignmentGuidesProps {
  guides: GuideLine[];
}

export default function AlignmentGuides({ guides }: AlignmentGuidesProps) {
  const transform = useStore((s) => s.transform);
  const [tx, ty, zoom] = transform;

  return (
    <>
      {guides.map((guide, i) => {
        if (guide.orientation === 'horizontal') {
          return (
            <div
              key={`h-${i}`}
              className="alignment-guide horizontal"
              style={{ top: guide.pos * zoom + ty }}
            />
          );
        } else {
          return (
            <div
              key={`v-${i}`}
              className="alignment-guide vertical"
              style={{ left: guide.pos * zoom + tx }}
            />
          );
        }
      })}
    </>
  );
}
