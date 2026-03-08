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
  if (typeof body.x !== 'number' || typeof body.y !== 'number' || typeof body.zoom !== 'number') {
    return c.json({ error: 'x, y, and zoom must be numbers' }, 400);
  }
  await callStore('saveViewport', [body]);
  return c.json({ data: body });
});

canvas.post('/clear', async (c) => {
  await callStore('clearCanvas', []);
  return c.json({ data: { success: true } });
});

canvas.post('/viewport/fit', async (c) => {
  const body = await c.req.json<{ padding?: number }>().catch(() => ({}));
  const data = await callStore('fitViewport', [(body as { padding?: number }).padding]);
  if (!data) return c.json({ error: 'No nodes on canvas' }, 404);
  return c.json({ data });
});

export { canvas };
