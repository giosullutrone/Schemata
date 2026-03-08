import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage } from 'node:http';
import { app } from './app.js';
import { initBridge } from './bridge.js';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
  });
}

export default function canvasApiPlugin(): Plugin {
  return {
    name: 'canvas-api',
    configureServer(server: ViteDevServer) {
      initBridge(server.ws);

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) return next();

        const url = `http://localhost${req.url}`;
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value) headers.set(key, Array.isArray(value) ? value[0] : value);
        }

        let body: string | undefined;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          body = await readBody(req);
        }

        const fetchReq = new Request(url, { method: req.method, headers, body });
        const fetchRes = await app.fetch(fetchReq);

        res.statusCode = fetchRes.status;
        fetchRes.headers.forEach((v, k) => res.setHeader(k, v));

        const contentType = fetchRes.headers.get('content-type') || '';
        if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
          res.end(Buffer.from(await fetchRes.arrayBuffer()));
        } else {
          res.end(await fetchRes.text());
        }
      });
    },
  };
}
