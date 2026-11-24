import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, makeTempDirs, populateSource, setupConfig, type TestDirs } from './helpers.js';

describe('ghost interactive abort', () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = makeTempDirs();
    process.env.SCOPY_CONFIG_DIR = dirs.config;
    process.env.SCOPY_DATA_DIR = dirs.data;
    await setupConfig(dirs);
    populateSource(dirs.source, { 'a.txt': 'alpha' });
    const { handleSync } = await import('../src/commands/sync.js');
    await handleSync('test-src', 'test-dst', {});
  });

  afterEach(() => {
    delete process.env.SCOPY_CONFIG_DIR;
    delete process.env.SCOPY_DATA_DIR;
    cleanup(dirs);
    vi.doUnmock('@inquirer/checkbox');
    vi.resetModules();
  });

  async function ghostWithPrompt(prompt: (cfg: unknown, ctx: { signal: AbortSignal }) => Promise<unknown>): Promise<void> {
    vi.doMock('@inquirer/checkbox', async (orig) => ({ ...(await orig<object>()), default: prompt }));
    const { handleGhost } = await import('../src/commands/ghost.js');
    await handleGhost('test-dst', undefined);
  }

  function expectUntouched(): void {
    expect(fs.readFileSync(path.join(dirs.dest, 'a.txt'), 'utf8')).toBe('alpha');
  }

  it('Ctrl+C (ExitPromptError) aborts cleanly without changes', async () => {
    await ghostWithPrompt(() => Promise.reject(Object.assign(new Error('x'), { name: 'ExitPromptError' })));
    expectUntouched();
  });

  it('Esc keypress aborts the prompt without changes and removes its listener', async () => {
    const before = process.stdin.listenerCount('keypress');
    const run = ghostWithPrompt((_cfg, ctx) => new Promise((_, reject) => {
      ctx.signal.addEventListener('abort', () => reject(Object.assign(new Error('x'), { name: 'AbortPromptError' })));
      setTimeout(() => process.stdin.emit('keypress', undefined, { name: 'escape' }), 0);
    }));
    await run;
    expectUntouched();
    expect(process.stdin.listenerCount('keypress')).toBe(before);
  });

  it('other prompt errors still propagate', async () => {
    await expect(ghostWithPrompt(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  });
});
