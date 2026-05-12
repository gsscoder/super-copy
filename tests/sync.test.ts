import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  makeTempDirs,
  populateSource,
  registerGitSource,
  setupConfig,
  type TestDirs,
} from './helpers.js';

describe('sync', () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = makeTempDirs();
    process.env.SCOPY_CONFIG_DIR = dirs.config;
    process.env.SCOPY_DATA_DIR = dirs.data;
    await setupConfig(dirs);
  });

  afterEach(() => {
    delete process.env.SCOPY_CONFIG_DIR;
    delete process.env.SCOPY_DATA_DIR;
    cleanup(dirs);
    vi.resetModules();
  });

  // ── Test 1 ──
  it('copies all root files when no fileSpec', async () => {
    populateSource(dirs.source, { 'a.txt': 'alpha', 'b.txt': 'bravo' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', {});

    const destFiles = fs.readdirSync(dirs.dest);
    expect(destFiles).toEqual(expect.arrayContaining(['a.txt', 'b.txt']));
    expect(fs.readFileSync(path.join(dirs.dest, 'a.txt'), 'utf8')).toBe('alpha');
  });

  // ── Test 2 ──
  it('filters by glob pattern', async () => {
    populateSource(dirs.source, { 'a.md': 'md', 'b.txt': 'txt', 'c.md': 'md2' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src/*.md', 'test-dst', {});

    const destFiles = fs.readdirSync(dirs.dest);
    expect(destFiles).toEqual(expect.arrayContaining(['a.md', 'c.md']));
    expect(destFiles).not.toContain('b.txt');
    expect(destFiles).toHaveLength(2);
  });

  // ── Test 3 ──
  it('copies specific file by path', async () => {
    populateSource(dirs.source, { 'a.txt': 'alpha', 'b.txt': 'bravo' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src/a.txt', 'test-dst', {});

    const destFiles = fs.readdirSync(dirs.dest);
    expect(destFiles).toEqual(['a.txt']);
  });

  // ── Test 4 ──
  it('copies nested file preserving relative path', async () => {
    populateSource(dirs.source, { 'subdir/file.txt': 'nested' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src/subdir/file.txt', 'test-dst', {});

    const nestedPath = path.join(dirs.dest, 'subdir', 'file.txt');
    expect(fs.existsSync(nestedPath)).toBe(true);
    expect(fs.readFileSync(nestedPath, 'utf8')).toBe('nested');
  });

  // ── Test 5 ──
  it('dry-run does not write files', async () => {
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', { dryRun: true });

    expect(fs.existsSync(path.join(dirs.dest, 'a.txt'))).toBe(false);
  });

  // ── Test 6 ──
  it('force overwrites existing files', async () => {
    populateSource(dirs.source, { 'a.txt': 'new content' });
    // pre-create file in dest with old content
    fs.mkdirSync(dirs.dest, { recursive: true });
    fs.writeFileSync(path.join(dirs.dest, 'a.txt'), 'old content');

    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', { force: true });

    expect(fs.readFileSync(path.join(dirs.dest, 'a.txt'), 'utf8')).toBe('new content');
  });

  // ── Test 7 ──
  it('silent no-match — no files copied', async () => {
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src/nonexistent.txt', 'test-dst', {});

    expect(fs.readdirSync(dirs.dest)).toHaveLength(0);
  });

  // ── Test 8 ──
  it('errors on unregistered source', async () => {
    const { handleSync } = await import('../src/commands/sync.js');
    await expect(
      handleSync('no-such-source', 'test-dst', {}),
    ).resolves.toBeUndefined();

    expect(fs.readdirSync(dirs.dest)).toHaveLength(0);
  });

  // ── Test 9 ──
  it('errors on unregistered destination', async () => {
    const { handleSync } = await import('../src/commands/sync.js');
    await expect(
      handleSync('test-src', 'no-such-dest', {}),
    ).resolves.toBeUndefined();

    expect(fs.readdirSync(dirs.dest)).toHaveLength(0);
  });

  // ── Test 10 ──
  it('rejects path traversal in fileSpec', async () => {
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');

    // path traversal should not throw from handleSync (caught internally),
    // but no files should be written
    await expect(
      handleSync('test-src/../../etc', 'test-dst', {}),
    ).resolves.toBeUndefined();

    expect(fs.readdirSync(dirs.dest)).toHaveLength(0);
  });

  // ── Test 11 ──
  it('rejects non-http git URL at clone', async () => {
    // Fresh config with git source using non-http URL
    cleanup(dirs);
    vi.resetModules();
    dirs = makeTempDirs();
    process.env.SCOPY_CONFIG_DIR = dirs.config;
    process.env.SCOPY_DATA_DIR = dirs.data;
    await registerGitSource(dirs, 'ext::evil');

    const { handleSync } = await import('../src/commands/sync.js');
    await expect(
      handleSync('test-src', 'test-dst', {}),
    ).rejects.toThrow(/Refusing to clone/);
  });

  // ── Test 12 ──
  it('updates copies registry after copy', async () => {
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', {});

    const { getCopies } = await import('../src/config.js');
    const copies = getCopies();
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({
      source: 'test-src',
      destination: 'test-dst',
      file: 'a.txt',
    });
    expect(typeof copies[0].copiedAt).toBe('string');
  });
});
