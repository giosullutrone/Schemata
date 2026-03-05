import { Hono } from 'hono';
import { canvas } from './routes/canvas.js';
import { nodes } from './routes/nodes.js';
import { edges } from './routes/edges.js';
import { files } from './routes/files.js';

const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/canvas', canvas);
app.route('/canvas/nodes', nodes);
app.route('/canvas/edges', edges);
app.route('/files', files);

export { app };
