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

  it('filters by multi-wildcard glob (*.zsh*)', async () => {
    const mockEntries = [
      { type: 'file', name: '.zshrc', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/.zshrc' },
      { type: 'file', name: '.zshenv', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/.zshenv' },
      { type: 'file', name: 'foo.zsh.bak', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/foo.zsh.bak' },
      { type: 'file', name: 'foo.txt', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/foo.txt' },
      { type: 'file', name: 'readme.md', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/readme.md' },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockEntries,
    } as Response);

    const { fetchGitHubFiles } = await import('../src/commands/sync.js');
    const result = await fetchGitHubFiles('owner', 'repo', '', '*.zsh*');

    expect(result.map(f => f.name)).toEqual(expect.arrayContaining(['.zshrc', '.zshenv', 'foo.zsh.bak']));
    expect(result.map(f => f.name)).not.toContain('foo.txt');
    expect(result.map(f => f.name)).not.toContain('readme.md');
    expect(result).toHaveLength(3);
  });

  it('handles glob with subdir prefix (subdir/*.zsh*)', async () => {
    const mockEntries = [
      { type: 'file', name: '.zshrc', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/subdir/.zshrc' },
      { type: 'file', name: 'foo.zsh.bak', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/subdir/foo.zsh.bak' },
      { type: 'file', name: 'foo.txt', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/subdir/foo.txt' },
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockEntries,
    } as Response);

    const { fetchGitHubFiles } = await import('../src/commands/sync.js');
    const result = await fetchGitHubFiles('owner', 'repo', '', 'subdir/*.zsh*');

    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('subdir'), expect.anything());
    expect(result.map(f => f.name)).toEqual(expect.arrayContaining(['.zshrc', 'foo.zsh.bak']));
    expect(result.map(f => f.name)).not.toContain('foo.txt');
    expect(result).toHaveLength(2);
  });

  it('throws on non-ok GitHub API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const { fetchGitHubFiles } = await import('../src/commands/sync.js');
    await expect(fetchGitHubFiles('owner', 'repo', '', undefined)).rejects.toThrow('404');
  });

  it('recursively fetches **/*.md via git trees API', async () => {
    const mockTree = {
      tree: [
        { path: 'root.md', type: 'blob' },
        { path: 'implement/a.md', type: 'blob' },
        { path: 'implement/b.txt', type: 'blob' },
        { path: 'implement/nested/c.md', type: 'blob' },
      ],
      truncated: false,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockTree,
    } as Response);

    const { fetchGitHubFiles } = await import('../src/commands/sync.js');
    const result = await fetchGitHubFiles('owner', 'repo', '', '**/*.md');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/git/trees/HEAD?recursive=1'),
      expect.anything(),
    );
    expect(result.map((f) => f.name)).toEqual(expect.arrayContaining(['root.md', 'a.md', 'c.md']));
    expect(result.map((f) => f.name)).not.toContain('b.txt');
    expect(result).toHaveLength(3);
    expect(result.find((f) => f.name === 'c.md')?.relativePath).toBe('implement/nested/c.md');
  });

  it('aborts ** git fetch on basename collision', async () => {
    const mockTree = {
      tree: [
        { path: 'foo/a.md', type: 'blob' },
        { path: 'bar/a.md', type: 'blob' },
      ],
      truncated: false,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockTree,
    } as Response);

    const { fetchGitHubFiles } = await import('../src/commands/sync.js');
    await expect(fetchGitHubFiles('owner', 'repo', '', '**/*.md')).rejects.toThrow(/flattening collision/);
  });
});
