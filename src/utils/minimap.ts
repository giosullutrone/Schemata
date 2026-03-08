/** Returns a minimap background color for a given node type. */
export function minimapNodeColor(type?: string): string {
  switch (type) {
    case 'classNode': return '#4A90D9';
    case 'textNode': return '#F39C12';
    case 'groupNode': return '#2ECC71';
    default: return '#888888';
  }
}
