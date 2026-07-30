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

  it('flattens single-file response for nested specific file path', async () => {
    const mockEntry = { type: 'file', name: 'CLAUDE.md', download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/subdir/CLAUDE.md' };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockEntry,
    } as Response);

    const { fetchGitHubFiles } = await import('../src/commands/sync.js');
    const result = await fetchGitHubFiles('owner', 'repo', '', 'subdir/CLAUDE.md');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('CLAUDE.md');
    expect(result[0].relativePath).toBe('subdir/CLAUDE.md');
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

  it('appends ?ref=<ref> to the Contents API URL when ref is provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    const { fetchGitHubFiles } = await import('../src/commands/sync.js');
    await fetchGitHubFiles('owner', 'repo', '', undefined, 'my-branch-sha');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/contents/?ref=my-branch-sha',
      expect.anything(),
    );
  });

  it('omits ?ref= from the Contents API URL when ref is undefined (regression guard)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    const { fetchGitHubFiles } = await import('../src/commands/sync.js');
    await fetchGitHubFiles('owner', 'repo', '', undefined, undefined);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/contents/',
      expect.anything(),
    );
  });

  it('uses ref instead of HEAD for the tree URL and raw download URLs in the globstar path', async () => {
    const mockTree = {
      tree: [
        { path: 'root.md', type: 'blob' },
      ],
      truncated: false,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockTree,
    } as Response);

    const { fetchGitHubFiles } = await import('../src/commands/sync.js');
    const result = await fetchGitHubFiles('owner', 'repo', '', '**/*.md', 'abc123sha');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/git/trees/abc123sha?recursive=1',
      expect.anything(),
    );
    expect(result).toHaveLength(1);
    expect(result[0].downloadUrl).toBe('https://raw.githubusercontent.com/owner/repo/abc123sha/root.md');
  });
});

describe('resolveBranchSha', () => {
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

  it('hits the commits/{branch} endpoint with the sha Accept header and returns the trimmed text body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => 'abc123sha\n',
    } as Response);

    const { resolveBranchSha } = await import('../src/github.js');
    const sha = await resolveBranchSha('owner', 'repo', 'feature-x');

    expect(sha).toBe('abc123sha');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/commits/feature-x',
      { headers: { Accept: 'application/vnd.github.sha', 'X-GitHub-Api-Version': '2022-11-28' } },
    );
  });

  it('throws a distinguishable error on 404 (branch not found)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const { resolveBranchSha } = await import('../src/github.js');
    await expect(resolveBranchSha('owner', 'repo', 'nope')).rejects.toThrow('branch "nope" not found in owner/repo');
  });

  it('throws a distinguishable error on other non-ok statuses (500)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const { resolveBranchSha } = await import('../src/github.js');
    await expect(resolveBranchSha('owner', 'repo', 'main')).rejects.toThrow('GitHub API error 500');
  });
});
