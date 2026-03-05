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
  threshold: number = 5,
  zoom: number = 1,
): SnapResult {
  const scaledThreshold = threshold / zoom;
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
      if (dist <= scaledThreshold) {
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
      if (dist <= scaledThreshold) {
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

  // Filter guides to only show lines that the node actually aligns with
  // after snapping. Without this, non-best-match guides can be off by
  // up to `scaledThreshold` pixels, which looks misleading.
  const snappedEdgesX = new Set([
    dragged.x + (bestDeltaX ?? 0),
    draggedRight + (bestDeltaX ?? 0),
    draggedCenterX + (bestDeltaX ?? 0),
  ]);
  const snappedEdgesY = new Set([
    dragged.y + (bestDeltaY ?? 0),
    draggedBottom + (bestDeltaY ?? 0),
    draggedCenterY + (bestDeltaY ?? 0),
  ]);
  const filteredGuides = guides.filter((g) =>
    g.orientation === 'vertical' ? snappedEdgesX.has(g.pos) : snappedEdgesY.has(g.pos)
  );

  return { guides: filteredGuides, snapDeltaX: bestDeltaX, snapDeltaY: bestDeltaY };
}
