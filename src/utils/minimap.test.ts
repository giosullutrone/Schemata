import { describe, it, expect } from 'vitest';
import { minimapNodeColor } from './minimap';

describe('minimapNodeColor', () => {
  it('returns blue for classNode', () => {
    expect(minimapNodeColor('classNode')).toBe('#4A90D9');
  });

  it('returns orange for textNode', () => {
    expect(minimapNodeColor('textNode')).toBe('#F39C12');
  });

  it('returns green for groupNode', () => {
    expect(minimapNodeColor('groupNode')).toBe('#2ECC71');
  });

  it('returns gray for unknown type', () => {
    expect(minimapNodeColor('something')).toBe('#888888');
  });

  it('returns gray for undefined type', () => {
    expect(minimapNodeColor()).toBe('#888888');
  });
});
