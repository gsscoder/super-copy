import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { cleanup, makeTempDirs, type TestDirs } from './helpers.js';

describe('config command', () => {
  let dirs: TestDirs;

  beforeEach(() => {
    dirs = makeTempDirs();
    process.env.SCOPY_CONFIG_DIR = dirs.config;
    process.env.SCOPY_DATA_DIR = dirs.data;
    process.exitCode = 0;
  });

  afterEach(() => {
    delete process.env.SCOPY_CONFIG_DIR;
    delete process.env.SCOPY_DATA_DIR;
    process.exitCode = 0;
    cleanup(dirs);
    vi.resetModules();
  });

  it('no key prints all prefs', async () => {
    const register = (await import('../src/commands/config.js')).default;
    const program = new Command();
    program.exitOverride();
    register(program);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'scopy', 'config']);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('sync.allowOverwrite='));
    expect(process.exitCode).toBe(0);

    logSpy.mockRestore();
  });

  it('unknown key errors and sets exitCode 1', async () => {
    const register = (await import('../src/commands/config.js')).default;
    const program = new Command();
    program.exitOverride();
    register(program);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'scopy', 'config', 'no.such.key']);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('unknown key'));
    expect(process.exitCode).toBe(1);

    logSpy.mockRestore();
  });

  it('valid key, no value prints current value', async () => {
    const register = (await import('../src/commands/config.js')).default;
    const program = new Command();
    program.exitOverride();
    register(program);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'scopy', 'config', 'sync.allowOverwrite']);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('sync.allowOverwrite='));
    expect(process.exitCode).toBe(0);

    logSpy.mockRestore();
  });

  it('valid key with invalid value errors and sets exitCode 1', async () => {
    const register = (await import('../src/commands/config.js')).default;
    const program = new Command();
    program.exitOverride();
    register(program);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'scopy', 'config', 'sync.allowOverwrite', 'notabool']);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('invalid value'));
    expect(process.exitCode).toBe(1);

    logSpy.mockRestore();
  });

  it('sync.allowOverwrite=true calls setPref and dismissTip', async () => {
    const register = (await import('../src/commands/config.js')).default;
    const program = new Command();
    program.exitOverride();
    register(program);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'scopy', 'config', 'sync.allowOverwrite', 'true']);

    const { getPref, isTipDismissed } = await import('../src/config.js');
    expect(getPref('sync.allowOverwrite')).toBe(true);
    expect(isTipDismissed('sync.allowOverwrite')).toBe(true);
    expect(process.exitCode).toBe(0);

    logSpy.mockRestore();
  });

  it('sync.allowOverwrite=false calls setPref but not dismissTip', async () => {
    const register = (await import('../src/commands/config.js')).default;
    const program = new Command();
    program.exitOverride();
    register(program);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'scopy', 'config', 'sync.allowOverwrite', 'false']);

    const { getPref, isTipDismissed } = await import('../src/config.js');
    expect(getPref('sync.allowOverwrite')).toBe(false);
    expect(isTipDismissed('sync.allowOverwrite')).toBe(false);
    expect(process.exitCode).toBe(0);

    logSpy.mockRestore();
  });
});
