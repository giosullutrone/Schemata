type HandleId = 'top' | 'bottom' | 'left' | 'right';

interface Pos { x: number; y: number }
interface Size { width: number; height: number }

/**
 * Given two node positions and sizes, return the [sourceHandle, targetHandle]
 * pair that produces the shortest connection between them.
 *
 * Each node has handles at the center of each edge:
 *   top    = (x + w/2, y)
 *   bottom = (x + w/2, y + h)
 *   left   = (x,       y + h/2)
 *   right  = (x + w,   y + h/2)
 */
export function closestHandles(
  srcPos: Pos, srcSize: Size,
  tgtPos: Pos, tgtSize: Size,
): [HandleId, HandleId] {
  const handles: HandleId[] = ['top', 'bottom', 'left', 'right'];

  function handlePoint(pos: Pos, size: Size, handle: HandleId): Pos {
    switch (handle) {
      case 'top':    return { x: pos.x + size.width / 2, y: pos.y };
      case 'bottom': return { x: pos.x + size.width / 2, y: pos.y + size.height };
      case 'left':   return { x: pos.x,                  y: pos.y + size.height / 2 };
      case 'right':  return { x: pos.x + size.width,     y: pos.y + size.height / 2 };
    }
  }

  let bestSrc: HandleId = 'bottom';
  let bestTgt: HandleId = 'top';
  let bestDist = Infinity;

  for (const sh of handles) {
    const sp = handlePoint(srcPos, srcSize, sh);
    for (const th of handles) {
      const tp = handlePoint(tgtPos, tgtSize, th);
      const dx = sp.x - tp.x;
      const dy = sp.y - tp.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestSrc = sh;
        bestTgt = th;
      }
    }
  }

  return [bestSrc, bestTgt];
}
