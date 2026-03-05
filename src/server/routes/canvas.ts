import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const canvas = new Hono();

canvas.get('/', async (c) => {
  const data = await callStore('getCanvas', []);
  if (!data) return c.json({ error: 'No active canvas' }, 404);
  return c.json({ data });
});

canvas.get('/viewport', async (c) => {
  const data = await callStore('getViewport', []);
  return c.json({ data });
});

canvas.put('/viewport', async (c) => {
  const body = await c.req.json<{ x: number; y: number; zoom: number }>();
  await callStore('saveViewport', [body]);
  return c.json({ data: body });
});

export { canvas };
