import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { cleanup, makeTempDirs, populateSource, setupConfig, type TestDirs } from './helpers.js';

describe('dest rename', () => {
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
    const register = (await import('../src/commands/dest.js')).default;
    const program = new Command();
    program.exitOverride();
    register(program);
    await program.parseAsync(['node', 'scopy', 'dest', ...args]);
  }

  function output(): string {
    return logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
  }

  async function syncFile(name = 'a.txt', content = 'alpha'): Promise<void> {
    populateSource(dirs.source, { [name]: content });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', {});
  }

  it('renames the destination, keeps its location, and reports success', async () => {
    await run('rename', 'test-dst', 'new-dst');

    const { getDestinations } = await import('../src/config.js');
    expect(getDestinations()).toEqual([{ name: 'new-dst', location: dirs.dest }]);
    expect(output()).toContain('Destination "test-dst" renamed to "new-dst"');
  });

  it('updates copy records and moves the cache directory', async () => {
    await syncFile();
    const { getCopies, fileCacheDir, fileCachePath } = await import('../src/config.js');
    const index = getCopies()[0].index!;
    expect(fs.existsSync(fileCachePath('test-dst', index))).toBe(true);

    await run('rename', 'test-dst', 'new-dst');

    expect(getCopies().map((r) => r.destination)).toEqual(['new-dst']);
    expect(fs.existsSync(fileCacheDir('test-dst'))).toBe(false);
    expect(fs.readFileSync(fileCachePath('new-dst', index), 'utf8')).toBe('alpha');
    expect(fs.readFileSync(path.join(dirs.dest, 'a.txt'), 'utf8')).toBe('alpha');
  });

  it('ghost then unghost under the new name restores the file', async () => {
    await syncFile();
    const { getCopies } = await import('../src/config.js');
    const index = getCopies()[0].index!;
    await run('rename', 'test-dst', 'new-dst');

    const { handleGhost } = await import('../src/commands/ghost.js');
    const destFile = path.join(dirs.dest, 'a.txt');
    await handleGhost('new-dst', String(index));
    expect(fs.existsSync(destFile)).toBe(false);
    expect(getCopies()[0].ghosted).toBe(true);

    await handleGhost('new-dst', String(index));
    expect(fs.readFileSync(destFile, 'utf8')).toBe('alpha');
    expect(getCopies()[0].ghosted).toBe(false);
  });

  it('log shows the files under the new name only', async () => {
    await syncFile();
    await run('rename', 'test-dst', 'new-dst');
    logSpy.mockClear();

    const registerLog = (await import('../src/commands/log.js')).default;
    const program = new Command();
    program.exitOverride();
    registerLog(program);
    await program.parseAsync(['node', 'scopy', 'log']);

    const out = output();
    expect(out).toContain('new-dst');
    expect(out).toContain('a.txt');
    expect(out).not.toContain('test-dst');
  });

  it('leaves other destinations, their records and their cache untouched', async () => {
    await syncFile();
    const { addDestination, addCopy, getDestinations, getCopies, fileCacheDir } = await import('../src/config.js');
    const other = path.join(path.dirname(dirs.dest), 'dest2');
    fs.mkdirSync(other, { recursive: true });
    addDestination({ name: 'other-dst', location: other });
    addCopy({ source: 'test-src', destination: 'other-dst', file: 'b.txt' });
    fs.mkdirSync(fileCacheDir('other-dst'), { recursive: true });
    fs.writeFileSync(path.join(fileCacheDir('other-dst'), 'marker'), 'x');

    await run('rename', 'test-dst', 'new-dst');

    expect(getDestinations()).toEqual([
      { name: 'new-dst', location: dirs.dest },
      { name: 'other-dst', location: other },
    ]);
    expect(getCopies().find((r) => r.file === 'b.txt')?.destination).toBe('other-dst');
    expect(fs.readFileSync(path.join(fileCacheDir('other-dst'), 'marker'), 'utf8')).toBe('x');
  });

  it('renames a destination that has no records and no cache directory', async () => {
    await run('rename', 'test-dst', 'new-dst');

    const { getDestinations } = await import('../src/config.js');
    expect(getDestinations().map((d) => d.name)).toEqual(['new-dst']);
  });

  it('rejects an unregistered old name', async () => {
    await run('rename', 'missing', 'new-dst');

    const { getDestinations } = await import('../src/config.js');
    expect(getDestinations().map((d) => d.name)).toEqual(['test-dst']);
    expect(output()).toContain('destination "missing" not found');
  });

  it('rejects renaming to the same name', async () => {
    await syncFile();
    await run('rename', 'test-dst', 'test-dst');

    const { getDestinations, getCopies } = await import('../src/config.js');
    expect(getDestinations().map((d) => d.name)).toEqual(['test-dst']);
    expect(getCopies()[0].destination).toBe('test-dst');
    expect(output()).not.toContain('renamed');
    expect(output()).toContain('❌');
  });

  it('rejects a new name that is already registered and changes nothing', async () => {
    await syncFile();
    const { addDestination, getDestinations, getCopies, fileCacheDir } = await import('../src/config.js');
    addDestination({ name: 'taken', location: path.join(dirs.data, 'taken-dir') });

    await run('rename', 'test-dst', 'taken');

    expect(getDestinations().map((d) => d.name)).toEqual(['test-dst', 'taken']);
    expect(getCopies()[0].destination).toBe('test-dst');
    expect(fs.existsSync(fileCacheDir('test-dst'))).toBe(true);
    expect(output()).toContain('destination "taken" already exists');
  });

  it('rejects a new name that escapes the cache root', async () => {
    await syncFile();
    const { getDestinations, getCopies, fileCacheDir } = await import('../src/config.js');

    await run('rename', 'test-dst', '../x');

    expect(getDestinations().map((d) => d.name)).toEqual(['test-dst']);
    expect(getCopies()[0].destination).toBe('test-dst');
    expect(fs.existsSync(fileCacheDir('test-dst'))).toBe(true);
    expect(fs.existsSync(path.join(dirs.data, 'x'))).toBe(false);
    expect(output()).toContain('❌');
    expect(output()).not.toContain('renamed');
  });

  it('refuses a new name that has orphan copy records and shows the purge hint', async () => {
    await syncFile();
    const { addCopy, getDestinations, getCopies } = await import('../src/config.js');
    addCopy({ source: 'test-src', destination: 'orphan-dst', file: 'old.txt' });

    await run('rename', 'test-dst', 'orphan-dst');

    expect(getDestinations().map((d) => d.name)).toEqual(['test-dst']);
    expect(getCopies().find((r) => r.file === 'a.txt')?.destination).toBe('test-dst');
    expect(getCopies().find((r) => r.file === 'old.txt')?.destination).toBe('orphan-dst');
    expect(output()).toContain("run 'scopy purge log orphan-dst' first");
  });

  it('refuses a new name that has an orphan cache directory and shows the purge hint', async () => {
    await syncFile();
    const { getDestinations, getCopies, fileCacheDir, fileCachePath } = await import('../src/config.js');
    const index = getCopies()[0].index!;
    fs.mkdirSync(fileCacheDir('orphan-dst'), { recursive: true });
    fs.writeFileSync(path.join(fileCacheDir('orphan-dst'), '99'), 'stale');

    await run('rename', 'test-dst', 'orphan-dst');

    expect(getDestinations().map((d) => d.name)).toEqual(['test-dst']);
    expect(getCopies()[0].destination).toBe('test-dst');
    expect(fs.existsSync(fileCachePath('test-dst', index))).toBe(true);
    expect(fs.readFileSync(path.join(fileCacheDir('orphan-dst'), '99'), 'utf8')).toBe('stale');
    expect(output()).toContain("run 'scopy purge log orphan-dst' first");
  });
});
