import { describe, it, expect } from 'vitest';
import { findOverlappingNodes } from './overlapDetection';

interface TestNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  parentId?: string;
}

describe('findOverlappingNodes', () => {
  it('returns empty array when no nodes overlap', () => {
    const nodes: TestNode[] = [
      { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, width: 100, height: 100 },
      { id: 'class-2', type: 'classNode', position: { x: 200, y: 0 }, width: 100, height: 100 },
    ];
    expect(findOverlappingNodes(nodes)).toEqual([]);
  });

  it('detects two overlapping class nodes', () => {
    const nodes: TestNode[] = [
      { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, width: 150, height: 100 },
      { id: 'class-2', type: 'classNode', position: { x: 100, y: 50 }, width: 150, height: 100 },
    ];
    const result = findOverlappingNodes(nodes);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      nodeA: 'class-1',
      nodeB: 'class-2',
    }));
  });

  it('excludes group nodes overlapping with their children', () => {
    const nodes: TestNode[] = [
      { id: 'group-1', type: 'groupNode', position: { x: 0, y: 0 }, width: 400, height: 400 },
      { id: 'class-1', type: 'classNode', position: { x: 50, y: 50 }, width: 100, height: 100, parentId: 'group-1' },
    ];
    expect(findOverlappingNodes(nodes)).toEqual([]);
  });

  it('detects overlap between two non-child nodes inside a group', () => {
    const nodes: TestNode[] = [
      { id: 'group-1', type: 'groupNode', position: { x: 0, y: 0 }, width: 400, height: 400 },
      { id: 'class-1', type: 'classNode', position: { x: 50, y: 50 }, width: 150, height: 100, parentId: 'group-1' },
      { id: 'class-2', type: 'classNode', position: { x: 100, y: 80 }, width: 150, height: 100, parentId: 'group-1' },
    ];
    const result = findOverlappingNodes(nodes);
    expect(result).toHaveLength(1);
    expect(result[0].nodeA).toBe('class-1');
    expect(result[0].nodeB).toBe('class-2');
  });

  it('returns empty for touching but non-overlapping nodes', () => {
    const nodes: TestNode[] = [
      { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, width: 100, height: 100 },
      { id: 'class-2', type: 'classNode', position: { x: 100, y: 0 }, width: 100, height: 100 },
    ];
    expect(findOverlappingNodes(nodes)).toEqual([]);
  });

  it('excludes group-to-group overlaps when one is parent of the other', () => {
    // nested groups
    const nodes: TestNode[] = [
      { id: 'group-1', type: 'groupNode', position: { x: 0, y: 0 }, width: 500, height: 500 },
      { id: 'group-2', type: 'groupNode', position: { x: 50, y: 50 }, width: 200, height: 200, parentId: 'group-1' },
    ];
    expect(findOverlappingNodes(nodes)).toEqual([]);
  });

  it('detects overlap between unrelated groups', () => {
    const nodes: TestNode[] = [
      { id: 'group-1', type: 'groupNode', position: { x: 0, y: 0 }, width: 200, height: 200 },
      { id: 'group-2', type: 'groupNode', position: { x: 150, y: 150 }, width: 200, height: 200 },
    ];
    const result = findOverlappingNodes(nodes);
    expect(result).toHaveLength(1);
  });

  it('returns overlap area', () => {
    const nodes: TestNode[] = [
      { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, width: 200, height: 200 },
      { id: 'class-2', type: 'classNode', position: { x: 100, y: 100 }, width: 200, height: 200 },
    ];
    const result = findOverlappingNodes(nodes);
    expect(result).toHaveLength(1);
    // overlap region: x[100,200] y[100,200] = 100*100 = 10000
    expect(result[0].overlapArea).toBe(10000);
  });

  it('handles multiple overlapping pairs', () => {
    const nodes: TestNode[] = [
      { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, width: 150, height: 150 },
      { id: 'class-2', type: 'classNode', position: { x: 100, y: 0 }, width: 150, height: 150 },
      { id: 'class-3', type: 'classNode', position: { x: 200, y: 0 }, width: 150, height: 150 },
    ];
    const result = findOverlappingNodes(nodes);
    // class-1 & class-2 overlap, class-2 & class-3 overlap
    expect(result).toHaveLength(2);
  });

  it('returns empty for a single node', () => {
    const nodes: TestNode[] = [
      { id: 'class-1', type: 'classNode', position: { x: 0, y: 0 }, width: 100, height: 100 },
    ];
    expect(findOverlappingNodes(nodes)).toEqual([]);
  });

  it('returns empty for no nodes', () => {
    expect(findOverlappingNodes([])).toEqual([]);
  });
});
