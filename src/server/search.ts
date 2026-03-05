export function wildcardMatch(text: string, pattern: string): boolean {
  const t = text.toLowerCase();
  const p = pattern.toLowerCase();
  const regex = new RegExp(
    '^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
  );
  return regex.test(t);
}
