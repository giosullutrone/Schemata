import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const files = new Hono();

files.get('/', async (c) => {
  const data = await callStore('getFiles', []);
  return c.json({ data });
});

files.get('/active', async (c) => {
  const data = await callStore('getActiveFile', []);
  if (!data) return c.json({ error: 'No active file' }, 404);
  return c.json({ data });
});

files.put('/active', async (c) => {
  const { path } = await c.req.json<{ path: string }>();
  const data = await callStore('setActiveFile', [path]);
  return c.json({ data });
});

files.post('/', async (c) => {
  const { path, name } = await c.req.json<{ path: string; name: string }>();
  await callStore('createFile', [path, name]);
  return c.json({ data: { success: true } }, 201);
});

files.post('/save', async (c) => {
  await callStore('saveActiveFile', []);
  return c.json({ data: { success: true } });
});

files.post('/save-all', async (c) => {
  await callStore('saveAllFiles', []);
  return c.json({ data: { success: true } });
});

export { files };
