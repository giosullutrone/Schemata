import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CodeCanvasFile } from '../types/schema.js';

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.svn', '.hg', '__pycache__', '.next', 'dist', 'build']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico']);

export interface FsScanResult {
  files: Array<{ relativePath: string; file: CodeCanvasFile }>;
  imagePaths: string[];
  pdfPaths: string[];
  warnings: string[];
}

export async function scanFolderFs(rootPath: string, basePath = ''): Promise<FsScanResult> {
  const result: FsScanResult = { files: [], imagePaths: [], pdfPaths: [], warnings: [] };
  const dirPath = basePath ? path.join(rootPath, basePath) : rootPath;

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      const sub = await scanFolderFs(rootPath, relativePath);
      result.files.push(...sub.files);
      result.imagePaths.push(...sub.imagePaths);
      result.pdfPaths.push(...sub.pdfPaths);
      result.warnings.push(...sub.warnings);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();

      if (entry.name.endsWith('.codecanvas.json')) {
        try {
          const content = await fs.readFile(path.join(dirPath, entry.name), 'utf-8');
          const file = JSON.parse(content) as CodeCanvasFile;
          result.files.push({ relativePath, file });
        } catch (err) {
          result.warnings.push(`Failed to parse ${relativePath}: ${err}`);
        }
      } else if (IMAGE_EXTS.has(ext)) {
        result.imagePaths.push(relativePath);
      } else if (ext === '.pdf') {
        result.pdfPaths.push(relativePath);
      }
    }
  }

  result.files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return result;
}
