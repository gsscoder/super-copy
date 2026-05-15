import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  makeTempDirs,
  populateSource,
  setupConfig,
  type TestDirs,
} from './helpers.js';

describe('purge', () => {
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

  it('purge log * removes all entries', async () => {
    // Seed: two entries for different destinations
    const { addCopy, addDestination } = await import('../src/config.js');
    addDestination({ name: 'test-dst2', location: path.join(dirs.data, 'dest2') });
    addCopy({ source: 'test-src', destination: 'test-dst', file: 'a.txt', copiedAt: new Date().toISOString() });
    addCopy({ source: 'test-src', destination: 'test-dst2', file: 'b.txt', copiedAt: new Date().toISOString() });

    // Run purge log *
    const { handlePurgeLog } = await import('../src/commands/purge.js');
    handlePurgeLog('*', { dryRun: false });

    // Assert all entries removed
    const { getCopies } = await import('../src/config.js');
    expect(getCopies()).toEqual([]);
  });

  it('purge log <dest> removes only that destination\'s entries', async () => {
    // Seed: entries for test-dst and test-dst2
    const { addCopy, addDestination } = await import('../src/config.js');
    addDestination({ name: 'test-dst2', location: path.join(dirs.data, 'dest2') });
    addCopy({ source: 'test-src', destination: 'test-dst', file: 'a.txt', copiedAt: new Date().toISOString() });
    addCopy({ source: 'test-src', destination: 'test-dst2', file: 'b.txt', copiedAt: new Date().toISOString() });

    // Run purge log test-dst
    const { handlePurgeLog } = await import('../src/commands/purge.js');
    handlePurgeLog('test-dst', { dryRun: false });

    // Assert test-dst entries gone, test-dst2 entries intact
    const { getCopies } = await import('../src/config.js');
    const remaining = getCopies();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].file).toBe('b.txt');
    expect(remaining[0].destination).toBe('test-dst2');
  });

  it('purge log --dry-run does not mutate registry', async () => {
    // Seed: one entry via addCopy
    const { addCopy } = await import('../src/config.js');
    addCopy({ source: 'test-src', destination: 'test-dst', file: 'a.txt', copiedAt: new Date().toISOString() });

    // Run purge log * --dry-run
    const { handlePurgeLog } = await import('../src/commands/purge.js');
    handlePurgeLog('*', { dryRun: true });

    // Assert entry still present
    const { getCopies } = await import('../src/config.js');
    expect(getCopies()).toHaveLength(1);
  });

  it('purge log with no dest prints no-op, mutates nothing', async () => {
    // Seed: one entry via addCopy
    const { addCopy } = await import('../src/config.js');
    addCopy({ source: 'test-src', destination: 'test-dst', file: 'a.txt', copiedAt: new Date().toISOString() });

    // Run purge log with no dest
    const { handlePurgeLog } = await import('../src/commands/purge.js');
    handlePurgeLog(undefined, { dryRun: false });

    // Assert entry still present
    const { getCopies } = await import('../src/config.js');
    expect(getCopies()).toHaveLength(1);
  });

});
