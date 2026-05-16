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


describe('ghost', () => {
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

  it('ghost removes file from dest, sets ghosted=true', async () => {
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', {});

    const { getCopies } = await import('../src/config.js');
    const index = getCopies()[0].index!;
    const destFile = path.join(dirs.dest, 'a.txt');
    expect(fs.readFileSync(destFile, 'utf8')).toBe('alpha');

    const { handleGhost } = await import('../src/commands/ghost.js');
    await handleGhost('test-dst', String(index));

    expect(fs.existsSync(destFile)).toBe(false);
    const record = getCopies()[0];
    expect(record.ghosted).toBe(true);
  });

  it('restore copies from cache back to dest, sets ghosted=false', async () => {
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', {});

    const { getCopies } = await import('../src/config.js');
    const index = getCopies()[0].index!;

    const { handleGhost } = await import('../src/commands/ghost.js');
    await handleGhost('test-dst', String(index));

    const beforeRestore = getCopies()[0];
    expect(beforeRestore.ghosted).toBe(true);
    const beforeCopiedAt = beforeRestore.copiedAt;

    await handleGhost('test-dst', String(index));

    const destFile = path.join(dirs.dest, 'a.txt');
    expect(fs.existsSync(destFile)).toBe(true);
    expect(fs.readFileSync(destFile, 'utf8')).toBe('alpha');

    const afterRestore = getCopies()[0];
    expect(afterRestore.ghosted).toBe(false);
    expect(afterRestore.copiedAt).not.toBe(beforeCopiedAt);
  });

  it('restore errors when cache missing', async () => {
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', {});

    const { getCopies } = await import('../src/config.js');
    const index = getCopies()[0].index!;

    const { handleGhost } = await import('../src/commands/ghost.js');
    await handleGhost('test-dst', String(index));

    const destFile = path.join(dirs.dest, 'a.txt');
    expect(fs.existsSync(destFile)).toBe(false);

    const { fileCachePath } = await import('../src/config.js');
    fs.rmSync(fileCachePath('test-dst', index));

    await expect(
      handleGhost('test-dst', String(index)),
    ).resolves.toBeUndefined();

    expect(fs.existsSync(destFile)).toBe(false);
  });

  it('errors on invalid index', async () => {
    const { handleGhost } = await import('../src/commands/ghost.js');

    await expect(
      handleGhost('test-dst', '999'),
    ).resolves.toBeUndefined();

    expect(fs.readdirSync(dirs.dest)).toHaveLength(0);
  });

  it('errors on unregistered destination', async () => {
    const { handleGhost } = await import('../src/commands/ghost.js');

    await expect(
      handleGhost('no-such-dest', '1'),
    ).resolves.toBeUndefined();

    expect(fs.readdirSync(dirs.dest)).toHaveLength(0);
  });

  it('ghost by exact filename removes file, sets ghosted=true', async () => {
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', {});

    const { getCopies } = await import('../src/config.js');
    const destFile = path.join(dirs.dest, 'a.txt');
    expect(fs.existsSync(destFile)).toBe(true);

    const { handleGhost } = await import('../src/commands/ghost.js');
    await handleGhost('test-dst', 'a.txt');

    expect(fs.existsSync(destFile)).toBe(false);
    expect(getCopies()[0].ghosted).toBe(true);
  });

  it('ghost by wildcard * ghosts all files independently', async () => {
    populateSource(dirs.source, { 'a.txt': 'alpha', 'b.txt': 'bravo' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', {});

    const { getCopies } = await import('../src/config.js');
    const destA = path.join(dirs.dest, 'a.txt');
    const destB = path.join(dirs.dest, 'b.txt');
    expect(fs.existsSync(destA)).toBe(true);
    expect(fs.existsSync(destB)).toBe(true);

    const { handleGhost } = await import('../src/commands/ghost.js');
    await handleGhost('test-dst', '*');

    expect(fs.existsSync(destA)).toBe(false);
    expect(fs.existsSync(destB)).toBe(false);
    const copies = getCopies();
    expect(copies.every((r) => r.ghosted === true)).toBe(true);
  });

  it('ghost by prefix wildcard ghosts only matching files', async () => {
    populateSource(dirs.source, { 'task-a.md': 'ta', 'task-b.md': 'tb', 'other.md': 'o' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', {});

    const { getCopies } = await import('../src/config.js');
    const destTaskA = path.join(dirs.dest, 'task-a.md');
    const destTaskB = path.join(dirs.dest, 'task-b.md');
    const destOther = path.join(dirs.dest, 'other.md');

    const { handleGhost } = await import('../src/commands/ghost.js');
    await handleGhost('test-dst', 'task-*');

    expect(fs.existsSync(destTaskA)).toBe(false);
    expect(fs.existsSync(destTaskB)).toBe(false);
    expect(fs.existsSync(destOther)).toBe(true);

    const copies = getCopies();
    const taskA = copies.find((r) => r.file === 'task-a.md');
    const taskB = copies.find((r) => r.file === 'task-b.md');
    const other = copies.find((r) => r.file === 'other.md');
    expect(taskA?.ghosted).toBe(true);
    expect(taskB?.ghosted).toBe(true);
    expect(other?.ghosted).toBe(false);
  });

  it('ghost by wildcard with no match is a no-op', async () => {
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', {});

    const { getCopies } = await import('../src/config.js');
    const destFile = path.join(dirs.dest, 'a.txt');

    const { handleGhost } = await import('../src/commands/ghost.js');
    await handleGhost('test-dst', 'nomatch-*');

    expect(fs.existsSync(destFile)).toBe(true);
    expect(getCopies()[0].ghosted).toBe(false);
  });
});
