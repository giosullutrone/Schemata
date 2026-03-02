export type Visibility = 'public' | 'private' | 'protected';

export type Stereotype = 'interface' | 'abstract' | 'enum';

export type RelationshipType =
  | 'inheritance'
  | 'implementation'
  | 'composition'
  | 'aggregation'
  | 'dependency'
  | 'association';

export interface ClassProperty {
  name: string;
  type: string;
  visibility: Visibility;
  comment?: string;
}

export interface MethodParameter {
  name: string;
  type: string;
}

export interface ClassMethod {
  name: string;
  parameters: MethodParameter[];
  returnType: string;
  visibility: Visibility;
  comment?: string;
}

export interface ClassNodeData {
  [key: string]: unknown;
  name: string;
  stereotype?: Stereotype;
  comment?: string;
  color?: string;
  properties: ClassProperty[];
  methods: ClassMethod[];
}

export interface ClassNodeSchema {
  id: string;
  type: 'classNode';
  position: { x: number; y: number };
  data: ClassNodeData;
}

export interface ClassEdgeData {
  [key: string]: unknown;
  label?: string;
  comment?: string;
  color?: string;
}

export interface ClassEdgeSchema {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  data: ClassEdgeData;
}

export interface CanvasData {
  name: string;
  nodes: ClassNodeSchema[];
  edges: ClassEdgeSchema[];
}

export interface CodeCanvasFile {
  version: string;
  name: string;
  canvases: Record<string, CanvasData>;
}
