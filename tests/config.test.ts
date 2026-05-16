import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, makeTempDirs, setupConfig, type TestDirs } from './helpers.js';

describe('config', () => {
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

  it('addCopy upserts by (destination, file): same source updates copiedAt, index unchanged', async () => {
    const { addCopy, getCopies } = await import('../src/config.js');

    const t1 = '2024-01-01T00:00:00.000Z';
    const t2 = '2024-06-01T00:00:00.000Z';

    addCopy({ source: 'test-src', destination: 'test-dst', file: 'f.txt', copiedAt: t1 });
    const indexAfterFirst = getCopies()[0].index;

    addCopy({ source: 'test-src', destination: 'test-dst', file: 'f.txt', copiedAt: t2 });
    const copies = getCopies();

    expect(copies).toHaveLength(1);
    expect(copies[0].copiedAt).toBe(t2);
    expect(copies[0].index).toBe(indexAfterFirst);
  });

  it('addCopy upserts by (destination, file): different source updates source, preserves index and ghosted', async () => {
    const { addCopy, getCopies } = await import('../src/config.js');

    addCopy({ source: 'src-a', destination: 'test-dst', file: 'f.txt', copiedAt: new Date().toISOString() });
    const first = getCopies()[0];
    const originalIndex = first.index;
    const originalGhosted = first.ghosted;

    addCopy({ source: 'src-b', destination: 'test-dst', file: 'f.txt', copiedAt: new Date().toISOString() });
    const copies = getCopies();

    expect(copies).toHaveLength(1);
    expect(copies[0].source).toBe('src-b');
    expect(copies[0].index).toBe(originalIndex);
    expect(copies[0].ghosted).toBe(originalGhosted);
    expect(copies[0].ghosted).toBe(false);
  });

  it('getNextIndex is global across all destinations', async () => {
    const { addCopy, addDestination, getCopies } = await import('../src/config.js');

    addDestination({ name: 'test-dst2', location: path.join(dirs.data, 'dest2') });

    addCopy({ source: 'test-src', destination: 'test-dst', file: 'a.txt', copiedAt: new Date().toISOString() });
    const idx1 = getCopies().find((c) => c.file === 'a.txt')!.index;

    addCopy({ source: 'test-src', destination: 'test-dst2', file: 'b.txt', copiedAt: new Date().toISOString() });
    const idx2 = getCopies().find((c) => c.file === 'b.txt')!.index;

    addCopy({ source: 'test-src', destination: 'test-dst', file: 'c.txt', copiedAt: new Date().toISOString() });
    const idx3 = getCopies().find((c) => c.file === 'c.txt')!.index;

    expect(idx1).toBe(1);
    expect(idx2).toBe(2);
    expect(idx3).toBe(3);
  });
});
