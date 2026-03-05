import type { RelationshipType } from '../../types/schema';

export interface UmlEdgeConfig {
  strokeDasharray?: string;
  markerPosition: 'start' | 'end';
  markerPath: string;
  markerWidth: number;
  markerHeight: number;
  markerRefX: number;
  markerFilled?: boolean; // false = hollow/open marker (e.g. aggregation)
}

export const EDGE_CONFIG: Record<RelationshipType, UmlEdgeConfig> = {
  inheritance: { markerPosition: 'end', markerPath: 'M 0 0 L 20 10 L 0 20 Z', markerWidth: 8, markerHeight: 8, markerRefX: 20 },
  implementation: { strokeDasharray: '6 3', markerPosition: 'end', markerPath: 'M 0 0 L 20 10 L 0 20 Z', markerWidth: 8, markerHeight: 8, markerRefX: 20 },
  composition: { markerPosition: 'start', markerPath: 'M 10 0 L 20 10 L 10 20 L 0 10 Z', markerWidth: 8, markerHeight: 8, markerRefX: 0, markerFilled: true },
  aggregation: { markerPosition: 'start', markerPath: 'M 10 0 L 20 10 L 10 20 L 0 10 Z', markerWidth: 8, markerHeight: 8, markerRefX: 0, markerFilled: false },
  dependency: { strokeDasharray: '6 3', markerPosition: 'end', markerPath: 'M 0 0 L 20 10 L 0 20 Z', markerWidth: 7, markerHeight: 7, markerRefX: 20 },
  association: { markerPosition: 'end', markerPath: 'M 0 0 L 20 10 L 0 20 Z', markerWidth: 7, markerHeight: 7, markerRefX: 20 },
};
