import { Hono } from 'hono';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { callStore } from '../bridge.js';
import { getFolderPath } from '../serverState.js';
import type { SchemataFile } from '../../types/schema.js';

const files = new Hono();

function isSafePath(filePath: string): boolean {
  return !filePath.includes('..') && !filePath.startsWith('/');
}

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
  if (!path || typeof path !== 'string') return c.json({ error: 'Missing path' }, 400);
  if (!isSafePath(path)) return c.json({ error: 'Invalid path' }, 400);
  const data = await callStore('setActiveFile', [path]);
  return c.json({ data });
});

files.post('/', async (c) => {
  const { path: filePath, name } = await c.req.json<{ path: string; name: string }>();
  if (!name || typeof name !== 'string') return c.json({ error: 'Missing name' }, 400);
  if (filePath && !isSafePath(filePath)) return c.json({ error: 'Invalid path' }, 400);

  const rootPath = getFolderPath();
  if (rootPath) {
    // Server-side file creation using Node.js fs
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const fileName = `${sanitized || 'untitled'}.schemata.json`;
    const relativePath = filePath ? `${filePath}/${fileName}` : fileName;
    const absolutePath = path.join(rootPath, relativePath);

    const newFile: SchemataFile = {
      version: '1.0',
      name,
      nodes: [],
      edges: [],
    };

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, JSON.stringify(newFile, null, 2), 'utf-8');

    // Reload the folder to pick up the new file
    const { scanFolderFs } = await import('../fsScanner.js');
    const scan = await scanFolderFs(rootPath);
    const allFiles: Record<string, SchemataFile> = {};
    for (const f of scan.files) {
      allFiles[f.relativePath] = f.file;
    }
    await callStore('loadFolder', [path.basename(rootPath), allFiles, scan.imagePaths, scan.pdfPaths]);
    await callStore('setActiveFile', [relativePath]);

    return c.json({ data: { success: true, path: relativePath } }, 201);
  }

  // Fallback: browser-side file creation (requires File System Access API)
  await callStore('createFile', [filePath, name]);
  return c.json({ data: { success: true } }, 201);
});

files.post('/save', async (c) => {
  const rootPath = getFolderPath();
  if (rootPath) {
    // Server-side save using Node.js fs
    const activeFile = await callStore('getActiveFile', []) as { path: string } | null;
    if (!activeFile) return c.json({ error: 'No active file' }, 404);

    const canvas = await callStore('getCanvas', []) as { nodes: unknown[]; edges: unknown[]; viewport?: unknown } | null;
    if (!canvas) return c.json({ error: 'No canvas data' }, 404);

    // Get the full file data including name/version
    const allFiles = await callStore('getFiles', []) as Array<{ path: string; name: string }>;
    const fileInfo = allFiles.find(f => f.path === activeFile.path);

    const fileData: SchemataFile = {
      version: '1.0',
      name: fileInfo?.name ?? 'Untitled',
      nodes: canvas.nodes as SchemataFile['nodes'],
      edges: canvas.edges as SchemataFile['edges'],
      ...(canvas.viewport ? { viewport: canvas.viewport as SchemataFile['viewport'] } : {}),
    };

    const absolutePath = path.join(rootPath, activeFile.path);
    await fs.writeFile(absolutePath, JSON.stringify(fileData, null, 2), 'utf-8');
    return c.json({ data: { success: true } });
  }

  // Fallback: browser-side save
  await callStore('saveActiveFile', []);
  return c.json({ data: { success: true } });
});

files.post('/save-all', async (c) => {
  const rootPath = getFolderPath();
  if (rootPath) {
    // Server-side save-all using Node.js fs
    const allFiles = await callStore('getFiles', []) as Array<{ path: string; name: string }>;
    const savedPaths: string[] = [];

    for (const fileInfo of allFiles) {
      // Switch to each file and get its canvas data
      await callStore('setActiveFile', [fileInfo.path]);
      const canvas = await callStore('getCanvas', []) as { nodes: unknown[]; edges: unknown[]; viewport?: unknown } | null;
      if (!canvas) continue;

      const fileData: SchemataFile = {
        version: '1.0',
        name: fileInfo.name,
        nodes: canvas.nodes as SchemataFile['nodes'],
        edges: canvas.edges as SchemataFile['edges'],
        ...(canvas.viewport ? { viewport: canvas.viewport as SchemataFile['viewport'] } : {}),
      };

      const absolutePath = path.join(rootPath, fileInfo.path);
      await fs.writeFile(absolutePath, JSON.stringify(fileData, null, 2), 'utf-8');
      savedPaths.push(fileInfo.path);
    }

    return c.json({ data: { success: true, saved: savedPaths.length } });
  }

  // Fallback: browser-side save
  await callStore('saveAllFiles', []);
  return c.json({ data: { success: true } });
});

files.delete('/:path{.+}', async (c) => {
  const filePath = c.req.param('path');
  if (!isSafePath(filePath)) return c.json({ error: 'Invalid path' }, 400);

  const rootPath = getFolderPath();
  if (rootPath) {
    const absolutePath = path.join(rootPath, filePath);
    try {
      await fs.unlink(absolutePath);
    } catch {
      // File may not exist on disk — continue to remove from store
    }
  }

  await callStore('removeFile', [filePath]);
  return c.json({ data: { success: true } });
});

files.patch('/:path{.+}/rename', async (c) => {
  const filePath = c.req.param('path');
  if (!isSafePath(filePath)) return c.json({ error: 'Invalid path' }, 400);
  const { name } = await c.req.json<{ name: string }>();
  if (!name || typeof name !== 'string') return c.json({ error: 'Missing name' }, 400);
  // Switch to the file first, then rename it
  await callStore('setActiveFile', [filePath]);
  await callStore('renameFile', [name]);
  return c.json({ data: { success: true } });
});

files.post('/refresh', async (c) => {
  const data = await callStore('refreshFolder', []);
  return c.json({ data });
});

export { files };
