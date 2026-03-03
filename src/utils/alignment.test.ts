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
});
