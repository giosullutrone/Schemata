/**
 * Server-side state for folder path tracking.
 * When a folder is opened via POST /api/folder/open, the path is stored here
 * so that server-side save/create operations can write to disk using Node.js fs.
 */
let folderPath: string | null = null;

export function setFolderPath(path: string | null): void {
  folderPath = path;
}

export function getFolderPath(): string | null {
  return folderPath;
}
