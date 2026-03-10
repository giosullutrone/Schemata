export interface OverlapNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  parentId?: string;
}

export interface OverlapPair {
  nodeA: string;
  nodeB: string;
  overlapArea: number;
}

/**
 * Find all pairs of overlapping nodes, excluding parent–child group overlaps.
 * A group node overlapping with its own children is expected and excluded.
 */
export function findOverlappingNodes(nodes: OverlapNode[]): OverlapPair[] {
  const pairs: OverlapPair[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      // Skip parent–child pairs (group containing its own child)
      if (a.parentId === b.id || b.parentId === a.id) continue;

      const overlapX = Math.min(a.position.x + a.width, b.position.x + b.width) - Math.max(a.position.x, b.position.x);
      const overlapY = Math.min(a.position.y + a.height, b.position.y + b.height) - Math.max(a.position.y, b.position.y);

      if (overlapX > 0 && overlapY > 0) {
        pairs.push({
          nodeA: a.id,
          nodeB: b.id,
          overlapArea: overlapX * overlapY,
        });
      }
    }
  }

  return pairs;
}
