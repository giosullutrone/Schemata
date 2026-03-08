import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const edges = new Hono();

edges.get('/', async (c) => {
  const allEdges = (await callStore('getEdges', [])) as Array<{ source: string; target: string }>;
  const sourceFilter = c.req.query('source');
  const targetFilter = c.req.query('target');
  let data = allEdges;
  if (sourceFilter) data = data.filter((e) => e.source === sourceFilter);
  if (targetFilter) data = data.filter((e) => e.target === targetFilter);
  const typeFilter = c.req.query('relationshipType');
  if (typeFilter) data = data.filter((e) => (e as { data?: { relationshipType?: string } }).data?.relationshipType === typeFilter);
  return c.json({ data });
});

edges.get('/:id', async (c) => {
  const data = await callStore('getEdge', [c.req.param('id')]);
  if (!data) return c.json({ error: 'Edge not found' }, 404);
  return c.json({ data });
});

const VALID_RELATIONSHIP_TYPES = new Set(['inheritance', 'implementation', 'composition', 'aggregation', 'dependency', 'association']);

edges.post('/', async (c) => {
  const { source, target, relationshipType, sourceHandle, targetHandle, ...styleFields } =
    await c.req.json<{ source: string; target: string; relationshipType: string; sourceHandle?: string; targetHandle?: string; label?: string; color?: string; strokeStyle?: string; labelWidth?: number; labelHeight?: number }>();
  if (!source || !target || !relationshipType) return c.json({ error: 'source, target, and relationshipType are required' }, 400);
  if (!VALID_RELATIONSHIP_TYPES.has(relationshipType)) return c.json({ error: `Invalid relationshipType. Must be one of: ${[...VALID_RELATIONSHIP_TYPES].join(', ')}` }, 400);
  // Validate that source and target nodes exist
  const [sourceNode, targetNode] = await Promise.all([
    callStore('getNode', [source]),
    callStore('getNode', [target]),
  ]);
  if (!sourceNode) return c.json({ error: `Source node '${source}' not found` }, 400);
  if (!targetNode) return c.json({ error: `Target node '${target}' not found` }, 400);
  const data = await callStore('addEdge', [source, target, relationshipType, sourceHandle, targetHandle]);
  // Apply optional style fields (label, color, strokeStyle, etc.) if provided
  const { label, color, strokeStyle, labelWidth, labelHeight } = styleFields;
  if (data && (label !== undefined || color !== undefined || strokeStyle !== undefined || labelWidth !== undefined || labelHeight !== undefined)) {
    const patch: Record<string, unknown> = {};
    if (label !== undefined) patch.label = label;
    if (color !== undefined) patch.color = color;
    if (strokeStyle !== undefined) patch.strokeStyle = strokeStyle;
    if (labelWidth !== undefined) patch.labelWidth = labelWidth;
    if (labelHeight !== undefined) patch.labelHeight = labelHeight;
    const updated = await callStore('updateEdgeData', [(data as { id: string }).id, patch]);
    return c.json({ data: updated }, 201);
  }
  return c.json({ data }, 201);
});

edges.post('/batch', async (c) => {
  const { edges: edgeDefs } = await c.req.json<{
    edges: Array<{
      source: string; target: string; relationshipType: string;
      sourceHandle?: string; targetHandle?: string;
      label?: string; color?: string; strokeStyle?: string;
      labelWidth?: number; labelHeight?: number;
    }>;
  }>();
  if (!Array.isArray(edgeDefs) || edgeDefs.length === 0 || edgeDefs.length > 100) {
    return c.json({ error: 'edges array required (1-100 items)' }, 400);
  }
  // Validate all entries
  for (const e of edgeDefs) {
    if (!e.source || !e.target || !e.relationshipType) {
      return c.json({ error: 'Each edge must have source, target, and relationshipType' }, 400);
    }
    if (!VALID_RELATIONSHIP_TYPES.has(e.relationshipType)) {
      return c.json({ error: `Invalid relationshipType '${e.relationshipType}'. Must be one of: ${[...VALID_RELATIONSHIP_TYPES].join(', ')}` }, 400);
    }
  }
  // Validate all referenced nodes exist
  const allNodes = (await callStore('getNodes', [])) as Array<{ id: string }>;
  const nodeIds = new Set(allNodes.map(n => n.id));
  for (const e of edgeDefs) {
    if (!nodeIds.has(e.source)) return c.json({ error: `Source node '${e.source}' not found` }, 400);
    if (!nodeIds.has(e.target)) return c.json({ error: `Target node '${e.target}' not found` }, 400);
  }
  const data = await callStore('addEdgesBatch', [edgeDefs]);
  return c.json({ data }, 201);
});

edges.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();
  const data = await callStore('updateEdgeData', [id, body]);
  return c.json({ data });
});

edges.patch('/:id/type', async (c) => {
  const id = c.req.param('id');
  const { type } = await c.req.json<{ type: string }>();
  const data = await callStore('updateEdgeType', [id, type]);
  return c.json({ data });
});

edges.delete('/batch', async (c) => {
  const { ids } = await c.req.json<{ ids: string[] }>();
  if (!ids || !Array.isArray(ids)) return c.json({ error: 'Missing ids array' }, 400);
  if (ids.length > 100) return c.json({ error: 'Max 100 ids per batch' }, 400);
  const data = await callStore('removeEdges', [ids]);
  return c.json({ data });
});

edges.delete('/:id', async (c) => {
  const data = await callStore('removeEdge', [c.req.param('id')]);
  return c.json({ data });
});

export { edges };
