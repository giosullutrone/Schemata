import { useCanvasStore } from '../store/useCanvasStore';
import type { RelationshipType, ClassEdgeData, ClassEdgeSchema, CanvasNodeSchema, SchemataFile } from '../types/schema';
import { GROUP_PADDING, GROUP_LABEL_HEIGHT } from '../constants';
import { closestHandles } from '../utils/closestHandles';

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

/** Find child nodes of a group (by parentId, then spatial containment fallback). */
function getChildNodeIds(groupNode: { id: string; type: string; position: { x: number; y: number }; style?: { width?: number; height?: number } }): string[] {
  const file = getActiveFile();
  if (!file || groupNode.type !== 'groupNode') return [];
  const byParent = file.nodes.filter(n => (n as { parentId?: string }).parentId === groupNode.id);
  if (byParent.length > 0) return byParent.map(n => n.id);
  const gx = groupNode.position.x;
  const gy = groupNode.position.y;
  const gw = groupNode.style?.width ?? 0;
  const gh = groupNode.style?.height ?? 0;
  if (gw === 0 || gh === 0) return [];
  return file.nodes
    .filter(n => n.id !== groupNode.id && n.position.x >= gx && n.position.x <= gx + gw && n.position.y >= gy && n.position.y <= gy + gh)
    .map(n => n.id);
}

function wildcardMatchBrowser(text: string, pattern: string): boolean {
  const t = text.toLowerCase();
  const p = pattern.toLowerCase();
  const regex = new RegExp(
    '^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
  );
  return regex.test(t);
}

function nodeMatchesQuery(node: { type: string; data: Record<string, unknown> }, query: string): boolean {
  if (node.type === 'classNode') {
    const d = node.data as { name?: string; properties?: Array<{ name: string }>; methods?: Array<{ name: string }> };
    if (wildcardMatchBrowser(d.name ?? '', query)) return true;
    if (d.properties?.some((p) => wildcardMatchBrowser(p.name, query))) return true;
    if (d.methods?.some((m) => wildcardMatchBrowser(m.name, query))) return true;
    return false;
  }
  if (node.type === 'textNode') {
    return wildcardMatchBrowser((node.data as { text?: string }).text ?? '', query);
  }
  if (node.type === 'groupNode') {
    return wildcardMatchBrowser((node.data as { label?: string }).label ?? '', query);
  }
  return false;
}

let dupIdCounter = 0;

function handleAction(action: string, args: unknown[]): unknown {
  const store = useCanvasStore.getState();
  const file = getActiveFile();

  switch (action) {
    // ── Clear ──
    case 'clearCanvas': {
      if (!file) return { success: true };
      store.pushUndoSnapshot();
      store.setCanvasNodes([]);
      store.setCanvasEdges([]);
      return { success: true };
    }

    // ── Batch edge creation (atomic undo) ──
    case 'addEdgesBatch': {
      const edgeDefs = args[0] as Array<{
        source: string; target: string; relationshipType: RelationshipType;
        sourceHandle?: string; targetHandle?: string;
        label?: string; color?: string; strokeStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
        labelWidth?: number; labelHeight?: number;
      }>;
      if (!file || !edgeDefs || edgeDefs.length === 0) return [];
      store.pushUndoSnapshot();
      const currentEdges = [...(getActiveFile()?.edges ?? [])];
      const created: ClassEdgeSchema[] = [];
      for (const def of edgeDefs) {
        const newEdge: ClassEdgeSchema = {
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          source: def.source,
          target: def.target,
          ...(def.sourceHandle ? { sourceHandle: def.sourceHandle } : {}),
          ...(def.targetHandle ? { targetHandle: def.targetHandle } : {}),
          type: 'uml' as const,
          data: {
            relationshipType: def.relationshipType,
            ...(def.label ? { label: def.label } : {}),
            ...(def.color ? { color: def.color } : {}),
            ...(def.strokeStyle ? { strokeStyle: def.strokeStyle } : {}),
            ...(def.labelWidth ? { labelWidth: def.labelWidth } : {}),
            ...(def.labelHeight ? { labelHeight: def.labelHeight } : {}),
          },
        };
        currentEdges.push(newEdge);
        created.push(newEdge);
      }
      store.setCanvasEdges(currentEdges as ClassEdgeSchema[]);
      return created;
    }

    // ── Batch position update (atomic undo) ──
    case 'updateNodePositions': {
      const positions = args[0] as Array<{ id: string; x: number; y: number }>;
      if (!file || !positions || positions.length === 0) return { success: true };
      store.pushUndoSnapshot();
      // Build position map, then expand with group children deltas
      const posMap = new Map(positions.map(p => [p.id, { x: p.x, y: p.y }]));
      for (const p of positions) {
        const node = file.nodes.find(n => n.id === p.id);
        if (node?.type === 'groupNode') {
          const dx = p.x - node.position.x;
          const dy = p.y - node.position.y;
          if (dx !== 0 || dy !== 0) {
            const childIds = getChildNodeIds(node as Parameters<typeof getChildNodeIds>[0]);
            for (const cid of childIds) {
              if (!posMap.has(cid)) {
                const child = file.nodes.find(n => n.id === cid);
                if (child) posMap.set(cid, { x: child.position.x + dx, y: child.position.y + dy });
              }
            }
          }
        }
      }
      store.setCanvasNodes(
        file.nodes.map(n => {
          const pos = posMap.get(n.id);
          return pos ? { ...n, position: pos } : n;
        }) as CanvasNodeSchema[]
      );
      return { success: true, updated: posMap.size };
    }

    // ── Fit viewport to content ──
    case 'fitViewport': {
      if (!file || file.nodes.length === 0) return null;
      const padding = (args[0] as number) ?? 50;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of file.nodes) {
        const w = (n as { measured?: { width?: number } }).measured?.width
          ?? (n as { style?: { width?: number } }).style?.width ?? 180;
        const h = (n as { measured?: { height?: number } }).measured?.height
          ?? (n as { style?: { height?: number } }).style?.height ?? 100;
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + w);
        maxY = Math.max(maxY, n.position.y + h);
      }
      const contentW = maxX - minX + padding * 2;
      const contentH = maxY - minY + padding * 2;
      const el = document.querySelector('.react-flow') as HTMLElement;
      const viewW = el?.clientWidth ?? 1200;
      const viewH = el?.clientHeight ?? 800;
      const zoom = Math.min(viewW / contentW, viewH / contentH, 1);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const vp = {
        x: viewW / 2 - centerX * zoom,
        y: viewH / 2 - centerY * zoom,
        zoom,
      };
      store.saveViewport(vp);
      return vp;
    }

    // ── Auto-layout ──
    case 'autoLayout': {
      if (!file || file.nodes.length === 0) return { success: true };
      const strategy = (args[0] as string) ?? 'grid';
      store.pushUndoSnapshot();

      if (strategy === 'hierarchical') {
        const hGap = (args[1] as number) ?? 60;
        const vGap = (args[1] as number) ?? 80;
        // Build adjacency from inheritance/implementation edges
        const inheritanceTypes = new Set(['inheritance', 'implementation']);
        const children = new Map<string, string[]>();
        const hasParent = new Set<string>();
        for (const e of file.edges) {
          const rt = (e.data as { relationshipType?: string })?.relationshipType ?? '';
          if (inheritanceTypes.has(rt)) {
            // source=child, target=parent
            const parent = e.target;
            const child = e.source;
            hasParent.add(child);
            if (!children.has(parent)) children.set(parent, []);
            children.get(parent)!.push(child);
          }
        }
        // Find roots (nodes with no parent in inheritance tree)
        const classNodes = file.nodes.filter(n => n.type === 'classNode');
        const roots = classNodes.filter(n => !hasParent.has(n.id));
        const nonTree = classNodes.filter(n => !roots.includes(n) && !hasParent.has(n.id));

        // Build a size map for all nodes
        const nodeSize = (n: typeof file.nodes[0]) => ({
          w: (n as { measured?: { width?: number } }).measured?.width
            ?? (n as { style?: { width?: number } }).style?.width ?? 200,
          h: (n as { measured?: { height?: number } }).measured?.height
            ?? (n as { style?: { height?: number } }).style?.height ?? 150,
        });
        const sizeMap = new Map(file.nodes.map(n => [n.id, nodeSize(n)]));

        // BFS to assign levels
        const levels = new Map<string, number>();
        const queue: Array<{ id: string; level: number }> = [];
        for (const r of roots) { levels.set(r.id, 0); queue.push({ id: r.id, level: 0 }); }
        while (queue.length > 0) {
          const { id, level } = queue.shift()!;
          for (const childId of (children.get(id) ?? [])) {
            if (!levels.has(childId)) {
              levels.set(childId, level + 1);
              queue.push({ id: childId, level: level + 1 });
            }
          }
        }

        // Group by level
        const byLevel = new Map<number, string[]>();
        for (const [id, level] of levels) {
          if (!byLevel.has(level)) byLevel.set(level, []);
          byLevel.get(level)!.push(id);
        }

        // Compute row heights (max node height per level)
        const rowHeights = new Map<number, number>();
        for (const [level, ids] of byLevel) {
          rowHeights.set(level, Math.max(...ids.map(id => sizeMap.get(id)?.h ?? 150)));
        }

        // Position nodes with size-aware spacing
        const posMap = new Map<string, { x: number; y: number }>();
        for (const [level, ids] of byLevel) {
          let x = 0;
          ids.forEach((id, i) => {
            if (i > 0) x += hGap;
            posMap.set(id, { x, y: 0 }); // y set below
            x += sizeMap.get(id)?.w ?? 200;
          });
        }
        // Set y positions using accumulated row heights
        let yOffset = 0;
        const maxLevel = Math.max(...byLevel.keys(), 0);
        for (let level = 0; level <= maxLevel; level++) {
          const ids = byLevel.get(level);
          if (ids) {
            for (const id of ids) {
              const pos = posMap.get(id)!;
              posMap.set(id, { x: pos.x, y: yOffset });
            }
            yOffset += (rowHeights.get(level) ?? 150) + vGap;
          }
        }

        // Place non-tree and non-class nodes in a row below
        const otherNodes = [...nonTree, ...file.nodes.filter(n => n.type !== 'classNode' && !levels.has(n.id))];
        let otherX = 0;
        otherNodes.forEach((n, i) => {
          if (i > 0) otherX += hGap;
          posMap.set(n.id, { x: otherX, y: yOffset + vGap });
          otherX += sizeMap.get(n.id)?.w ?? 200;
        });

        store.setCanvasNodes(
          file.nodes.map(n => {
            const pos = posMap.get(n.id);
            return pos ? { ...n, position: pos } : n;
          }) as CanvasNodeSchema[]
        );
      } else {
        // Grid layout
        const gap = (args[1] as number) ?? 40;
        const cols = Math.ceil(Math.sqrt(file.nodes.length));
        const nodeSizes = file.nodes.map(n => ({
          w: (n as { measured?: { width?: number } }).measured?.width
            ?? (n as { style?: { width?: number } }).style?.width ?? 200,
          h: (n as { measured?: { height?: number } }).measured?.height
            ?? (n as { style?: { height?: number } }).style?.height ?? 150,
        }));
        // Compute column widths and row heights
        const colWidths: number[] = [];
        const rowHeights: number[] = [];
        for (let i = 0; i < file.nodes.length; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          colWidths[col] = Math.max(colWidths[col] ?? 0, nodeSizes[i].w);
          rowHeights[row] = Math.max(rowHeights[row] ?? 0, nodeSizes[i].h);
        }

        store.setCanvasNodes(
          file.nodes.map((n, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            let x = 0;
            for (let c = 0; c < col; c++) x += colWidths[c] + gap;
            let y = 0;
            for (let r = 0; r < row; r++) y += rowHeights[r] + gap;
            return { ...n, position: { x, y } };
          }) as CanvasNodeSchema[]
        );
      }

      return { success: true };
    }
    // ── Edge handle recalculation ──
    case 'recalculateEdgeHandles': {
      if (!file || file.edges.length === 0) return { updated: 0 };
      const nodeMap = new Map(file.nodes.map(n => [n.id, n]));
      const sideHandles = new Set(['top', 'bottom', 'left', 'right']);
      let updated = 0;
      const newEdges = file.edges.map(edge => {
        // Skip edges with property/method handles (non-side handles)
        if (edge.sourceHandle && !sideHandles.has(edge.sourceHandle)) return edge;
        if (edge.targetHandle && !sideHandles.has(edge.targetHandle)) return edge;
        const sn = nodeMap.get(edge.source);
        const tn = nodeMap.get(edge.target);
        if (!sn || !tn) return edge;
        const srcSize = {
          width: (sn as { measured?: { width?: number } }).measured?.width
            ?? (sn as { style?: { width?: number } }).style?.width ?? 200,
          height: (sn as { measured?: { height?: number } }).measured?.height
            ?? (sn as { style?: { height?: number } }).style?.height ?? 150,
        };
        const tgtSize = {
          width: (tn as { measured?: { width?: number } }).measured?.width
            ?? (tn as { style?: { width?: number } }).style?.width ?? 200,
          height: (tn as { measured?: { height?: number } }).measured?.height
            ?? (tn as { style?: { height?: number } }).style?.height ?? 150,
        };
        const [newSrc, newTgt] = closestHandles(sn.position, srcSize, tn.position, tgtSize);
        if (newSrc !== edge.sourceHandle || newTgt !== edge.targetHandle) {
          updated++;
          return { ...edge, sourceHandle: newSrc, targetHandle: newTgt };
        }
        return edge;
      });
      if (updated > 0) {
        store.setCanvasEdges(newEdges as ClassEdgeSchema[]);
      }
      return { updated };
    }

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
      const result = after.length > before ? after[after.length - 1] : null;

      return result;
    }
    case 'addTextNode': {
      const before = file?.nodes.length ?? 0;
      store.addTextNode(args[0] as number, args[1] as number, args[2] as Record<string, unknown> | undefined);
      const after = getActiveFile()?.nodes ?? [];
      const result = after.length > before ? after[after.length - 1] : null;

      return result;
    }
    case 'updateNodeData':
      store.updateNodeData(args[0] as string, args[1] as Record<string, unknown>);

      return getNodeById(args[0] as string);
    case 'updateNodePosition': {
      const posNodeId = args[0] as string;
      const newX = args[1] as number;
      const newY = args[2] as number;
      const posNode = file?.nodes.find(n => n.id === posNodeId);
      if (posNode?.type === 'groupNode') {
        const dx = newX - posNode.position.x;
        const dy = newY - posNode.position.y;
        if (dx !== 0 || dy !== 0) {
          const childIds = getChildNodeIds(posNode as Parameters<typeof getChildNodeIds>[0]);
          if (childIds.length > 0) {
            store.pushUndoSnapshot();
            const childSet = new Set(childIds);
            store.setCanvasNodes(
              file!.nodes.map(n => {
                if (n.id === posNodeId) return { ...n, position: { x: newX, y: newY } };
                if (childSet.has(n.id)) return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } };
                return n;
              }) as CanvasNodeSchema[]
            );
            return getNodeById(posNodeId);
          }
        }
      }
      store.updateNodePosition(posNodeId, newX, newY);
      return getNodeById(posNodeId);
    }
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
      const result = after.length > before ? after[after.length - 1] : null;

      return result;
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
    case 'alignNodes': {
      const rects = args[0] as { id: string; x: number; y: number; w: number; h: number }[];
      if (!rects || rects.length < 2) return { success: true };
      store.pushUndoSnapshot();
      store.alignNodes(rects, args[1] as 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom');
      return { success: true };
    }
    case 'distributeNodes': {
      const rects = args[0] as { id: string; x: number; y: number; w: number; h: number }[];
      if (!rects || rects.length < 3) return { success: true };
      store.pushUndoSnapshot();
      store.distributeNodes(rects, args[1] as 'horizontal' | 'vertical');
      return { success: true };
    }
    case 'groupSelectedNodes': {
      const before = file?.nodes.length ?? 0;
      store.pushUndoSnapshot();
      store.groupSelectedNodes(
        args[0] as { id: string; x: number; y: number; w: number; h: number }[],
      );
      const after = getActiveFile()?.nodes ?? [];
      return after.length > before ? after[after.length - 1] : null;
    }

    // ── Search ──
    case 'search': {
      const query = args[0] as string;
      const typeFilter = args[1] as string | undefined;
      const nodes = file?.nodes ?? [];
      const edges = file?.edges ?? [];

      const matchingNodes = nodes.filter((n) => {
        if (typeFilter && n.type !== typeFilter) return false;
        return nodeMatchesQuery(n as { type: string; data: Record<string, unknown> }, query);
      });

      const matchingEdges = edges.filter((e) => {
        const label = (e.data as { label?: string })?.label ?? '';
        return wildcardMatchBrowser(label, query);
      });

      return { nodes: matchingNodes, edges: matchingEdges };
    }

    case 'loadFolder': {
      store.loadFolder(
        args[0] as string,
        args[1] as Record<string, SchemataFile>,
        args[2] as string[],
        args[3] as string[],
      );
      return { success: true };
    }

    // ── File operations (new) ──
    case 'removeFile':
      return store.removeFile(args[0] as string).then(() => ({ success: true }));
    case 'renameFile':
      store.renameFile(args[0] as string);
      return { success: true };
    case 'refreshFolder':
      return store.refreshFolder().then(() => ({ success: true }));

    // ── Stats ──
    case 'getStats': {
      const nodes = file?.nodes ?? [];
      const edges = file?.edges ?? [];
      return {
        totalNodes: nodes.length,
        classNodes: nodes.filter(n => n.type === 'classNode').length,
        textNodes: nodes.filter(n => n.type === 'textNode').length,
        groupNodes: nodes.filter(n => n.type === 'groupNode').length,
        totalEdges: edges.length,
        edgesByType: edges.reduce<Record<string, number>>((acc, e) => {
          const t = (e.data as { relationshipType?: string })?.relationshipType ?? 'unknown';
          acc[t] = (acc[t] ?? 0) + 1;
          return acc;
        }, {}),
        dirtyFiles: Object.keys(store._dirtyFiles),
        fileCount: Object.keys(store.files).length,
      };
    }

    // ── Duplicate ──
    case 'duplicateNodes': {
      const ids = args[0] as string[];
      const offsetX = (args[1] as number) ?? 30;
      const offsetY = (args[2] as number) ?? 30;
      if (!file || !ids || ids.length === 0) return { nodes: [], edges: [], idMap: {} };

      const idSet = new Set(ids);
      const nodesToDup = file.nodes.filter(n => idSet.has(n.id));
      if (nodesToDup.length === 0) return { nodes: [], edges: [], idMap: {} };
      const idMap: Record<string, string> = {};

      // Create new nodes with offset positions
      const newNodes = nodesToDup.map(n => {
        const suffix = `${++dupIdCounter}-${Math.random().toString(36).slice(2, 6)}`;
        let newId: string;
        if (n.type === 'classNode') {
          newId = `class-dup-${suffix}`;
        } else if (n.type === 'textNode') {
          newId = `text-dup-${suffix}`;
        } else {
          newId = `group-dup-${suffix}`;
        }
        idMap[n.id] = newId;
        return {
          ...JSON.parse(JSON.stringify(n)),
          id: newId,
          position: { x: n.position.x + offsetX, y: n.position.y + offsetY },
        };
      });

      // Duplicate edges between selected nodes
      const edgesToDup = file.edges.filter(e => idSet.has(e.source) && idSet.has(e.target));
      const newEdges = edgesToDup.map(e => ({
        ...JSON.parse(JSON.stringify(e)),
        id: `edge-dup-${++dupIdCounter}-${Math.random().toString(36).slice(2, 6)}`,
        source: idMap[e.source] ?? e.source,
        target: idMap[e.target] ?? e.target,
      }));

      // Apply to store
      store.pushUndoSnapshot();
      store.setCanvasNodes([...file.nodes, ...newNodes]);
      store.setCanvasEdges([...file.edges, ...newEdges]);

      return { nodes: newNodes, edges: newEdges, idMap };
    }

    // ── Settings ──
    case 'getSettings':
      return {
        colorMode: (() => { try { return localStorage.getItem('schemata-color-mode') || 'system'; } catch { return 'system'; } })(),
        snapMode: (() => { try { return localStorage.getItem('schemata-snap-mode') || 'grid'; } catch { return 'grid'; } })(),
        sidebarOpen: store.sidebarOpen,
      };
    case 'updateSettings': {
      const s = args[0] as { colorMode?: string; snapMode?: string; sidebarOpen?: boolean };
      if (s.colorMode) { try { localStorage.setItem('schemata-color-mode', s.colorMode); } catch { /* */ } }
      if (s.snapMode) { try { localStorage.setItem('schemata-snap-mode', s.snapMode); } catch { /* */ } }
      if (s.sidebarOpen !== undefined) store.setSidebarOpen(s.sidebarOpen);
      return { success: true };
    }

    // ── Graph queries ──
    case 'getConnections': {
      const nodeId = args[0] as string;
      const node = file?.nodes.find(n => n.id === nodeId);
      if (!node) return null;
      const relEdges = (file?.edges ?? []).filter(e => e.source === nodeId || e.target === nodeId);
      const connectedIds = new Set<string>();
      for (const e of relEdges) {
        if (e.source !== nodeId) connectedIds.add(e.source);
        if (e.target !== nodeId) connectedIds.add(e.target);
      }
      const connectedNodes = (file?.nodes ?? []).filter(n => connectedIds.has(n.id));
      return { node, edges: relEdges, connectedNodes };
    }

    case 'getHierarchy': {
      const startId = args[0] as string;
      const direction = (args[1] as string) ?? 'both';
      if (!['ancestors', 'descendants', 'both'].includes(direction)) {
        throw new Error(`Invalid direction: ${direction}. Must be ancestors, descendants, or both`);
      }
      if (!file) return null;
      const startNode = file.nodes.find(n => n.id === startId);
      if (!startNode) return null;

      const inheritanceTypes = new Set(['inheritance', 'implementation']);
      const relevantEdges = file.edges.filter(e =>
        inheritanceTypes.has((e.data as { relationshipType?: string })?.relationshipType ?? '')
      );

      // Ancestors: follow edges where current is SOURCE (source=child → target=parent)
      const ancestors: typeof file.nodes = [];
      if (direction === 'ancestors' || direction === 'both') {
        const visited = new Set<string>();
        const queue = [startId];
        while (queue.length > 0) {
          const current = queue.shift()!;
          for (const edge of relevantEdges) {
            if (edge.source === current && !visited.has(edge.target)) {
              visited.add(edge.target);
              const node = file.nodes.find(n => n.id === edge.target);
              if (node) { ancestors.push(node); queue.push(edge.target); }
            }
          }
        }
      }

      // Descendants: follow edges where current is TARGET (target=parent ← source=child)
      const descendants: typeof file.nodes = [];
      if (direction === 'descendants' || direction === 'both') {
        const visited = new Set<string>();
        const queue = [startId];
        while (queue.length > 0) {
          const current = queue.shift()!;
          for (const edge of relevantEdges) {
            if (edge.target === current && !visited.has(edge.source)) {
              visited.add(edge.source);
              const node = file.nodes.find(n => n.id === edge.source);
              if (node) { descendants.push(node); queue.push(edge.source); }
            }
          }
        }
      }

      return { node: startNode, ancestors, descendants };
    }

    case 'getGroupChildren': {
      const groupId = args[0] as string;
      if (!file) return null;
      const group = file.nodes.find(n => n.id === groupId && n.type === 'groupNode');
      if (!group) return null;
      // Primary: use parentId (React Flow's native parent tracking)
      const byParent = file.nodes.filter(n => (n as { parentId?: string }).parentId === groupId);
      if (byParent.length > 0) return byParent;
      // Fallback: spatial containment
      const gx = group.position.x;
      const gy = group.position.y;
      const gw = (group as { style?: { width?: number } }).style?.width ?? 0;
      const gh = (group as { style?: { height?: number } }).style?.height ?? 0;
      if (gw === 0 || gh === 0) return [];
      return file.nodes.filter(n =>
        n.id !== groupId &&
        n.position.x >= gx &&
        n.position.x <= gx + gw &&
        n.position.y >= gy &&
        n.position.y <= gy + gh
      );
    }

    case 'getOrphans': {
      if (!file) return [];
      const connectedIds = new Set<string>();
      for (const edge of file.edges) {
        connectedIds.add(edge.source);
        connectedIds.add(edge.target);
      }
      return file.nodes.filter(n => !connectedIds.has(n.id));
    }

    case 'fitGroupToNodes': {
      const groupId = args[0] as string;
      const nodeIds = args[1] as string[];
      const padding = (args[2] as number) ?? GROUP_PADDING;
      if (!file) return null;
      const group = file.nodes.find(n => n.id === groupId && n.type === 'groupNode');
      if (!group) return null;
      const targetNodes = file.nodes.filter(n => nodeIds.includes(n.id));
      if (targetNodes.length === 0) return null;

      // Measure bounding box of target nodes using their measured dimensions or defaults
      const rects = targetNodes.map(n => {
        const w = (n as { measured?: { width?: number } }).measured?.width
          ?? (n as { style?: { width?: number } }).style?.width ?? 180;
        const h = (n as { measured?: { height?: number } }).measured?.height
          ?? (n as { style?: { height?: number } }).style?.height ?? 100;
        return { x: n.position.x, y: n.position.y, w, h };
      });

      const minX = Math.min(...rects.map(r => r.x));
      const minY = Math.min(...rects.map(r => r.y));
      const maxX = Math.max(...rects.map(r => r.x + r.w));
      const maxY = Math.max(...rects.map(r => r.y + r.h));

      const newPos = { x: minX - padding, y: minY - padding - GROUP_LABEL_HEIGHT };
      const newStyle = {
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2 + GROUP_LABEL_HEIGHT,
      };

      store.pushUndoSnapshot();
      store.updateNodePosition(groupId, newPos.x, newPos.y);
      // Update style via setCanvasNodes since updateNodeData only merges data, not style
      store.setCanvasNodes(
        getActiveFile()!.nodes.map(n =>
          n.id === groupId ? { ...n, style: newStyle } as typeof n : n
        )
      );

      return { ...getNodeById(groupId), style: newStyle };
    }

    case 'getNodeDistance': {
      const idA = args[0] as string;
      const idB = args[1] as string;
      if (!file) return null;
      const nodeA = file.nodes.find(n => n.id === idA);
      const nodeB = file.nodes.find(n => n.id === idB);
      if (!nodeA || !nodeB) return null;
      return {
        from: { id: nodeA.id, x: nodeA.position.x, y: nodeA.position.y },
        to: { id: nodeB.id, x: nodeB.position.x, y: nodeB.position.y },
        dx: nodeB.position.x - nodeA.position.x,
        dy: nodeB.position.y - nodeA.position.y,
        distance: Math.sqrt(
          (nodeB.position.x - nodeA.position.x) ** 2 +
          (nodeB.position.y - nodeA.position.y) ** 2
        ),
      };
    }

    // ── Export ──
    case 'exportCanvas': {
      const format = args[0] as string;
      if (format === 'json') {
        return file ? { version: file.version, name: file.name, nodes: file.nodes, edges: file.edges, viewport: file.viewport } : null;
      }
      const el = document.querySelector('.react-flow') as HTMLElement;
      if (!el) throw new Error('Canvas element not found — is the browser tab open?');

      // Save current viewport, fit to content, capture, then restore
      const savedViewport = file?.viewport ?? { x: 0, y: 0, zoom: 1 };
      if (file && file.nodes.length > 0) {
        handleAction('fitViewport', [20]);
      }

      // Wait for re-render, capture, then restore viewport
      return new Promise<string>((resolve) => setTimeout(resolve, 300))
        .then(() => {
          if (format === 'png') {
            return import('html-to-image').then(({ toBlob }) =>
              toBlob(el).then(blob => {
                if (!blob) throw new Error('Failed to generate PNG');
                return new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
              })
            );
          }
          if (format === 'svg') {
            return import('html-to-image').then(({ toSvg }) => toSvg(el));
          }
          throw new Error(`Unsupported export format: ${format}`);
        })
        .finally(() => {
          store.saveViewport(savedViewport);
        });
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
