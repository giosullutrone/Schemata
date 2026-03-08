import type { SchemataFile } from '../types/schema';

export function serializeFile(file: SchemataFile): string {
  return JSON.stringify(file, null, 2);
}

export function deserializeFile(json: string): SchemataFile {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = JSON.parse(json);
  // Migrate old multi-canvas format to flat single-canvas format
  if (raw.canvases && typeof raw.canvases === 'object' && !Array.isArray(raw.nodes)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstCanvas = Object.values(raw.canvases)[0] as any;
    return {
      version: raw.version ?? '1.0',
      name: raw.name ?? 'Untitled',
      nodes: firstCanvas?.nodes ?? [],
      edges: firstCanvas?.edges ?? [],
      viewport: firstCanvas?.viewport,
    };
  }
  return raw as SchemataFile;
}

const VALID_NODE_TYPES = new Set(['classNode', 'textNode', 'groupNode']);
const VALID_EDGE_TYPE = 'uml';

export function validateFile(file: SchemataFile): string[] {
  const errors: string[] = [];

  if (!file.version) {
    errors.push('Missing "version" field');
  }
  if (!file.name) {
    errors.push('Missing "name" field');
  }
  if (!Array.isArray(file.nodes)) {
    errors.push('Missing "nodes" array');
  } else {
    for (let i = 0; i < file.nodes.length; i++) {
      const node = file.nodes[i];
      if (!node || typeof node !== 'object') {
        errors.push(`nodes[${i}]: not an object`);
        continue;
      }
      if (!node.id) errors.push(`nodes[${i}]: missing "id"`);
      if (!VALID_NODE_TYPES.has(node.type)) errors.push(`nodes[${i}]: invalid type "${node.type}"`);
      if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        errors.push(`nodes[${i}]: missing or invalid "position"`);
      }
    }
  }
  if (!Array.isArray(file.edges)) {
    errors.push('Missing "edges" array');
  } else {
    for (let i = 0; i < file.edges.length; i++) {
      const edge = file.edges[i];
      if (!edge || typeof edge !== 'object') {
        errors.push(`edges[${i}]: not an object`);
        continue;
      }
      if (!edge.id) errors.push(`edges[${i}]: missing "id"`);
      if (!edge.source) errors.push(`edges[${i}]: missing "source"`);
      if (!edge.target) errors.push(`edges[${i}]: missing "target"`);
      if (edge.type !== VALID_EDGE_TYPE) errors.push(`edges[${i}]: invalid type "${edge.type}"`);
    }
  }

  return errors;
}

export async function writeToHandle(handle: FileSystemFileHandle, file: SchemataFile): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(serializeFile(file));
    await writable.close();
  } catch (err) {
    await writable.abort();
    throw err;
  }
}

export interface ScannedFile {
  relativePath: string;
  file: SchemataFile;
  handle: FileSystemFileHandle;
}

export async function openFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window)) return null;
  try {
    return await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return null;
    throw err;
  }
}

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.svn', '.hg', '__pycache__', '.next', 'dist', 'build']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']);
const PDF_EXTENSIONS = new Set(['.pdf']);

export interface ScanResult {
  files: ScannedFile[];
  imagePaths: string[];
  pdfPaths: string[];
  warnings: string[];
}

export async function scanFolder(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string = '',
): Promise<ScanResult> {
  const files: ScannedFile[] = [];
  const imagePaths: string[] = [];
  const pdfPaths: string[] = [];
  const warnings: string[] = [];
  for await (const entry of dirHandle.values()) {
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const sub = await scanFolder(entry as FileSystemDirectoryHandle, entryPath);
      files.push(...sub.files);
      imagePaths.push(...sub.imagePaths);
      pdfPaths.push(...sub.pdfPaths);
      warnings.push(...sub.warnings);
    } else if (entry.kind === 'file') {
      if (entry.name.endsWith('.schemata.json')) {
        const fileHandle = entry as FileSystemFileHandle;
        try {
          const fileObj = await fileHandle.getFile();
          const text = await fileObj.text();
          const parsed = deserializeFile(text);
          const errors = validateFile(parsed);
          if (errors.length === 0) {
            files.push({ relativePath: entryPath, file: parsed, handle: fileHandle });
          } else {
            warnings.push(`${entryPath}: ${errors[0]}`);
          }
        } catch (err) {
          warnings.push(`${entryPath}: ${(err as Error).message ?? 'parse error'}`);
        }
      } else {
        const dot = entry.name.lastIndexOf('.');
        const ext = dot >= 0 ? entry.name.substring(dot).toLowerCase() : '';
        if (IMAGE_EXTENSIONS.has(ext)) {
          imagePaths.push(entryPath);
        } else if (PDF_EXTENSIONS.has(ext)) {
          pdfPaths.push(entryPath);
        }
      }
    }
  }
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  imagePaths.sort();
  pdfPaths.sort();
  return { files, imagePaths, pdfPaths, warnings };
}

export async function createFileInFolder(
  rootDirHandle: FileSystemDirectoryHandle,
  subPath: string,
  fileName: string,
  file: SchemataFile,
): Promise<ScannedFile | null> {
  let targetDir = rootDirHandle;
  if (subPath) {
    const parts = subPath.split('/');
    for (const part of parts) {
      targetDir = await targetDir.getDirectoryHandle(part);
    }
  }
  // Prevent overwriting existing files — append numeric suffix if needed
  let finalName = fileName;
  const baseName = fileName.replace('.schemata.json', '');
  let attempt = 0;
  while (attempt < 100) {
    try {
      await targetDir.getFileHandle(finalName, { create: false });
      attempt++;
      finalName = `${baseName}-${attempt}.schemata.json`;
    } catch {
      break; // File doesn't exist, safe to use
    }
  }
  const handle = await targetDir.getFileHandle(finalName, { create: true });
  await writeToHandle(handle, file);
  const relativePath = subPath ? `${subPath}/${finalName}` : finalName;
  return { relativePath, file, handle };
}
