import { describe, it, expect } from 'vitest';
import { wildcardMatch } from './search';

describe('wildcardMatch', () => {
  it('matches exact strings', () => {
    expect(wildcardMatch('hello', 'hello')).toBe(true);
    expect(wildcardMatch('hello', 'world')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(wildcardMatch('Hello', 'hello')).toBe(true);
    expect(wildcardMatch('HELLO', 'hello')).toBe(true);
  });

  it('* matches any sequence', () => {
    expect(wildcardMatch('UserService', '*Service')).toBe(true);
    expect(wildcardMatch('UserService', 'User*')).toBe(true);
    expect(wildcardMatch('UserService', '*erSer*')).toBe(true);
    expect(wildcardMatch('UserService', '*xyz*')).toBe(false);
  });

  it('? matches single character', () => {
    expect(wildcardMatch('cat', 'c?t')).toBe(true);
    expect(wildcardMatch('cut', 'c?t')).toBe(true);
    expect(wildcardMatch('coat', 'c?t')).toBe(false);
  });

  it('handles combined wildcards', () => {
    expect(wildcardMatch('UserService', '?ser*')).toBe(true);
    expect(wildcardMatch('abc', '*')).toBe(true);
    expect(wildcardMatch('', '*')).toBe(true);
  });
});
