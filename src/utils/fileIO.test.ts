import { describe, it, expect } from 'vitest';
import { serializeFile, deserializeFile, validateFile } from './fileIO';
import type { CodeCanvasFile } from '../types/schema';

const validFile: CodeCanvasFile = {
  version: '1.0',
  name: 'Test',
  canvases: {
    main: {
      name: 'Main',
      nodes: [
        {
          id: 'class-1',
          type: 'classNode',
          position: { x: 0, y: 0 },
          data: { name: 'Foo', properties: [], methods: [] },
        },
      ],
      edges: [],
    },
  },
};

describe('fileIO', () => {
  it('should serialize a file to JSON string', () => {
    const json = serializeFile(validFile);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('1.0');
    expect(parsed.canvases.main.nodes).toHaveLength(1);
  });

  it('should serialize with 2-space indentation', () => {
    const json = serializeFile(validFile);
    expect(json).toContain('  "version"');
  });

  it('should deserialize a valid JSON string', () => {
    const json = JSON.stringify(validFile);
    const result = deserializeFile(json);
    expect(result.name).toBe('Test');
    expect(result.canvases.main.nodes[0].data.name).toBe('Foo');
  });

  it('should throw on invalid JSON', () => {
    expect(() => deserializeFile('not json')).toThrow();
  });

  it('should validate a correct file', () => {
    const errors = validateFile(validFile);
    expect(errors).toEqual([]);
  });

  it('should reject a file without version', () => {
    const bad = { ...validFile, version: undefined } as unknown as CodeCanvasFile;
    const errors = validateFile(bad);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject a file without canvases', () => {
    const bad = { version: '1.0', name: 'X' } as unknown as CodeCanvasFile;
    const errors = validateFile(bad);
    expect(errors.length).toBeGreaterThan(0);
  });
});
