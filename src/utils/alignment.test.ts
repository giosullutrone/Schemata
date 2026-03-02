import { describe, it, expect } from 'vitest';
import { calculateGuides, type NodeRect } from './alignment';

describe('calculateGuides', () => {
  const dragged: NodeRect = { id: 'a', x: 100, y: 100, width: 200, height: 150 };

  it('should return empty guides when no other nodes exist', () => {
    const guides = calculateGuides(dragged, []);
    expect(guides).toEqual([]);
  });

  it('should detect horizontal top alignment', () => {
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 100, width: 200, height: 150 }];
    const guides = calculateGuides(dragged, others);
    const horizontals = guides.filter((g) => g.orientation === 'horizontal');
    expect(horizontals.some((g) => g.pos === 100)).toBe(true);
  });

  it('should detect vertical left alignment', () => {
    const others: NodeRect[] = [{ id: 'b', x: 100, y: 400, width: 200, height: 150 }];
    const guides = calculateGuides(dragged, others);
    const verticals = guides.filter((g) => g.orientation === 'vertical');
    expect(verticals.some((g) => g.pos === 100)).toBe(true);
  });

  it('should detect center alignment when centers match', () => {
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 100, width: 200, height: 150 }];
    const guides = calculateGuides(dragged, others);
    const horizontals = guides.filter((g) => g.orientation === 'horizontal');
    expect(horizontals.length).toBeGreaterThan(0);
  });

  it('should snap within threshold', () => {
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 103, width: 200, height: 150 }];
    const guides = calculateGuides(dragged, others, 5);
    const horizontals = guides.filter((g) => g.orientation === 'horizontal');
    expect(horizontals.length).toBeGreaterThan(0);
  });

  it('should not snap outside threshold', () => {
    const others: NodeRect[] = [{ id: 'b', x: 400, y: 110, width: 200, height: 150 }];
    const guides = calculateGuides(dragged, others, 5);
    expect(guides).toEqual([]);
  });
});
