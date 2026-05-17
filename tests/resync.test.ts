import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  makeTempDirs,
  populateSource,
  setupConfig,
  type TestDirs,
} from './helpers.js';

describe('resync', () => {
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
    vi.restoreAllMocks();
  });

  it('re-copies active files from source', async () => {
    // Seed: sync a.txt to test-dst
    populateSource(dirs.source, { 'a.txt': 'original' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', { force: true });

    // Record copiedAt from the registry
    const { getCopies } = await import('../src/config.js');
    const firstCopiedAt = getCopies()[0].copiedAt;

    // Wait 2ms so timestamps differ
    await new Promise((resolve) => setTimeout(resolve, 2));

    // Overwrite source file with new content
    fs.writeFileSync(path.join(dirs.source, 'a.txt'), 'updated');

    // Run handleResync
    const { handleResync } = await import('../src/commands/resync.js');
    await handleResync('test-dst', {});

    // Assert dest file has new content
    expect(fs.readFileSync(path.join(dirs.dest, 'a.txt'), 'utf8')).toBe('updated');

    // Assert copiedAt is different (newer)
    const secondCopiedAt = getCopies()[0].copiedAt;
    expect(secondCopiedAt).not.toBe(firstCopiedAt);
  });

  it('skips records whose source is no longer registered', async () => {
    // Seed: one valid file + one entry referencing a removed source
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', { force: true });

    const { addCopy } = await import('../src/config.js');
    addCopy({ source: 'removed-src', destination: 'test-dst', file: 'ghost.txt', copiedAt: new Date().toISOString() });

    process.exitCode = 0;

    const { handleResync } = await import('../src/commands/resync.js');
    await handleResync('test-dst', {});

    expect(fs.existsSync(path.join(dirs.dest, 'a.txt'))).toBe(true);
    expect(fs.existsSync(path.join(dirs.dest, 'ghost.txt'))).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('skips ghosted files', async () => {
    // Seed: sync a.txt and b.txt; ghost b.txt; run resync; assert b.txt stays absent
    populateSource(dirs.source, { 'a.txt': 'alpha', 'b.txt': 'bravo' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', { force: true });

    const { getCopies, setGhosted } = await import('../src/config.js');
    const entry = getCopies().find((r) => r.file === 'b.txt');
    if (entry === undefined || entry.index === undefined) throw new Error('b.txt entry missing index');
    setGhosted('test-dst', entry.index, true);

    fs.rmSync(path.join(dirs.dest, 'b.txt'));

    const { handleResync } = await import('../src/commands/resync.js');
    await handleResync('test-dst', {});

    expect(fs.existsSync(path.join(dirs.dest, 'a.txt'))).toBe(true);
    expect(fs.existsSync(path.join(dirs.dest, 'b.txt'))).toBe(false);
  });

  it('--unghost errors when cache file is missing', async () => {
    // Seed: sync a.txt; ghost it; delete cache file; run resync --unghost
    // Assert: error reported; file not written to dest; process.exitCode = 1
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', { force: true });

    const { getCopies, setGhosted, fileCachePath } = await import('../src/config.js');
    const entry = getCopies().find((r) => r.file === 'a.txt');
    if (entry === undefined || entry.index === undefined) throw new Error('a.txt entry missing index');
    const index = entry.index;

    fs.rmSync(fileCachePath('test-dst', index), { force: true });
    setGhosted('test-dst', index, true);
    fs.rmSync(path.join(dirs.dest, 'a.txt'));

    process.exitCode = 0;

    const { handleResync } = await import('../src/commands/resync.js');
    await handleResync('test-dst', { unghost: true });

    expect(fs.existsSync(path.join(dirs.dest, 'a.txt'))).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('--dry-run lists files without copying', async () => {
    // Seed: sync a.txt; delete from dest; run resync --dry-run
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', { force: true });

    const { getCopies } = await import('../src/config.js');
    const copiedAt = getCopies()[0].copiedAt;

    fs.rmSync(path.join(dirs.dest, 'a.txt'));

    const { handleResync } = await import('../src/commands/resync.js');
    await handleResync('test-dst', { dryRun: true });

    // a.txt should NOT be restored
    expect(fs.existsSync(path.join(dirs.dest, 'a.txt'))).toBe(false);

    // copiedAt should be unchanged
    expect(getCopies()[0].copiedAt).toBe(copiedAt);
  });

  it('re-copies files from git source using sourcePath', async () => {
    const { addSource, addDestination, addCopy } = await import('../src/config.js');
    addSource({ type: 'git', name: 'git-src', location: 'https://github.com/owner/repo', path: '/agents' });
    addDestination({ name: 'git-dst', location: dirs.dest });
    addCopy({ source: 'git-src', destination: 'git-dst', file: 'a.md', sourcePath: 'implement/a.md', copiedAt: new Date().toISOString() });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('api.github.com')) {
        return { ok: true, json: async () => ({ type: 'file', name: 'a.md', download_url: 'https://raw.githubusercontent.com/owner/repo/main/agents/implement/a.md' }) } as Response;
      }
      return { ok: true, arrayBuffer: async () => new Uint8Array(Buffer.from('updated')).buffer } as Response;
    });

    const { handleResync } = await import('../src/commands/resync.js');
    await handleResync('git-dst', {});

    expect(fs.existsSync(path.join(dirs.dest, 'a.md'))).toBe(true);
    expect(fs.readFileSync(path.join(dirs.dest, 'a.md'), 'utf8')).toBe('updated');
  });

  it('builds Contents API URL from sourcePath, not bare filename', async () => {
    const { addSource, addDestination, addCopy } = await import('../src/config.js');
    addSource({ type: 'git', name: 'git-src', location: 'https://github.com/owner/repo', path: '/agents' });
    addDestination({ name: 'git-dst', location: dirs.dest });
    addCopy({ source: 'git-src', destination: 'git-dst', file: 'a.md', sourcePath: 'implement/a.md', copiedAt: new Date().toISOString() });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('api.github.com')) {
        return { ok: true, json: async () => ({ type: 'file', name: 'a.md', download_url: 'https://raw.githubusercontent.com/owner/repo/main/agents/implement/a.md' }) } as Response;
      }
      return { ok: true, arrayBuffer: async () => new Uint8Array(Buffer.from('updated')).buffer } as Response;
    });

    const { handleResync } = await import('../src/commands/resync.js');
    await handleResync('git-dst', {});

    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('agents/implement/a.md'))).toBe(true);
    expect(urls.every((u) => !u.includes('agents/a.md'))).toBe(true);
  });

  it('reports HTTP 404 when git file not found', async () => {
    const { addSource, addDestination, addCopy } = await import('../src/config.js');
    addSource({ type: 'git', name: 'git-src', location: 'https://github.com/owner/repo', path: '/agents' });
    addDestination({ name: 'git-dst', location: dirs.dest });
    addCopy({ source: 'git-src', destination: 'git-dst', file: 'missing.md', sourcePath: 'implement/missing.md', copiedAt: new Date().toISOString() });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return { ok: false, status: 404 } as Response;
    });

    process.exitCode = 0;

    const { handleResync } = await import('../src/commands/resync.js');
    await handleResync('git-dst', {});

    expect(process.exitCode).toBe(1);
    expect(fs.existsSync(path.join(dirs.dest, 'missing.md'))).toBe(false);
  });

  it('--unghost restores ghosted files from cache, ignores active files', async () => {
    // Seed: sync a.txt and b.txt; ghost b.txt; run resync --unghost
    // Assert: b.txt restored in dest; ghosted=false; a.txt untouched
    populateSource(dirs.source, { 'a.txt': 'alpha', 'b.txt': 'bravo' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', { force: true });

    const { getCopies, setGhosted } = await import('../src/config.js');
    const entry = getCopies().find((r) => r.file === 'b.txt');
    if (entry === undefined || entry.index === undefined) throw new Error('b.txt entry missing index');
    setGhosted('test-dst', entry.index, true);
    fs.rmSync(path.join(dirs.dest, 'b.txt'));

    // Also delete a.txt from dest to verify unghost doesn't re-copy active files
    fs.rmSync(path.join(dirs.dest, 'a.txt'));

    const { handleResync } = await import('../src/commands/resync.js');
    await handleResync('test-dst', { unghost: true });

    // b.txt should be restored from cache with correct content
    expect(fs.existsSync(path.join(dirs.dest, 'b.txt'))).toBe(true);
    expect(fs.readFileSync(path.join(dirs.dest, 'b.txt'), 'utf8')).toBe('bravo');

    // b.txt registry entry should no longer be ghosted
    const bEntry = getCopies().find((r) => r.file === 'b.txt');
    expect(bEntry?.ghosted).toBe(false);

    // a.txt should NOT be restored (unghost only restores ghosted files)
    expect(fs.existsSync(path.join(dirs.dest, 'a.txt'))).toBe(false);
  });
});
