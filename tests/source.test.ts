import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { cleanup, makeTempDirs, type TestDirs } from './helpers.js';

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
