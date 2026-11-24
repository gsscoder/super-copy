import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { cleanup, makeTempDirs, populateSource, setupConfig, type TestDirs } from './helpers.js';

describe('source add', () => {
  let dirs: TestDirs;

  beforeEach(() => {
    dirs = makeTempDirs();
    process.env.SCOPY_CONFIG_DIR = dirs.config;
    process.env.SCOPY_DATA_DIR = dirs.data;
  });

  afterEach(() => {
    delete process.env.SCOPY_CONFIG_DIR;
    delete process.env.SCOPY_DATA_DIR;
    cleanup(dirs);
    vi.resetModules();
  });

  it('accepts valid GitHub URL without subpath', async () => {
    const register = (await import('../src/commands/source.js')).default;
    const program = new Command();
    program.exitOverride();
    register(program);

    await program.parseAsync(['node', 'scopy', 'source', 'add', 'my-src', 'https://github.com/foo/bar']);

    const { getSources } = await import('../src/config.js');
    const sources = getSources();
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ type: 'git', name: 'my-src', location: 'https://github.com/foo/bar' });
  });

  it('accepts valid GitHub URL with subpath', async () => {
    const register = (await import('../src/commands/source.js')).default;
    const program = new Command();
    program.exitOverride();
    register(program);

    await program.parseAsync(['node', 'scopy', 'source', 'add', 'my-src', 'https://github.com/foo/bar/tree/main/agents']);

    const { getSources } = await import('../src/config.js');
    const sources = getSources();
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ type: 'git', name: 'my-src', location: 'https://github.com/foo/bar' });
    expect(sources[0].path).toBe('/tree/main/agents');
  });

  it('rejects non-GitHub https URL', async () => {
    const register = (await import('../src/commands/source.js')).default;
    const program = new Command();
    program.exitOverride();
    register(program);

    await program.parseAsync(['node', 'scopy', 'source', 'add', 'my-src', 'https://gitlab.com/foo/bar']);

    const { getSources } = await import('../src/config.js');
    expect(getSources()).toHaveLength(0);
  });

  it('rejects https URL with missing owner or repo', async () => {
    const register = (await import('../src/commands/source.js')).default;
    const program = new Command();
    program.exitOverride();
    register(program);

    await program.parseAsync(['node', 'scopy', 'source', 'add', 'my-src', 'https://github.com/onlyone']);

    const { getSources } = await import('../src/config.js');
    expect(getSources()).toHaveLength(0);
  });

  it('duplicate name is rejected', async () => {
    const register = (await import('../src/commands/source.js')).default;
    const program = new Command();
    program.exitOverride();
    register(program);

    await program.parseAsync(['node', 'scopy', 'source', 'add', 'my-src', 'https://github.com/foo/bar']);
    await program.parseAsync(['node', 'scopy', 'source', 'add', 'my-src', 'https://github.com/baz/qux']);

    const { getSources } = await import('../src/config.js');
    expect(getSources()).toHaveLength(1);
  });
});

describe('source rename', () => {
  let dirs: TestDirs;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dirs = makeTempDirs();
    process.env.SCOPY_CONFIG_DIR = dirs.config;
    process.env.SCOPY_DATA_DIR = dirs.data;
    await setupConfig(dirs);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    delete process.env.SCOPY_CONFIG_DIR;
    delete process.env.SCOPY_DATA_DIR;
    cleanup(dirs);
    vi.resetModules();
  });

  async function run(...args: string[]): Promise<void> {
    const register = (await import('../src/commands/source.js')).default;
    const program = new Command();
    program.exitOverride();
    register(program);
    await program.parseAsync(['node', 'scopy', 'source', ...args]);
  }

  function output(): string {
    return logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
  }

  it('renames the source, keeps its location, and reports success', async () => {
    await run('rename', 'test-src', 'new-src');

    const { getSources } = await import('../src/config.js');
    expect(getSources()).toEqual([{ type: 'local', name: 'new-src', location: dirs.source }]);
    expect(output()).toContain('Source "test-src" renamed to "new-src"');
  });

  it('updates the source name on copy records of the renamed source only', async () => {
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', {});
    const { addCopy, addSource, getCopies } = await import('../src/config.js');
    addSource({ type: 'local', name: 'other-src', location: dirs.source });
    addCopy({ source: 'other-src', destination: 'test-dst', file: 'other.txt' });

    await run('rename', 'test-src', 'new-src');

    const copies = getCopies();
    expect(copies.find((r) => r.file === 'a.txt')?.source).toBe('new-src');
    expect(copies.find((r) => r.file === 'other.txt')?.source).toBe('other-src');
    expect(copies.some((r) => r.source === 'test-src')).toBe(false);
  });

  it('leaves other registered sources untouched', async () => {
    const { addSource, getSources } = await import('../src/config.js');
    addSource({ type: 'git', name: 'git-src', location: 'https://github.com/foo/bar' });

    await run('rename', 'test-src', 'new-src');

    expect(getSources()).toEqual([
      { type: 'local', name: 'new-src', location: dirs.source },
      { type: 'git', name: 'git-src', location: 'https://github.com/foo/bar' },
    ]);
  });

  it('resync still copies from the renamed local source', async () => {
    populateSource(dirs.source, { 'a.txt': 'original' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', {});

    await run('rename', 'test-src', 'new-src');
    fs.writeFileSync(path.join(dirs.source, 'a.txt'), 'updated');
    const { handleResync } = await import('../src/commands/resync.js');
    await handleResync('test-dst', { dryRun: false, unghost: false, clean: false });

    expect(fs.readFileSync(path.join(dirs.dest, 'a.txt'), 'utf8')).toBe('updated');
    const { getCopies } = await import('../src/config.js');
    expect(getCopies()[0].source).toBe('new-src');
  });

  it('rejects an unregistered old name', async () => {
    await run('rename', 'missing', 'new-src');

    const { getSources } = await import('../src/config.js');
    expect(getSources().map((s) => s.name)).toEqual(['test-src']);
    expect(output()).toContain('source "missing" not found');
  });

  it('rejects renaming to the same name', async () => {
    await run('rename', 'test-src', 'test-src');

    const { getSources } = await import('../src/config.js');
    expect(getSources().map((s) => s.name)).toEqual(['test-src']);
    expect(output()).not.toContain('renamed');
    expect(output()).toContain('❌');
  });

  it('rejects a new name that is already registered and changes nothing', async () => {
    const { addSource, addCopy, getSources, getCopies } = await import('../src/config.js');
    addSource({ type: 'local', name: 'taken', location: dirs.source });
    addCopy({ source: 'test-src', destination: 'test-dst', file: 'a.txt' });

    await run('rename', 'test-src', 'taken');

    expect(getSources().map((s) => s.name)).toEqual(['test-src', 'taken']);
    expect(getCopies()[0].source).toBe('test-src');
    expect(output()).toContain('source "taken" already exists');
  });

  it('adopts orphan records of the new name, as source add does', async () => {
    const { addCopy, getCopies } = await import('../src/config.js');
    addCopy({ source: 'orphan-src', destination: 'test-dst', file: 'orphan.txt' });

    await run('rename', 'test-src', 'orphan-src');

    const { getSources } = await import('../src/config.js');
    expect(getSources().map((s) => s.name)).toEqual(['orphan-src']);
    expect(getCopies().find((r) => r.file === 'orphan.txt')?.source).toBe('orphan-src');
    expect(output()).toContain('Source "test-src" renamed to "orphan-src"');
  });
});
