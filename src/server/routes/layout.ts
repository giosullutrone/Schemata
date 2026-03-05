import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const layout = new Hono();

layout.post('/align', async (c) => {
  const { rects, alignment } = await c.req.json<{
    rects: Array<{ id: string; x: number; y: number; w: number; h: number }>;
    alignment: string;
  }>();
  await callStore('alignNodes', [rects, alignment]);
  return c.json({ data: { success: true } });
});

layout.post('/distribute', async (c) => {
  const { rects, axis } = await c.req.json<{
    rects: Array<{ id: string; x: number; y: number; w: number; h: number }>;
    axis: string;
  }>();
  await callStore('distributeNodes', [rects, axis]);
  return c.json({ data: { success: true } });
});

layout.post('/group', async (c) => {
  const { rects } = await c.req.json<{
    rects: Array<{ id: string; x: number; y: number; w: number; h: number }>;
  }>();
  const data = await callStore('groupSelectedNodes', [rects]);
  return c.json({ data }, 201);
});

export { layout };
