import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const VALID_ALIGNMENTS = new Set(['left', 'center', 'right', 'top', 'middle', 'bottom']);
const VALID_AXES = new Set(['horizontal', 'vertical']);

const layout = new Hono();

layout.post('/align', async (c) => {
  const { rects, alignment } = await c.req.json<{
    rects: Array<{ id: string; x: number; y: number; w: number; h: number }>;
    alignment: string;
  }>();
  if (!Array.isArray(rects) || rects.length < 2) return c.json({ error: 'rects array with at least 2 items required' }, 400);
  if (!VALID_ALIGNMENTS.has(alignment)) return c.json({ error: `alignment must be one of: ${[...VALID_ALIGNMENTS].join(', ')}` }, 400);
  await callStore('alignNodes', [rects, alignment]);
  return c.json({ data: { success: true } });
});

layout.post('/distribute', async (c) => {
  const { rects, axis } = await c.req.json<{
    rects: Array<{ id: string; x: number; y: number; w: number; h: number }>;
    axis: string;
  }>();
  if (!Array.isArray(rects) || rects.length < 3) return c.json({ error: 'rects array with at least 3 items required' }, 400);
  if (!VALID_AXES.has(axis)) return c.json({ error: 'axis must be horizontal or vertical' }, 400);
  await callStore('distributeNodes', [rects, axis]);
  return c.json({ data: { success: true } });
});

layout.post('/group', async (c) => {
  const { rects } = await c.req.json<{
    rects: Array<{ id: string; x: number; y: number; w: number; h: number }>;
  }>();
  if (!Array.isArray(rects) || rects.length < 1) return c.json({ error: 'rects array required' }, 400);
  const data = await callStore('groupSelectedNodes', [rects]);
  return c.json({ data }, 201);
});

const VALID_STRATEGIES = new Set(['grid', 'hierarchical']);

layout.post('/auto', async (c) => {
  const body = await c.req.json<{ strategy?: string; gap?: number }>().catch(() => ({}));
  const strategy = (body as { strategy?: string }).strategy ?? 'grid';
  const gap = (body as { gap?: number }).gap;
  if (!VALID_STRATEGIES.has(strategy)) {
    return c.json({ error: `strategy must be one of: ${[...VALID_STRATEGIES].join(', ')}` }, 400);
  }
  await callStore('autoLayout', [strategy, gap]);
  await callStore('recalculateEdgeHandles', []);
  return c.json({ data: { success: true } });
});

export { layout };
