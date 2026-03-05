import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const nodes = new Hono();

nodes.get('/', async (c) => {
  const allNodes = (await callStore('getNodes', [])) as Array<{ type: string }>;
  const typeFilter = c.req.query('type');
  const data = typeFilter ? allNodes.filter((n) => n.type === typeFilter) : allNodes;
  return c.json({ data });
});

nodes.post('/', async (c) => {
  const body = await c.req.json<{ type: string; x: number; y: number; [key: string]: unknown }>();
  const { type, x, y, ...rest } = body;

  if (type === 'classNode') {
    const data = await callStore('addClassNode', [x, y]);
    return c.json({ data }, 201);
  }
  if (type === 'textNode') {
    const options = Object.keys(rest).length > 0 ? rest : undefined;
    const data = await callStore('addTextNode', [x, y, options]);
    return c.json({ data }, 201);
  }
  return c.json({ error: `Unknown node type: ${type}` }, 400);
});

nodes.post('/batch', async (c) => {
  const { operations } = await c.req.json<{
    operations: Array<{
      op: string;
      type?: string;
      id?: string;
      x?: number;
      y?: number;
      data?: Record<string, unknown>;
    }>;
  }>();

  const results = [];
  for (const op of operations) {
    if (op.op === 'create') {
      const action = op.type === 'classNode' ? 'addClassNode' : 'addTextNode';
      results.push(await callStore(action, [op.x ?? 0, op.y ?? 0]));
    } else if (op.op === 'update' && op.id) {
      results.push(await callStore('updateNodeData', [op.id, op.data ?? {}]));
    } else if (op.op === 'delete' && op.id) {
      results.push(await callStore('removeNode', [op.id]));
    }
  }
  return c.json({ data: { results } });
});

nodes.get('/:id', async (c) => {
  const data = await callStore('getNode', [c.req.param('id')]);
  if (!data) return c.json({ error: 'Node not found' }, 404);
  return c.json({ data });
});

nodes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();
  const data = await callStore('updateNodeData', [id, body]);
  return c.json({ data });
});

nodes.patch('/:id/position', async (c) => {
  const id = c.req.param('id');
  const { x, y } = await c.req.json<{ x: number; y: number }>();
  const data = await callStore('updateNodePosition', [id, x, y]);
  return c.json({ data });
});

nodes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const data = await callStore('removeNode', [id]);
  return c.json({ data });
});

export { nodes };
