import { describe, expect, it } from 'vitest';
import {
  assertNoFlattenCollisions,
  globPattern,
  matchGlobstar,
} from '../src/glob.js';

describe('globPattern', () => {
  it('matches exact literal filename', () => {
    const re = globPattern('notes.md');
    expect(re.test('notes.md')).toBe(true);
    expect(re.test('notes.mdx')).toBe(false);
    expect(re.test('xnotes.md')).toBe(false);
  });

  it('escapes regex special characters', () => {
    const re = globPattern('file.name+v1.txt');
    expect(re.test('file.name+v1.txt')).toBe(true);
    expect(re.test('fileXnameXv1Xtxt')).toBe(false);
  });

  it('matches * as wildcard for any characters', () => {
    const re = globPattern('task-*.md');
    expect(re.test('task-1.md')).toBe(true);
    expect(re.test('task-foo-bar.md')).toBe(true);
    expect(re.test('task-.md')).toBe(true);
    expect(re.test('task-1.txt')).toBe(false);
  });

  it('matches * spanning multiple path segments', () => {
    const re = globPattern('*.json');
    expect(re.test('config.json')).toBe(true);
    expect(re.test('a/b/config.json')).toBe(true);
  });

  it('matches bare * as match-all', () => {
    const re = globPattern('*');
    expect(re.test('anything')).toBe(true);
    expect(re.test('')).toBe(true);
  });
});

describe('globstarPattern', () => {
  it('matches all files recursively with **', () => {
    expect(matchGlobstar('**', 'root.md')).toBe(true);
    expect(matchGlobstar('**', 'implement/foo.md')).toBe(true);
  });

  it('matches **/*.md at any depth', () => {
    expect(matchGlobstar('**/*.md', 'notes.md')).toBe(true);
    expect(matchGlobstar('**/*.md', 'implement/task.md')).toBe(true);
    expect(matchGlobstar('**/*.md', 'implement/task.txt')).toBe(false);
  });

  it('matches prefix/** under a subdirectory', () => {
    expect(matchGlobstar('implement/**', 'implement/foo.md')).toBe(true);
    expect(matchGlobstar('implement/**', 'implement/a/b.md')).toBe(true);
    expect(matchGlobstar('implement/**', 'review/foo.md')).toBe(false);
  });
});

describe('assertNoFlattenCollisions', () => {
  it('throws when multiple source paths share a basename', () => {
    expect(() => assertNoFlattenCollisions([
      { name: 'a.md', sourcePath: 'foo/a.md' },
      { name: 'a.md', sourcePath: 'bar/a.md' },
    ])).toThrow(/flattening collision/);
  });

  it('passes when basenames are unique', () => {
    expect(() => assertNoFlattenCollisions([
      { name: 'a.md', sourcePath: 'foo/a.md' },
      { name: 'b.md', sourcePath: 'bar/b.md' },
    ])).not.toThrow();
  });
});
