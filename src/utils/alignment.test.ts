import { describe, it, expect } from 'vitest';
import { calculateGuides, type NodeRect } from './alignment';

describe('calculateGuides', () => {
  const dragged: NodeRect = { id: 'a', x: 100, y: 100, width: 200, height: 150 };

  it('should return empty guides when no other nodes exist', () => {
    const result = calculateGuides(dragged, []);
    expect(result.guides).toEqual([]);
    expect(result.snapDeltaX).toBeNull();
    expect(result.snapDeltaY).toBeNull();
  });

  it('should detect horizontal top alignment', () => {
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 100, width: 200, height: 150 }];
    const result = calculateGuides(dragged, others);
    const horizontals = result.guides.filter((g) => g.orientation === 'horizontal');
    expect(horizontals.some((g) => g.pos === 100)).toBe(true);
  });

  it('should detect vertical left alignment', () => {
    const others: NodeRect[] = [{ id: 'b', x: 100, y: 400, width: 200, height: 150 }];
    const result = calculateGuides(dragged, others);
    const verticals = result.guides.filter((g) => g.orientation === 'vertical');
    expect(verticals.some((g) => g.pos === 100)).toBe(true);
  });

  it('should detect center alignment when centers match', () => {
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 100, width: 200, height: 150 }];
    const result = calculateGuides(dragged, others);
    const horizontals = result.guides.filter((g) => g.orientation === 'horizontal');
    expect(horizontals.length).toBeGreaterThan(0);
  });

  it('should snap within threshold', () => {
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 103, width: 200, height: 150 }];
    const result = calculateGuides(dragged, others, 5);
    const horizontals = result.guides.filter((g) => g.orientation === 'horizontal');
    expect(horizontals.length).toBeGreaterThan(0);
  });

  it('should not snap outside threshold', () => {
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 110, width: 200, height: 150 }];
    const result = calculateGuides(dragged, others, 5);
    expect(result.guides).toEqual([]);
  });

  it('should return correct snap deltas', () => {
    const others: NodeRect[] = [{ id: 'b', x: 103, y: 97, width: 200, height: 150 }];
    const result = calculateGuides(dragged, others, 5);
    expect(result.snapDeltaX).toBe(3);   // 103 - 100
    expect(result.snapDeltaY).toBe(-3);  // 97 - 100
  });

  it('should pick the closest snap when multiple nodes match', () => {
    // Node 'b' is 4px away on X, node 'c' is 2px away on X — should snap to 'c'
    const others: NodeRect[] = [
      { id: 'b', x: 104, y: 400, width: 200, height: 150 },
      { id: 'c', x: 102, y: 500, width: 200, height: 150 },
    ];
    const result = calculateGuides(dragged, others, 5);
    expect(result.snapDeltaX).toBe(2); // closer match: 102 - 100
  });

  it('should snap both axes simultaneously', () => {
    const others: NodeRect[] = [{ id: 'b', x: 103, y: 97, width: 200, height: 150 }];
    const result = calculateGuides(dragged, others, 5);
    // Both axes should have snap deltas
    expect(result.snapDeltaX).not.toBeNull();
    expect(result.snapDeltaY).not.toBeNull();
    // And both should produce guides
    const verticals = result.guides.filter((g) => g.orientation === 'vertical');
    const horizontals = result.guides.filter((g) => g.orientation === 'horizontal');
    expect(verticals.length).toBeGreaterThan(0);
    expect(horizontals.length).toBeGreaterThan(0);
  });

  it('should not produce duplicate guides', () => {
    // Two nodes at the same Y position — should produce only one horizontal guide at y=100
    const others: NodeRect[] = [
      { id: 'b', x: 400, y: 100, width: 200, height: 150 },
      { id: 'c', x: 700, y: 100, width: 200, height: 150 },
    ];
    const result = calculateGuides(dragged, others);
    const horizontals = result.guides.filter((g) => g.orientation === 'horizontal' && g.pos === 100);
    expect(horizontals).toHaveLength(1);
  });

  it('should detect right-edge to left-edge alignment', () => {
    // Dragged right edge (100 + 200 = 300) aligns with other left edge (300)
    const others: NodeRect[] = [{ id: 'b', x: 300, y: 400, width: 200, height: 150 }];
    const result = calculateGuides(dragged, others);
    const verticals = result.guides.filter((g) => g.orientation === 'vertical');
    expect(verticals.some((g) => g.pos === 300)).toBe(true);
  });

  it('should detect bottom-edge to top-edge alignment', () => {
    // Dragged bottom (100 + 150 = 250) aligns with other top (250)
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 250, width: 200, height: 150 }];
    const result = calculateGuides(dragged, others);
    const horizontals = result.guides.filter((g) => g.orientation === 'horizontal');
    expect(horizontals.some((g) => g.pos === 250)).toBe(true);
  });

  it('should detect vertical center-center alignment', () => {
    // Dragged center X = 100 + 200/2 = 200. Other center X = 150 + 100/2 = 200.
    const others: NodeRect[] = [{ id: 'b', x: 150, y: 400, width: 100, height: 80 }];
    const result = calculateGuides(dragged, others);
    const verticals = result.guides.filter((g) => g.orientation === 'vertical');
    expect(verticals.some((g) => g.pos === 200)).toBe(true);
  });

  it('should align edges between different-sized nodes', () => {
    // Dragged: x=100, w=200 (right=300). Other: x=300, w=50 (right=350).
    // Right-to-left alignment: draggedRight(300) == other.x(300)
    const others: NodeRect[] = [{ id: 'b', x: 300, y: 400, width: 50, height: 80 }];
    const result = calculateGuides(dragged, others);
    const verticals = result.guides.filter((g) => g.orientation === 'vertical');
    expect(verticals.some((g) => g.pos === 300)).toBe(true);
    expect(result.snapDeltaX).toBe(0);
  });

  it('should scale threshold with zoom', () => {
    // At zoom=2, threshold 5 becomes 5/2=2.5 flow units.
    // 3px away should NOT snap at zoom=2 (3 > 2.5)
    const others: NodeRect[] = [{ id: 'b', x: 103, y: 400, width: 200, height: 150 }];
    const noSnap = calculateGuides(dragged, others, 5, 2);
    expect(noSnap.snapDeltaX).toBeNull();

    // At zoom=0.5, threshold 5 becomes 5/0.5=10 flow units.
    // 8px away SHOULD snap at zoom=0.5 (8 < 10)
    const others2: NodeRect[] = [{ id: 'b', x: 108, y: 400, width: 200, height: 150 }];
    const snaps = calculateGuides(dragged, others2, 5, 0.5);
    expect(snaps.snapDeltaX).toBe(8);
  });

  it('should only show guides matching the snapped position', () => {
    // Dragged: x=100, w=200, right=300. Two others:
    // Node B: left=100 (exact left-left match, dist=0)
    // Node C: left=303 (close to right-left, dist=3)
    // Best delta = 0 (exact match). Guide at 303 should be filtered out
    // because after snap (delta=0), right edge stays at 300, not 303.
    const others: NodeRect[] = [
      { id: 'b', x: 100, y: 400, width: 80, height: 80 },
      { id: 'c', x: 303, y: 400, width: 80, height: 80 },
    ];
    const result = calculateGuides(dragged, others);
    const verticals = result.guides.filter((g) => g.orientation === 'vertical');
    expect(verticals.some((g) => g.pos === 100)).toBe(true);
    expect(verticals.some((g) => g.pos === 303)).toBe(false);
  });
});
