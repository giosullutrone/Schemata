import { Hono } from 'hono';
import { callStore } from '../bridge.js';
import { findOverlappingNodes, type OverlapNode } from '../../utils/overlapDetection.js';

const nodes = new Hono();

nodes.get('/', async (c) => {
  const allNodes = (await callStore('getNodes', [])) as Array<{ type: string }>;
  const typeFilter = c.req.query('type');
  const data = typeFilter ? allNodes.filter((n) => n.type === typeFilter) : allNodes;
  return c.json({ data });
});

const VALID_NODE_TYPES = new Set(['classNode', 'textNode']);

nodes.post('/', async (c) => {
  const body = await c.req.json<{ type: string; x: number; y: number; [key: string]: unknown }>();
  const { type, x, y, ...rest } = body;
  if (!type || !VALID_NODE_TYPES.has(type)) return c.json({ error: `type must be one of: ${[...VALID_NODE_TYPES].join(', ')}` }, 400);
  if (typeof x !== 'number' || typeof y !== 'number') return c.json({ error: 'x and y must be numbers' }, 400);

  if (type === 'classNode') {
    const data = await callStore('addClassNode', [x, y]);
    // If extra fields provided (name, properties, methods, stereotype, color), apply them
    const { name, properties, methods, stereotype, color } = rest as Record<string, unknown>;
    if (data && (name || properties || methods || stereotype || color)) {
      const nodeId = (data as { id: string }).id;
      const patch: Record<string, unknown> = {};
      if (name !== undefined) patch.name = name;
      if (properties !== undefined) patch.properties = properties;
      if (methods !== undefined) patch.methods = methods;
      if (stereotype !== undefined) patch.stereotype = stereotype;
      if (color !== undefined) patch.color = color;
      const updated = await callStore('updateNodeData', [nodeId, patch]);
      return c.json({ data: updated }, 201);
    }
    return c.json({ data }, 201);
  }
  if (type === 'textNode') {
    const options = Object.keys(rest).length > 0 ? rest : undefined;
    const data = await callStore('addTextNode', [x, y, options]);
    return c.json({ data }, 201);
  }
  // Validated above — unreachable
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

  if (!Array.isArray(operations) || operations.length === 0 || operations.length > 100) {
    return c.json({ error: 'operations array required (1-100 items)' }, 400);
  }
  const results = [];
  for (const op of operations) {
    if (op.op === 'create') {
      const action = op.type === 'classNode' ? 'addClassNode' : 'addTextNode';
      const node = await callStore(action, [op.x ?? 0, op.y ?? 0]);
      // Apply data fields inline if provided
      if (node && op.data && Object.keys(op.data).length > 0) {
        const updated = await callStore('updateNodeData', [(node as { id: string }).id, op.data]);
        results.push(updated);
      } else {
        results.push(node);
      }
    } else if (op.op === 'update' && op.id) {
      results.push(await callStore('updateNodeData', [op.id, op.data ?? {}]));
    } else if (op.op === 'delete' && op.id) {
      results.push(await callStore('removeNode', [op.id]));
    }
  }
  return c.json({ data: { results } });
});

nodes.patch('/positions', async (c) => {
  const { positions } = await c.req.json<{
    positions: Array<{ id: string; x: number; y: number }>;
  }>();
  if (!Array.isArray(positions) || positions.length === 0 || positions.length > 200) {
    return c.json({ error: 'positions array required (1-200 items)' }, 400);
  }
  for (const p of positions) {
    if (!p.id || typeof p.x !== 'number' || typeof p.y !== 'number') {
      return c.json({ error: 'Each position must have id (string), x (number), y (number)' }, 400);
    }
  }
  const data = await callStore('updateNodePositions', [positions]);
  return c.json({ data });
});

nodes.delete('/batch', async (c) => {
  const { ids } = await c.req.json<{ ids: string[] }>();
  if (!ids || !Array.isArray(ids)) return c.json({ error: 'Missing ids array' }, 400);
  if (ids.length > 100) return c.json({ error: 'Max 100 ids per batch' }, 400);
  const data = await callStore('removeNodes', [ids]);
  return c.json({ data });
});

nodes.post('/duplicate', async (c) => {
  const { ids, offsetX, offsetY } = await c.req.json<{ ids: string[]; offsetX?: number; offsetY?: number }>();
  if (!ids || !Array.isArray(ids)) return c.json({ error: 'Missing ids array' }, 400);
  const data = await callStore('duplicateNodes', [ids, offsetX ?? 30, offsetY ?? 30]);
  return c.json({ data }, 201);
});

nodes.get('/orphans', async (c) => {
  const data = await callStore('getOrphans', []);
  return c.json({ data });
});

nodes.get('/groups/:id/children', async (c) => {
  const data = await callStore('getGroupChildren', [c.req.param('id')]);
  if (!data) return c.json({ error: 'Group not found' }, 404);
  return c.json({ data });
});

nodes.patch('/groups/:id/fit', async (c) => {
  const groupId = c.req.param('id');
  const { nodeIds, padding } = await c.req.json<{ nodeIds: string[]; padding?: number }>();
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) return c.json({ error: 'nodeIds array required' }, 400);
  if (padding !== undefined && typeof padding !== 'number') return c.json({ error: 'padding must be a number' }, 400);
  const data = await callStore('fitGroupToNodes', [groupId, nodeIds, padding ?? 20]);
  if (!data) return c.json({ error: 'Group not found' }, 404);
  return c.json({ data });
});

nodes.get('/:id/distance/:otherId', async (c) => {
  const data = await callStore('getNodeDistance', [c.req.param('id'), c.req.param('otherId')]);
  if (!data) return c.json({ error: 'One or both nodes not found' }, 404);
  return c.json({ data });
});

nodes.get('/overlaps', async (c) => {
  const DEFAULT_W = 200;
  const DEFAULT_H = 150;
  const allNodes = (await callStore('getNodes', [])) as Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    measured?: { width?: number; height?: number };
    style?: { width?: number; height?: number };
    parentId?: string;
  }>;
  const overlapNodes: OverlapNode[] = allNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    width: n.measured?.width ?? n.style?.width ?? DEFAULT_W,
    height: n.measured?.height ?? n.style?.height ?? DEFAULT_H,
    parentId: n.parentId,
  }));
  const data = findOverlappingNodes(overlapNodes);
  return c.json({ data });
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
  if (typeof x !== 'number' || typeof y !== 'number') return c.json({ error: 'x and y must be numbers' }, 400);
  const data = await callStore('updateNodePosition', [id, x, y]);
  return c.json({ data });
});

nodes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const node = await callStore('getNode', [id]);
  if (!node) return c.json({ error: 'Node not found' }, 404);
  await callStore('removeNode', [id]);
  return c.json({ data: node });
});

export { nodes };
