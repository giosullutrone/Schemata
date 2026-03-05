import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const search = new Hono();

search.get('/', async (c) => {
  const q = c.req.query('q');
  if (!q) return c.json({ error: 'Missing query parameter q' }, 400);
  const typeFilter = c.req.query('type');
  const data = await callStore('search', [q, typeFilter]);
  return c.json({ data });
});

export { search };
