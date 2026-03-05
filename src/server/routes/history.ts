import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const history = new Hono();

history.post('/undo', async (c) => {
  await callStore('undo', []);
  return c.json({ data: { success: true } });
});

history.post('/redo', async (c) => {
  await callStore('redo', []);
  return c.json({ data: { success: true } });
});

export { history };
