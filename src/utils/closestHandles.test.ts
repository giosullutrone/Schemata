import { describe, it, expect } from 'vitest';
import { closestHandles } from './closestHandles';

describe('closestHandles', () => {
  const defaultSize = { width: 200, height: 150 };

  it('returns bottom/top when source is above target', () => {
    const [sh, th] = closestHandles(
      { x: 100, y: 0 }, defaultSize,
      { x: 100, y: 300 }, defaultSize,
    );
    expect(sh).toBe('bottom');
    expect(th).toBe('top');
  });

  it('returns top/bottom when source is below target', () => {
    const [sh, th] = closestHandles(
      { x: 100, y: 300 }, defaultSize,
      { x: 100, y: 0 }, defaultSize,
    );
    expect(sh).toBe('top');
    expect(th).toBe('bottom');
  });

  it('returns right/left when source is left of target', () => {
    const [sh, th] = closestHandles(
      { x: 0, y: 100 }, defaultSize,
      { x: 400, y: 100 }, defaultSize,
    );
    expect(sh).toBe('right');
    expect(th).toBe('left');
  });

  it('returns left/right when source is right of target', () => {
    const [sh, th] = closestHandles(
      { x: 400, y: 100 }, defaultSize,
      { x: 0, y: 100 }, defaultSize,
    );
    expect(sh).toBe('left');
    expect(th).toBe('right');
  });

  it('picks vertical handles when vertical distance dominates', () => {
    // source slightly right but much higher
    const [sh, th] = closestHandles(
      { x: 110, y: 0 }, defaultSize,
      { x: 100, y: 500 }, defaultSize,
    );
    expect(sh).toBe('bottom');
    expect(th).toBe('top');
  });

  it('picks horizontal handles when horizontal distance dominates', () => {
    // source slightly below but much to the left
    const [sh, th] = closestHandles(
      { x: 0, y: 110 }, defaultSize,
      { x: 500, y: 100 }, defaultSize,
    );
    expect(sh).toBe('right');
    expect(th).toBe('left');
  });

  it('handles nodes with different sizes', () => {
    const [sh, th] = closestHandles(
      { x: 0, y: 0 }, { width: 100, height: 50 },
      { x: 0, y: 200 }, { width: 300, height: 200 },
    );
    expect(sh).toBe('bottom');
    expect(th).toBe('top');
  });

  it('returns bottom/top for overlapping x with source above', () => {
    // Same x position, different y — should use vertical handles
    const [sh, th] = closestHandles(
      { x: 100, y: 0 }, defaultSize,
      { x: 100, y: 200 }, defaultSize,
    );
    expect(sh).toBe('bottom');
    expect(th).toBe('top');
  });
});
