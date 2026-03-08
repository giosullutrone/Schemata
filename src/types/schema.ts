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
  id: string;
  name: string;
  type: string;
  visibility: Visibility;
}

export interface MethodParameter {
  name: string;
  type: string;
}

export interface ClassMethod {
  id: string;
  name: string;
  parameters: MethodParameter[];
  returnType: string;
  visibility: Visibility;
}

export interface ClassNodeData {
  [key: string]: unknown;
  name: string;
  stereotype?: Stereotype;
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

export interface TextNodeData {
  [key: string]: unknown;
  text: string;
  color?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  opacity?: number;
}

export interface TextNodeSchema {
  id: string;
  type: 'textNode';
  position: { x: number; y: number };
  data: TextNodeData;
}

export interface GroupNodeData {
  [key: string]: unknown;
  label: string;
  color?: string;
}

export interface GroupNodeSchema {
  id: string;
  type: 'groupNode';
  position: { x: number; y: number };
  data: GroupNodeData;
  style?: { width: number; height: number };
}

export type CanvasNodeSchema = ClassNodeSchema | TextNodeSchema | GroupNodeSchema;

export interface ClassEdgeData {
  [key: string]: unknown;
  relationshipType: RelationshipType;
  label?: string;
  color?: string;
  labelWidth?: number;
  labelHeight?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
}

export interface ClassEdgeSchema {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: 'uml';
  data: ClassEdgeData;
}

export interface SchemataFile {
  version: string;
  name: string;
  nodes: CanvasNodeSchema[];
  edges: ClassEdgeSchema[];
  viewport?: { x: number; y: number; zoom: number };
}
