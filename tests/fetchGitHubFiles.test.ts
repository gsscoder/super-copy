import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, makeTempDirs, type TestDirs } from './helpers.js';

describe('fetchGitHubFiles', () => {
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
    vi.restoreAllMocks();
  });

  it('returns files from directory listing', async () => {
    const mockEntries = [
      { type: 'file', name: 'foo.md', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/foo.md' },
      { type: 'file', name: 'bar.txt', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/bar.txt' },
      { type: 'dir', name: 'subdir', download_url: null },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockEntries,
    } as Response);

    const { fetchGitHubFiles } = await import('../src/commands/sync.js');
    const result = await fetchGitHubFiles('owner', 'repo', '', undefined);

    expect(result).toHaveLength(2);
    expect(result.map(f => f.name)).toEqual(expect.arrayContaining(['foo.md', 'bar.txt']));
  });

  it('filters by glob pattern', async () => {
    const mockEntries = [
      { type: 'file', name: 'foo.md', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/foo.md' },
      { type: 'file', name: 'bar.txt', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/bar.txt' },
      { type: 'file', name: 'baz.md', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/baz.md' },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockEntries,
    } as Response);

    const { fetchGitHubFiles } = await import('../src/commands/sync.js');
    const result = await fetchGitHubFiles('owner', 'repo', '', '*.md');

    expect(result).toHaveLength(2);
    expect(result.map(f => f.name)).toEqual(expect.arrayContaining(['foo.md', 'baz.md']));
    expect(result.map(f => f.name)).not.toContain('bar.txt');
  });

  it('throws on non-ok GitHub API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const { fetchGitHubFiles } = await import('../src/commands/sync.js');
    await expect(fetchGitHubFiles('owner', 'repo', '', undefined)).rejects.toThrow('404');
  });
});
