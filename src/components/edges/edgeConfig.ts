import type { RelationshipType } from '../../types/schema';

export interface UmlEdgeConfig {
  strokeDasharray?: string;
  markerPosition: 'start' | 'end';
  markerPath: string;
  markerWidth: number;
  markerHeight: number;
  markerRefX: number;
  markerFilled?: boolean; // true = filled with edge color, false = hollow (white fill)
  markerOpen?: boolean;   // true = open arrowhead (no fill, stroke only)
}

// Standard UML relationship markers:
// - Inheritance/Implementation: hollow (white-filled) triangle at target
// - Composition: filled diamond at source
// - Aggregation: hollow (white-filled) diamond at source
// - Dependency/Association: open arrowhead (V-shape, no fill) at target
export const EDGE_CONFIG: Record<RelationshipType, UmlEdgeConfig> = {
  inheritance: {
    markerPosition: 'end',
    markerPath: 'M 0 0 L 20 10 L 0 20 Z',
    markerWidth: 12, markerHeight: 12, markerRefX: 20,
    markerFilled: false,
  },
  implementation: {
    strokeDasharray: '8 4',
    markerPosition: 'end',
    markerPath: 'M 0 0 L 20 10 L 0 20 Z',
    markerWidth: 12, markerHeight: 12, markerRefX: 20,
    markerFilled: false,
  },
  composition: {
    markerPosition: 'start',
    markerPath: 'M 10 0 L 20 10 L 10 20 L 0 10 Z',
    markerWidth: 12, markerHeight: 12, markerRefX: 0,
    markerFilled: true,
  },
  aggregation: {
    markerPosition: 'start',
    markerPath: 'M 10 0 L 20 10 L 10 20 L 0 10 Z',
    markerWidth: 12, markerHeight: 12, markerRefX: 0,
    markerFilled: false,
  },
  dependency: {
    strokeDasharray: '8 4',
    markerPosition: 'end',
    markerPath: 'M 0 0 L 20 10 L 0 20',
    markerWidth: 10, markerHeight: 10, markerRefX: 20,
    markerOpen: true,
  },
  association: {
    markerPosition: 'end',
    markerPath: 'M 0 0 L 20 10 L 0 20',
    markerWidth: 10, markerHeight: 10, markerRefX: 20,
    markerOpen: true,
  },
};
