import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const settings = new Hono();

settings.get('/', async (c) => {
  const data = await callStore('getSettings', []);
  return c.json({ data });
});

const ALLOWED_SETTINGS = new Set(['colorMode', 'snapMode', 'sidebarOpen']);

settings.patch('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_SETTINGS.has(key)) filtered[key] = body[key];
  }
  if (Object.keys(filtered).length === 0) return c.json({ error: 'No valid settings provided' }, 400);
  const data = await callStore('updateSettings', [filtered]);
  return c.json({ data });
});

export { settings };
