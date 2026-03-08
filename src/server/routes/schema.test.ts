import { describe, it, expect } from 'vitest';
import { app } from '../app';

describe('Schema routes', () => {
  describe('GET /api/schema', () => {
    it('returns all enum values', async () => {
      const res = await app.request('/api/schema');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toHaveProperty('data');
      expect(json.data).toHaveProperty('nodeTypes');
      expect(json.data).toHaveProperty('relationshipTypes');
      expect(json.data).toHaveProperty('stereotypes');
      expect(json.data).toHaveProperty('visibilities');
      expect(json.data).toHaveProperty('edgeStrokeStyles');
      expect(json.data).toHaveProperty('borderStyles');
      expect(json.data).toHaveProperty('textAligns');
      expect(json.data).toHaveProperty('colors');
    });

    it('contains expected values in each array', async () => {
      const res = await app.request('/api/schema');
      const json = await res.json();
      const { data } = json;

      expect(data.nodeTypes).toEqual(['classNode', 'textNode', 'groupNode']);
      expect(data.relationshipTypes).toEqual([
        'inheritance',
        'implementation',
        'composition',
        'aggregation',
        'dependency',
        'association',
      ]);
      expect(data.stereotypes).toEqual(['interface', 'abstract', 'enum']);
      expect(data.visibilities).toEqual(['public', 'private', 'protected']);
      expect(data.edgeStrokeStyles).toEqual(['solid', 'dashed', 'dotted', 'double']);
      expect(data.borderStyles).toEqual(['solid', 'dashed', 'dotted', 'double', 'none']);
      expect(data.textAligns).toEqual(['left', 'center', 'right', 'justify']);
      expect(data.colors).toEqual([
        { hex: '#4A90D9', name: 'Blue' },
        { hex: '#E74C3C', name: 'Red' },
        { hex: '#2ECC71', name: 'Green' },
        { hex: '#F39C12', name: 'Yellow' },
        { hex: '#9B59B6', name: 'Purple' },
        { hex: '#1ABC9C', name: 'Teal' },
        { hex: '#34495E', name: 'Dark Gray' },
        { hex: '#E67E22', name: 'Orange' },
      ]);
    });
  });
});
