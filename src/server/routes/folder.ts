import { Hono } from 'hono';
import * as path from 'node:path';
import { callStore } from '../bridge.js';
import { scanFolderFs } from '../fsScanner.js';
import { setFolderPath } from '../serverState.js';
import type { SchemataFile } from '../../types/schema.js';

const folder = new Hono();

folder.get('/', async (c) => {
  const data = await callStore('getFolderInfo', []);
  return c.json({ data });
});

folder.post('/open', async (c) => {
  const { path: folderPath } = await c.req.json<{ path: string }>();
  if (!folderPath || typeof folderPath !== 'string') return c.json({ error: 'Missing path' }, 400);
  if (!path.isAbsolute(folderPath)) return c.json({ error: 'Path must be absolute' }, 400);

  const folderName = path.basename(folderPath);
  const scan = await scanFolderFs(folderPath);

  const files: Record<string, SchemataFile> = {};
  for (const f of scan.files) {
    files[f.relativePath] = f.file;
  }

  await callStore('loadFolder', [folderName, files, scan.imagePaths, scan.pdfPaths]);
  setFolderPath(folderPath);

  return c.json({
    data: {
      name: folderName,
      fileCount: scan.files.length,
      imageCount: scan.imagePaths.length,
      pdfCount: scan.pdfPaths.length,
      warnings: scan.warnings,
    },
  });
});

export { folder };
