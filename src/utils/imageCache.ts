const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

function resolvePath(canvasRelativePath: string, imageSrc: string): string {
  // Get canvas file's directory: "diagrams/my.schemata.json" → "diagrams"
  const lastSlash = canvasRelativePath.lastIndexOf('/');
  const canvasDir = lastSlash >= 0 ? canvasRelativePath.substring(0, lastSlash) : '';

  // Join canvas directory with image src
  const raw = canvasDir ? `${canvasDir}/${imageSrc}` : imageSrc;

  // Normalize: resolve ".", "..", and collapse slashes
  const parts = raw.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.join('/');
}

export async function resolveImageUrl(
  folderHandle: FileSystemDirectoryHandle,
  canvasRelativePath: string,
  imageSrc: string,
): Promise<string | null> {
  const resolved = resolvePath(canvasRelativePath, imageSrc);

  // Return from cache if already loaded
  const cached = cache.get(resolved);
  if (cached) return cached;

  // Dedup concurrent loads for the same path
  const inflight = pending.get(resolved);
  if (inflight) return inflight;

  if (!resolved) return null;

  const promise = (async (): Promise<string | null> => {
    try {
      const segments = resolved.split('/');
      const fileName = segments.pop()!;

      // Walk directory handles to reach the file's parent
      let dir = folderHandle;
      for (const segment of segments) {
        dir = await dir.getDirectoryHandle(segment);
      }

      const fileHandle = await dir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const blobUrl = URL.createObjectURL(file);
      cache.set(resolved, blobUrl);
      return blobUrl;
    } catch {
      return null;
    } finally {
      pending.delete(resolved);
    }
  })();

  pending.set(resolved, promise);
  return promise;
}

export function clearImageCache(): void {
  for (const url of cache.values()) {
    URL.revokeObjectURL(url);
  }
  cache.clear();
  pending.clear();
}
