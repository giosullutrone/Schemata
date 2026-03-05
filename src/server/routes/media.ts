import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const media = new Hono();

media.get('/images', async (c) => {
  const data = await callStore('getImagePaths', []);
  return c.json({ data });
});

media.get('/pdfs', async (c) => {
  const data = await callStore('getPdfPaths', []);
  return c.json({ data });
});

export { media };
