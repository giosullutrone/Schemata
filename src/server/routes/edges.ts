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
  return c.json({ data });
});

edges.get('/:id', async (c) => {
  const data = await callStore('getEdge', [c.req.param('id')]);
  if (!data) return c.json({ error: 'Edge not found' }, 404);
  return c.json({ data });
});

edges.post('/', async (c) => {
  const { source, target, relationshipType, sourceHandle, targetHandle } =
    await c.req.json<{ source: string; target: string; relationshipType: string; sourceHandle?: string; targetHandle?: string }>();
  const data = await callStore('addEdge', [source, target, relationshipType, sourceHandle, targetHandle]);
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

edges.delete('/:id', async (c) => {
  const data = await callStore('removeEdge', [c.req.param('id')]);
  return c.json({ data });
});

export { edges };
