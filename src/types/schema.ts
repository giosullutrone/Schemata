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

export interface AnnotationNodeData {
  [key: string]: unknown;
  comment: string;
  parentId: string;
  parentType: 'node' | 'edge';
  color?: string;
}

export interface AnnotationNodeSchema {
  id: string;
  type: 'annotationNode';
  position: { x: number; y: number };
  data: AnnotationNodeData;
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

export type CanvasNodeSchema = ClassNodeSchema | AnnotationNodeSchema | GroupNodeSchema;

export interface ClassEdgeData {
  [key: string]: unknown;
  relationshipType: RelationshipType;
  label?: string;
  color?: string;
  labelWidth?: number;
  labelHeight?: number;
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

export interface CodeCanvasFile {
  version: string;
  name: string;
  nodes: CanvasNodeSchema[];
  edges: ClassEdgeSchema[];
  viewport?: { x: number; y: number; zoom: number };
}
