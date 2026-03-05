import { Hono } from 'hono';

const schema = new Hono();

schema.get('/', (c) => {
  return c.json({
    data: {
      nodeTypes: ['classNode', 'textNode', 'groupNode'],
      relationshipTypes: ['inheritance', 'implementation', 'composition', 'aggregation', 'dependency', 'association'],
      stereotypes: ['interface', 'abstract', 'enum'],
      visibilities: ['public', 'private', 'protected'],
      edgeStrokeStyles: ['solid', 'dashed', 'dotted', 'double'],
      borderStyles: ['solid', 'dashed', 'dotted', 'double', 'none'],
      textAligns: ['left', 'center', 'right', 'justify'],
    },
  });
});

export { schema };
