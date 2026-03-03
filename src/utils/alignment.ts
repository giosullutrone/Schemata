export interface NodeRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GuideLine {
  orientation: 'horizontal' | 'vertical';
  pos: number;
}

export interface SnapResult {
  guides: GuideLine[];
  snapDeltaX: number | null;
  snapDeltaY: number | null;
}

export function calculateGuides(
  dragged: NodeRect,
  others: NodeRect[],
  threshold: number = 5
): SnapResult {
  const guides: GuideLine[] = [];
  let bestDeltaX: number | null = null;
  let bestDistX = Infinity;
  let bestDeltaY: number | null = null;
  let bestDistY = Infinity;

  const draggedCenterX = dragged.x + dragged.width / 2;
  const draggedCenterY = dragged.y + dragged.height / 2;
  const draggedRight = dragged.x + dragged.width;
  const draggedBottom = dragged.y + dragged.height;

  for (const other of others) {
    if (other.id === dragged.id) continue;

    const otherCenterX = other.x + other.width / 2;
    const otherCenterY = other.y + other.height / 2;
    const otherRight = other.x + other.width;
    const otherBottom = other.y + other.height;

    const hChecks = [
      { dragVal: dragged.y, otherVal: other.y },
      { dragVal: dragged.y, otherVal: otherBottom },
      { dragVal: draggedBottom, otherVal: other.y },
      { dragVal: draggedBottom, otherVal: otherBottom },
      { dragVal: draggedCenterY, otherVal: otherCenterY },
    ];

    for (const { dragVal, otherVal } of hChecks) {
      const dist = Math.abs(dragVal - otherVal);
      if (dist <= threshold) {
        if (!guides.some((g) => g.orientation === 'horizontal' && g.pos === otherVal)) {
          guides.push({ orientation: 'horizontal', pos: otherVal });
        }
        if (dist < bestDistY) {
          bestDistY = dist;
          bestDeltaY = otherVal - dragVal;
        }
      }
    }

    const vChecks = [
      { dragVal: dragged.x, otherVal: other.x },
      { dragVal: dragged.x, otherVal: otherRight },
      { dragVal: draggedRight, otherVal: other.x },
      { dragVal: draggedRight, otherVal: otherRight },
      { dragVal: draggedCenterX, otherVal: otherCenterX },
    ];

    for (const { dragVal, otherVal } of vChecks) {
      const dist = Math.abs(dragVal - otherVal);
      if (dist <= threshold) {
        if (!guides.some((g) => g.orientation === 'vertical' && g.pos === otherVal)) {
          guides.push({ orientation: 'vertical', pos: otherVal });
        }
        if (dist < bestDistX) {
          bestDistX = dist;
          bestDeltaX = otherVal - dragVal;
        }
      }
    }
  }

  return { guides, snapDeltaX: bestDeltaX, snapDeltaY: bestDeltaY };
}
