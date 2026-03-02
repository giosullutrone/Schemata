import type { CodeCanvasFile } from '../types/schema';

export function serializeFile(file: CodeCanvasFile): string {
  return JSON.stringify(file, null, 2);
}

export function deserializeFile(json: string): CodeCanvasFile {
  return JSON.parse(json) as CodeCanvasFile;
}

export function validateFile(file: CodeCanvasFile): string[] {
  const errors: string[] = [];

  if (!file.version) {
    errors.push('Missing "version" field');
  }
  if (!file.name) {
    errors.push('Missing "name" field');
  }
  if (!file.canvases || typeof file.canvases !== 'object') {
    errors.push('Missing or invalid "canvases" field');
    return errors;
  }

  for (const [canvasId, canvas] of Object.entries(file.canvases)) {
    if (!canvas.name) {
      errors.push(`Canvas "${canvasId}" missing "name" field`);
    }
    if (!Array.isArray(canvas.nodes)) {
      errors.push(`Canvas "${canvasId}" missing "nodes" array`);
    }
    if (!Array.isArray(canvas.edges)) {
      errors.push(`Canvas "${canvasId}" missing "edges" array`);
    }
  }

  return errors;
}

export async function saveToFileSystem(file: CodeCanvasFile): Promise<FileSystemFileHandle | null> {
  if (!('showSaveFilePicker' in window)) {
    downloadAsFile(file);
    return null;
  }
  const handle = await window.showSaveFilePicker({
    suggestedName: `${file.name}.codecanvas.json`,
    types: [
      {
        description: 'CodeCanvas files',
        accept: { 'application/json': ['.codecanvas.json'] },
      },
    ],
  });
  const writable = await handle.createWritable();
  await writable.write(serializeFile(file));
  await writable.close();
  return handle;
}

export async function writeToHandle(handle: FileSystemFileHandle, file: CodeCanvasFile): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(serializeFile(file));
  await writable.close();
}

export async function loadFromFileSystem(): Promise<{ file: CodeCanvasFile; handle: FileSystemFileHandle } | null> {
  if (!('showOpenFilePicker' in window)) {
    return null;
  }
  const [handle] = await window.showOpenFilePicker({
    types: [
      {
        description: 'CodeCanvas files',
        accept: { 'application/json': ['.codecanvas.json', '.json'] },
      },
    ],
  });
  const fileObj = await handle.getFile();
  const text = await fileObj.text();
  const parsed = deserializeFile(text);
  return { file: parsed, handle };
}

function downloadAsFile(file: CodeCanvasFile): void {
  const blob = new Blob([serializeFile(file)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${file.name}.codecanvas.json`;
  a.click();
  URL.revokeObjectURL(url);
}
