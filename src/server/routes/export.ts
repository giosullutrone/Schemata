import { Hono } from 'hono';
import { callStore } from '../bridge.js';

const exportRoute = new Hono();

exportRoute.get('/', async (c) => {
  const format = c.req.query('format') || 'json';
  const raw = c.req.query('raw') === 'true';
  if (!['json', 'png', 'svg'].includes(format)) {
    return c.json({ error: `Unsupported format: ${format}. Use json, png, or svg` }, 400);
  }
  const data = await callStore('exportCanvas', [format]);
  if (!data) return c.json({ error: 'No active canvas' }, 404);

  // Raw mode: return binary PNG or raw SVG instead of JSON-wrapped base64
  if (raw && format === 'png' && typeof data === 'string') {
    const b64 = data.includes(',') ? data.split(',')[1] : data;
    const buf = Buffer.from(b64, 'base64');
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(buf.length),
        'Content-Disposition': 'inline; filename="canvas.png"',
      },
    });
  }
  if (raw && format === 'svg' && typeof data === 'string') {
    c.header('Content-Type', 'image/svg+xml');
    return c.body(data);
  }

  return c.json({ data });
});

export { exportRoute };
