import { useCanvasStore } from '../store/useCanvasStore';
import type { RelationshipType, ClassEdgeData } from '../types/schema';

interface BridgeRequest {
  id: string;
  action: string;
  args: unknown[];
}

function getActiveFile() {
  const s = useCanvasStore.getState();
  return s.activeFilePath ? s.files[s.activeFilePath] : null;
}

function getNodeById(id: string) {
  return getActiveFile()?.nodes.find((n) => n.id === id) ?? null;
}

function getEdgeById(id: string) {
  return getActiveFile()?.edges.find((e) => e.id === id) ?? null;
}

function handleAction(action: string, args: unknown[]): unknown {
  const store = useCanvasStore.getState();
  const file = getActiveFile();

  switch (action) {
    // ── Reads ──
    case 'getCanvas':
      return file ? { nodes: file.nodes, edges: file.edges, viewport: file.viewport } : null;
    case 'getNodes':
      return file?.nodes ?? [];
    case 'getNode':
      return getNodeById(args[0] as string);
    case 'getEdges':
      return file?.edges ?? [];
    case 'getEdge':
      return getEdgeById(args[0] as string);
    case 'getViewport':
      return file?.viewport ?? null;
    case 'getFiles':
      return Object.entries(store.files).map(([path, f]) => ({ path, name: f.name }));
    case 'getActiveFile':
      return store.activeFilePath
        ? { path: store.activeFilePath, name: store.files[store.activeFilePath]?.name }
        : null;
    case 'getFolderInfo':
      return { name: store.folderName, fileCount: Object.keys(store.files).length };
    case 'getImagePaths':
      return store.imagePaths;
    case 'getPdfPaths':
      return store.pdfPaths;

    // ── Node mutations ──
    case 'addClassNode': {
      const before = file?.nodes.length ?? 0;
      store.addClassNode(args[0] as number, args[1] as number);
      const after = getActiveFile()?.nodes ?? [];
      return after.length > before ? after[after.length - 1] : null;
    }
    case 'addTextNode': {
      const before = file?.nodes.length ?? 0;
      store.addTextNode(args[0] as number, args[1] as number, args[2] as Record<string, unknown> | undefined);
      const after = getActiveFile()?.nodes ?? [];
      return after.length > before ? after[after.length - 1] : null;
    }
    case 'updateNodeData':
      store.updateNodeData(args[0] as string, args[1] as Record<string, unknown>);
      return getNodeById(args[0] as string);
    case 'updateNodePosition':
      store.updateNodePosition(args[0] as string, args[1] as number, args[2] as number);
      return getNodeById(args[0] as string);
    case 'removeNode':
      store.removeNode(args[0] as string);
      return { success: true };
    case 'removeNodes':
      store.removeNodes(args[0] as string[]);
      return { success: true };

    // ── Edge mutations ──
    case 'addEdge': {
      const before = file?.edges.length ?? 0;
      store.addEdge(
        args[0] as string, args[1] as string, args[2] as RelationshipType,
        args[3] as string | undefined, args[4] as string | undefined,
      );
      const after = getActiveFile()?.edges ?? [];
      return after.length > before ? after[after.length - 1] : null;
    }
    case 'updateEdgeData':
      store.updateEdgeData(args[0] as string, args[1] as Partial<ClassEdgeData>);
      return getEdgeById(args[0] as string);
    case 'updateEdgeType':
      store.updateEdgeType(args[0] as string, args[1] as RelationshipType);
      return getEdgeById(args[0] as string);
    case 'removeEdge':
      store.removeEdge(args[0] as string);
      return { success: true };
    case 'removeEdges':
      store.removeEdges(args[0] as string[]);
      return { success: true };

    // ── File operations ──
    case 'setActiveFile':
      store.setActiveFile(args[0] as string);
      return { success: true };
    case 'createFile':
      return store.createFile(args[0] as string, args[1] as string);
    case 'saveActiveFile':
      return store.saveActiveFile();
    case 'saveAllFiles':
      return store.saveAllFiles();
    case 'saveViewport':
      store.saveViewport(args[0] as { x: number; y: number; zoom: number });
      return { success: true };

    // ── History ──
    case 'undo':
      store.undo();
      return { success: true };
    case 'redo':
      store.redo();
      return { success: true };

    // ── Layout ──
    case 'alignNodes':
      store.alignNodes(
        args[0] as { id: string; x: number; y: number; w: number; h: number }[],
        args[1] as 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
      );
      return { success: true };
    case 'distributeNodes':
      store.distributeNodes(
        args[0] as { id: string; x: number; y: number; w: number; h: number }[],
        args[1] as 'horizontal' | 'vertical',
      );
      return { success: true };
    case 'groupSelectedNodes': {
      const before = file?.nodes.length ?? 0;
      store.groupSelectedNodes(
        args[0] as { id: string; x: number; y: number; w: number; h: number }[],
      );
      const after = getActiveFile()?.nodes ?? [];
      return after.length > before ? after[after.length - 1] : null;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// Register HMR listener
if (import.meta.hot) {
  import.meta.hot.on('canvas:request', (data: unknown) => {
    const req = data as BridgeRequest;
    try {
      const result = handleAction(req.action, req.args);
      // Handle async results (createFile, saveActiveFile, etc.)
      if (result instanceof Promise) {
        result
          .then((res) => import.meta.hot!.send('canvas:response', { id: req.id, result: res }))
          .catch((err) => import.meta.hot!.send('canvas:response', { id: req.id, error: String(err) }));
      } else {
        import.meta.hot!.send('canvas:response', { id: req.id, result });
      }
    } catch (err) {
      import.meta.hot!.send('canvas:response', { id: req.id, error: String(err) });
    }
  });
}

export { handleAction };
