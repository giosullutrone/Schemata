import type { CanvasNodeSchema } from '../types/schema';

/** Search nodes by name, text, label, property names, and method names. */
export function searchNodes(nodes: CanvasNodeSchema[], query: string): CanvasNodeSchema[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return nodes.filter((node) => {
    const data = node.data as Record<string, unknown>;

    // classNode: match name, property names, method names
    if (node.type === 'classNode') {
      if ((data.name as string)?.toLowerCase().includes(q)) return true;
      const props = data.properties as { name: string }[] | undefined;
      if (props?.some((p) => p.name.toLowerCase().includes(q))) return true;
      const methods = data.methods as { name: string }[] | undefined;
      if (methods?.some((m) => m.name.toLowerCase().includes(q))) return true;
    }

    // textNode: match text content
    if (node.type === 'textNode') {
      if ((data.text as string)?.toLowerCase().includes(q)) return true;
    }

    // groupNode: match label
    if (node.type === 'groupNode') {
      if ((data.label as string)?.toLowerCase().includes(q)) return true;
    }

    return false;
  });
}
