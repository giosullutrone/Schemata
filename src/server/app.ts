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

const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/canvas', canvas);
app.route('/canvas/nodes', nodes);
app.route('/canvas/edges', edges);
app.route('/canvas/search', search);
app.route('/canvas/layout', layout);
app.route('/canvas', history);
app.route('/files', files);
app.route('/media', media);
app.route('/schema', schema);
app.route('/folder', folder);

app.onError((err, c) => {
  console.error('[Canvas API]', err);
  return c.json({ error: err.message }, 500);
});

export { app };
