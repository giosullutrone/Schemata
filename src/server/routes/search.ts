import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const search = new Hono();

const VALID_TYPE_FILTERS = new Set(['classNode', 'textNode', 'groupNode']);

search.get('/', async (c) => {
  const q = c.req.query('q');
  if (!q) return c.json({ error: 'Missing query parameter q' }, 400);
  const typeFilter = c.req.query('type');
  if (typeFilter && !VALID_TYPE_FILTERS.has(typeFilter)) {
    return c.json({ error: `type must be one of: ${[...VALID_TYPE_FILTERS].join(', ')}` }, 400);
  }
  const data = await callStore('search', [q, typeFilter]);
  return c.json({ data });
});

export { search };
