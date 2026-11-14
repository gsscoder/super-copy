import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveInside } from '../src/safe-path.js';

describe('resolveInside', () => {
  const base = path.resolve('some', 'base');

  it('accepts a nested path', () => {
    expect(resolveInside(base, 'a/b.txt')).toBe(path.join(base, 'a', 'b.txt'));
  });

  it.each(['../x', 'a/../../x', '..', '.', ''])('rejects %j', (rel) => {
    expect(() => resolveInside(base, rel)).toThrow();
  });

  it('rejects an absolute path', () => {
    expect(() => resolveInside(base, path.resolve('elsewhere', 'x'))).toThrow();
  });

  it.skipIf(process.platform !== 'win32')('rejects backslash traversal on Windows', () => {
    expect(() => resolveInside(base, '..\\..\\x')).toThrow();
  });
});
