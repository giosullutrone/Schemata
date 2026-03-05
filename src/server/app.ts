import { Hono } from 'hono';
import { canvas } from './routes/canvas.js';
import { nodes } from './routes/nodes.js';

const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/canvas', canvas);
app.route('/canvas/nodes', nodes);

export { app };
