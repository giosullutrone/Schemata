import type { CodeCanvasFile } from '../types/schema';

export interface FolderTreeNode {
  kind: 'folder';
  name: string;
  path: string;
  children: TreeNode[];
}

export interface FileTreeNode {
  kind: 'file';
  name: string;
  fileName: string;
  relativePath: string;
}

export type TreeNode = FolderTreeNode | FileTreeNode;

export function buildFolderTree(files: Record<string, CodeCanvasFile>): TreeNode[] {
  // Group files by their parent directory
  const folderMap = new Map<string, FileTreeNode[]>();

  for (const [relativePath, file] of Object.entries(files)) {
    const lastSlash = relativePath.lastIndexOf('/');
    const dirPath = lastSlash === -1 ? '' : relativePath.substring(0, lastSlash);
    const fileName = lastSlash === -1 ? relativePath : relativePath.substring(lastSlash + 1);

    if (!folderMap.has(dirPath)) {
      folderMap.set(dirPath, []);
    }
    folderMap.get(dirPath)!.push({
      kind: 'file',
      name: file.name,
      fileName,
      relativePath,
    });
  }

  // Collect all intermediate folder paths
  const allFolderPaths = new Set<string>();
  for (const dirPath of folderMap.keys()) {
    if (dirPath === '') continue;
    const parts = dirPath.split('/');
    for (let i = 1; i <= parts.length; i++) {
      allFolderPaths.add(parts.slice(0, i).join('/'));
    }
  }

  function buildChildren(parentPath: string): TreeNode[] {
    const children: TreeNode[] = [];

    // Add sub-folders that are direct children of parentPath
    for (const folderPath of allFolderPaths) {
      const expectedPrefix = parentPath ? parentPath + '/' : '';
      const remainder = folderPath.startsWith(expectedPrefix)
        ? folderPath.substring(expectedPrefix.length)
        : null;
      if (remainder && !remainder.includes('/')) {
        children.push({
          kind: 'folder',
          name: remainder,
          path: folderPath,
          children: buildChildren(folderPath),
        });
      }
    }

    // Add files directly in this folder
    const filesHere = folderMap.get(parentPath) ?? [];
    children.push(...filesHere);

    // Sort: folders first (alphabetical), then files (alphabetical)
    children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return children;
  }

  return buildChildren('');
}
