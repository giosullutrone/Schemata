import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const stats = new Hono();

stats.get('/', async (c) => {
  const data = await callStore('getStats', []);
  return c.json({ data });
});

export { stats };
