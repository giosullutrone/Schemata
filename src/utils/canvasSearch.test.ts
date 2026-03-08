import { describe, it, expect } from 'vitest';
import { searchNodes } from './canvasSearch';
import type { CanvasNodeSchema } from '../types/schema';

const NODES: CanvasNodeSchema[] = [
  {
    id: 'class-1', type: 'classNode', position: { x: 0, y: 0 },
    data: { name: 'UserService', properties: [{ id: 'p1', name: 'email', type: 'string', visibility: 'private' as const }], methods: [{ id: 'm1', name: 'getUser', parameters: [], returnType: 'User', visibility: 'public' as const }] },
  },
  {
    id: 'class-2', type: 'classNode', position: { x: 200, y: 0 },
    data: { name: 'OrderController', properties: [], methods: [] },
  },
  {
    id: 'text-1', type: 'textNode', position: { x: 100, y: 200 },
    data: { text: 'This handles user authentication' },
  },
  {
    id: 'group-1', type: 'groupNode', position: { x: 0, y: 0 },
    data: { label: 'Domain Layer' },
  },
];

describe('searchNodes', () => {
  it('returns empty array for empty query', () => {
    expect(searchNodes(NODES, '')).toEqual([]);
  });

  it('returns empty array for whitespace-only query', () => {
    expect(searchNodes(NODES, '   ')).toEqual([]);
  });

  it('matches classNode by name', () => {
    const results = searchNodes(NODES, 'UserService');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('class-1');
  });

  it('matches case-insensitively', () => {
    const results = searchNodes(NODES, 'userservice');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('class-1');
  });

  it('matches textNode by text content', () => {
    const results = searchNodes(NODES, 'authentication');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('text-1');
  });

  it('matches groupNode by label', () => {
    const results = searchNodes(NODES, 'Domain');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('group-1');
  });

  it('matches partial strings', () => {
    const results = searchNodes(NODES, 'user');
    // Should match: UserService (name), text-1 (text contains "user")
    expect(results.length).toBeGreaterThanOrEqual(2);
    const ids = results.map((r) => r.id);
    expect(ids).toContain('class-1');
    expect(ids).toContain('text-1');
  });

  it('matches classNode by property name', () => {
    const results = searchNodes(NODES, 'email');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('class-1');
  });

  it('matches classNode by method name', () => {
    const results = searchNodes(NODES, 'getUser');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('class-1');
  });

  it('returns all nodes matching "order"', () => {
    const results = searchNodes(NODES, 'order');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('class-2');
  });

  it('returns empty for non-matching query', () => {
    expect(searchNodes(NODES, 'zzzznotfound')).toEqual([]);
  });
});
