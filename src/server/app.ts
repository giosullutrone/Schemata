import { Hono } from 'hono';
import { canvas } from './routes/canvas.js';
import { nodes } from './routes/nodes.js';
import { edges } from './routes/edges.js';
import { files } from './routes/files.js';
import { search } from './routes/search.js';
import { history } from './routes/history.js';
import { layout } from './routes/layout.js';
import { media } from './routes/media.js';
import { schema } from './routes/schema.js';
import { folder } from './routes/folder.js';
import { stats } from './routes/stats.js';
import { settings } from './routes/settings.js';
import { connections } from './routes/connections.js';
import { exportRoute } from './routes/export.js';

const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/canvas', canvas);
app.route('/canvas/nodes', connections); // before nodes: /:id/connections and /:id/hierarchy are more specific
app.route('/canvas/nodes', nodes);
app.route('/canvas/edges', edges);
app.route('/canvas/search', search);
app.route('/canvas/layout', layout);
app.route('/canvas/stats', stats);
app.route('/canvas/export', exportRoute);
app.route('/canvas', history);
app.route('/files', files);
app.route('/media', media);
app.route('/schema', schema);
app.route('/folder', folder);
app.route('/settings', settings);

app.onError((err, c) => {
  console.error('[Canvas API]', err);
  const safe = err.message.includes('Bridge') || err.message.includes('Unknown')
    ? err.message
    : 'Internal server error';
  return c.json({ error: safe }, 500);
});

export { app };
