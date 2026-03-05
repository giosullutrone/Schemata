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

export interface ImageTreeNode {
  kind: 'image';
  name: string;
  relativePath: string;
}

export interface PdfTreeNode {
  kind: 'pdf';
  name: string;
  relativePath: string;
}

export type TreeNode = FolderTreeNode | FileTreeNode | ImageTreeNode | PdfTreeNode;

export function buildFolderTree(files: Record<string, CodeCanvasFile>, imagePaths: string[] = [], pdfPaths: string[] = []): TreeNode[] {
  // Group files, images, and PDFs by their parent directory
  const folderMap = new Map<string, (FileTreeNode | ImageTreeNode | PdfTreeNode)[]>();

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

  for (const imgPath of imagePaths) {
    const lastSlash = imgPath.lastIndexOf('/');
    const dirPath = lastSlash === -1 ? '' : imgPath.substring(0, lastSlash);
    const name = lastSlash === -1 ? imgPath : imgPath.substring(lastSlash + 1);

    if (!folderMap.has(dirPath)) {
      folderMap.set(dirPath, []);
    }
    folderMap.get(dirPath)!.push({
      kind: 'image',
      name,
      relativePath: imgPath,
    });
  }

  for (const pdfPath of pdfPaths) {
    const lastSlash = pdfPath.lastIndexOf('/');
    const dirPath = lastSlash === -1 ? '' : pdfPath.substring(0, lastSlash);
    const name = lastSlash === -1 ? pdfPath : pdfPath.substring(lastSlash + 1);

    if (!folderMap.has(dirPath)) {
      folderMap.set(dirPath, []);
    }
    folderMap.get(dirPath)!.push({
      kind: 'pdf',
      name,
      relativePath: pdfPath,
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

    // Sort: folders first, then canvas files, then images, then PDFs (alphabetical within each)
    const kindOrder: Record<string, number> = { folder: 0, file: 1, image: 2, pdf: 3 };
    children.sort((a, b) => {
      const ka = kindOrder[a.kind] ?? 3;
      const kb = kindOrder[b.kind] ?? 3;
      if (ka !== kb) return ka - kb;
      return a.name.localeCompare(b.name);
    });

    return children;
  }

  return buildChildren('');
}
