import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const connections = new Hono();

// GET /:id/connections - Get edges + connected nodes for a node
connections.get('/:id/connections', async (c) => {
  const data = await callStore('getConnections', [c.req.param('id')]);
  if (!data) return c.json({ error: 'Node not found' }, 404);
  return c.json({ data });
});

// GET /:id/hierarchy - Get ancestor/descendant chain via inheritance/implementation
// Optional query param: ?direction=ancestors|descendants|both (default: both)
connections.get('/:id/hierarchy', async (c) => {
  const direction = c.req.query('direction') || 'both';
  if (!['ancestors', 'descendants', 'both'].includes(direction)) {
    return c.json({ error: 'direction must be ancestors, descendants, or both' }, 400);
  }
  const data = await callStore('getHierarchy', [c.req.param('id'), direction]);
  if (!data) return c.json({ error: 'Node not found' }, 404);
  return c.json({ data });
});

export { connections };
