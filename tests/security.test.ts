/**
 * Security regression tests (expected to FAIL until the issues are fixed).
 *
 * SEC-1 (HIGH):   path traversal on write/delete through file names that contain
 *                 `..` segments or a backslash (Windows path separator).
 *                 Source: src/commands/sync.ts (git name join + write),
 *                 src/commands/resync.ts (write, --clean rmSync), src/commands/ghost.ts (rmSync, restore).
 * SEC-2 (MEDIUM): local sources follow symbolic links / junctions, so files outside
 *                 the source tree can be copied into the destination.
 *                 Source: src/commands/sync.ts (resolveFiles), src/commands/resync.ts (local source).
 *
 * Layout per test: <base>/{source,dest,config,data} (from makeTempDirs) plus <base>/outside,
 * a sentinel dir that the commands must never write to, delete from, or read from.
 * Everything lives in one temp dir that cleanup() removes.
 *
 * ASSUMPTION: a fixed implementation may reject (throw) or skip the bad name; the tests accept both,
 * and only assert on the unsafe outcome on the filesystem.
 * ASSUMPTION: backslash tests run on win32 only. On POSIX a backslash is a normal file name character.
 * SKIP: file symlink tests skip when the OS denies symlink creation (EPERM, no privilege on Windows).
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  makeTempDirs,
  populateSource,
  setupConfig,
  type TestDirs,
} from './helpers.js';

const SECRET = 'top-secret-outside-source';
const VICTIM = 'must-survive';
const IS_WINDOWS = process.platform === 'win32';
// Backslash is a path separator only on Windows.
const itWindows = it.skipIf(!IS_WINDOWS);

const swallow = (p: Promise<unknown>): Promise<unknown> => p.catch(() => undefined);

function trySymlinkFile(target: string, link: string): boolean {
  try {
    fs.symlinkSync(target, link, 'file');
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EPERM') return false;
    throw err;
  }
}

describe('security', () => {
  let dirs: TestDirs;
  let outside: string;

  beforeEach(async () => {
    dirs = makeTempDirs();
    outside = path.join(path.dirname(dirs.source), 'outside');
    fs.mkdirSync(outside, { recursive: true });
    process.env.SCOPY_CONFIG_DIR = dirs.config;
    process.env.SCOPY_DATA_DIR = dirs.data;
    await setupConfig(dirs);
  });

  afterEach(() => {
    delete process.env.SCOPY_CONFIG_DIR;
    delete process.env.SCOPY_DATA_DIR;
    process.exitCode = 0;
    cleanup(dirs);
    vi.resetModules();
    vi.restoreAllMocks();
  });

  async function addGitSource(): Promise<void> {
    const { addSource } = await import('../src/config.js');
    addSource({ type: 'git', name: 'git-src', location: 'https://github.com/owner/repo' });
  }

  async function seedRecord(file: string, sourcePath: string, source = 'test-src'): Promise<number> {
    const { addCopy, getCopies } = await import('../src/config.js');
    addCopy({ source, destination: 'test-dst', file, sourcePath, copiedAt: new Date().toISOString() });
    const index = getCopies().find((r) => r.file === file)?.index;
    if (index === undefined) throw new Error('seeded record has no index');
    return index;
  }

  describe('SEC-1 path traversal', () => {
    // SEC-1 HIGH: backslash traversal in a GitHub contents-API file name (sync, git source)
    itWindows('sync does not write outside dest for a git file name with backslash traversal', async () => {
      await addGitSource();
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('api.github.com')) {
          return {
            ok: true,
            json: async () => [{
              type: 'file',
              name: '..\\outside\\evil.txt',
              download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/evil',
            }],
          } as Response;
        }
        return { ok: true, arrayBuffer: async () => new Uint8Array(Buffer.from('evil')).buffer } as Response;
      });

      const { handleSync } = await import('../src/commands/sync.js');
      const { addDestination } = await import('../src/config.js');
      addDestination({ name: 'git-dst', location: dirs.dest });
      await swallow(handleSync('git-src', 'git-dst', { force: true }));

      expect(fs.existsSync(path.join(outside, 'evil.txt'))).toBe(false);
    });

    // SEC-1 HIGH: backslash traversal in a git tree path last segment (sync, globstar spec)
    itWindows('sync does not write outside dest for a git tree path with backslash traversal', async () => {
      await addGitSource();
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('api.github.com')) {
          return {
            ok: true,
            json: async () => ({ tree: [{ type: 'blob', path: 'dir/..\\outside\\evil.txt' }] }),
          } as Response;
        }
        return { ok: true, arrayBuffer: async () => new Uint8Array(Buffer.from('evil')).buffer } as Response;
      });

      const { handleSync } = await import('../src/commands/sync.js');
      const { addDestination } = await import('../src/config.js');
      addDestination({ name: 'git-dst', location: dirs.dest });
      await swallow(handleSync('git-src/**/*', 'git-dst', { force: true }));

      expect(fs.existsSync(path.join(outside, 'evil.txt'))).toBe(false);
    });

    // SEC-1 HIGH: `../` record file in resync, git source write path (resync.ts ~256)
    it('resync does not write outside dest for a git record with ../ in file', async () => {
      await addGitSource();
      await seedRecord('../outside/evil.txt', 'a.md', 'git-src');
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('api.github.com')) {
          return {
            ok: true,
            json: async () => ({ download_url: 'https://raw.githubusercontent.com/owner/repo/HEAD/a.md' }),
          } as Response;
        }
        return { ok: true, arrayBuffer: async () => new Uint8Array(Buffer.from('evil')).buffer } as Response;
      });

      const { handleResync } = await import('../src/commands/resync.js');
      await swallow(handleResync('test-dst', { dryRun: false, unghost: false, clean: false }));

      expect(fs.existsSync(path.join(outside, 'evil.txt'))).toBe(false);
    });

    // SEC-1 HIGH: `../` record file in resync, local source write path (resync.ts ~285)
    it('resync does not write outside dest for a local record with ../ in file', async () => {
      populateSource(dirs.source, { 'a.txt': 'alpha' });
      await seedRecord('../outside/evil.txt', 'a.txt');

      const { handleResync } = await import('../src/commands/resync.js');
      await swallow(handleResync('test-dst', { dryRun: false, unghost: false, clean: false }));

      expect(fs.existsSync(path.join(outside, 'evil.txt'))).toBe(false);
    });

    // SEC-1 HIGH: backslash record file in resync (Windows)
    itWindows('resync does not write outside dest for a local record with backslash traversal in file', async () => {
      populateSource(dirs.source, { 'a.txt': 'alpha' });
      await seedRecord('..\\outside\\evil.txt', 'a.txt');

      const { handleResync } = await import('../src/commands/resync.js');
      await swallow(handleResync('test-dst', { dryRun: false, unghost: false, clean: false }));

      expect(fs.existsSync(path.join(outside, 'evil.txt'))).toBe(false);
    });

    // SEC-1 HIGH: `resync --clean` deletes a file outside dest via `../` (resync.ts ~190)
    it('resync --clean does not delete a file outside dest for a missing-from-source record with ../', async () => {
      populateSource(dirs.source, { 'other.txt': 'other' });
      fs.writeFileSync(path.join(outside, 'victim.txt'), VICTIM);
      await seedRecord('../outside/victim.txt', 'missing.txt');

      const { handleResync } = await import('../src/commands/resync.js');
      await swallow(handleResync('test-dst', { dryRun: false, unghost: false, clean: true }));

      expect(fs.existsSync(path.join(outside, 'victim.txt'))).toBe(true);
    });

    // SEC-1 HIGH: `resync --clean` deletes a file outside dest via backslash (Windows)
    itWindows('resync --clean does not delete a file outside dest for a missing-from-source record with backslash traversal', async () => {
      populateSource(dirs.source, { 'other.txt': 'other' });
      fs.writeFileSync(path.join(outside, 'victim.txt'), VICTIM);
      await seedRecord('..\\outside\\victim.txt', 'missing.txt');

      const { handleResync } = await import('../src/commands/resync.js');
      await swallow(handleResync('test-dst', { dryRun: false, unghost: false, clean: true }));

      expect(fs.existsSync(path.join(outside, 'victim.txt'))).toBe(true);
    });

    // SEC-1 HIGH: ghosting a record deletes a file outside dest via `../` (ghost.ts ~33)
    it('ghost does not delete a file outside dest for a record with ../ in file', async () => {
      fs.writeFileSync(path.join(outside, 'victim.txt'), VICTIM);
      const index = await seedRecord('../outside/victim.txt', 'a.txt');

      const { handleGhost } = await import('../src/commands/ghost.js');
      await swallow(handleGhost('test-dst', String(index)));

      expect(fs.existsSync(path.join(outside, 'victim.txt'))).toBe(true);
    });

    // SEC-1 HIGH: ghosting a record deletes a file outside dest via backslash (Windows)
    itWindows('ghost does not delete a file outside dest for a record with backslash traversal in file', async () => {
      fs.writeFileSync(path.join(outside, 'victim.txt'), VICTIM);
      const index = await seedRecord('..\\outside\\victim.txt', 'a.txt');

      const { handleGhost } = await import('../src/commands/ghost.js');
      await swallow(handleGhost('test-dst', String(index)));

      expect(fs.existsSync(path.join(outside, 'victim.txt'))).toBe(true);
    });

    // SEC-1 HIGH: unghosting (restore from cache) writes outside dest via `../` (ghost.ts ~44)
    it('ghost restore does not write outside dest for a record with ../ in file', async () => {
      const index = await seedRecord('../outside/evil.txt', 'a.txt');
      const { setGhosted, fileCachePath, fileCacheDir } = await import('../src/config.js');
      setGhosted('test-dst', index, true);
      fs.mkdirSync(fileCacheDir('test-dst'), { recursive: true });
      fs.writeFileSync(fileCachePath('test-dst', index), 'evil');

      const { handleGhost } = await import('../src/commands/ghost.js');
      await swallow(handleGhost('test-dst', String(index)));

      expect(fs.existsSync(path.join(outside, 'evil.txt'))).toBe(false);
    });
  });

  describe('SEC-2 symlink escape from local source', () => {
    // SEC-2 MEDIUM: file symlink inside the source points to a file outside the source (sync, specific file)
    it('sync does not copy the content of a file symlink that points outside the source', async (ctx) => {
      const secret = path.join(outside, 'secret.txt');
      fs.writeFileSync(secret, SECRET);
      if (!trySymlinkFile(secret, path.join(dirs.source, 'link.txt'))) {
        ctx.skip('file symlink creation needs privilege on this Windows host (EPERM)');
      }

      const { handleSync } = await import('../src/commands/sync.js');
      await swallow(handleSync('test-src/link.txt', 'test-dst', { force: true }));

      const destFile = path.join(dirs.dest, 'link.txt');
      const copied = fs.existsSync(destFile) ? fs.readFileSync(destFile, 'utf8') : undefined;
      expect(copied).not.toBe(SECRET);
    });

    // SEC-2 MEDIUM: directory junction inside the source points to a dir outside the source (sync, dir spec)
    it('sync does not copy files from a directory link that points outside the source (directory spec)', async () => {
      const secretDir = path.join(outside, 'secretdir');
      fs.mkdirSync(secretDir);
      fs.writeFileSync(path.join(secretDir, 'secret.txt'), SECRET);
      fs.symlinkSync(secretDir, path.join(dirs.source, 'linkdir'), 'junction');

      const { handleSync } = await import('../src/commands/sync.js');
      await swallow(handleSync('test-src/linkdir', 'test-dst', { force: true }));

      expect(fs.existsSync(path.join(dirs.dest, 'secret.txt'))).toBe(false);
    });

    // SEC-2 MEDIUM: same junction, reached through a glob spec (readdirSync on the link dir)
    it('sync does not copy files from a directory link that points outside the source (glob spec)', async () => {
      const secretDir = path.join(outside, 'secretdir');
      fs.mkdirSync(secretDir);
      fs.writeFileSync(path.join(secretDir, 'secret.txt'), SECRET);
      fs.symlinkSync(secretDir, path.join(dirs.source, 'linkdir'), 'junction');

      const { handleSync } = await import('../src/commands/sync.js');
      await swallow(handleSync('test-src/linkdir/*.txt', 'test-dst', { force: true }));

      expect(fs.existsSync(path.join(dirs.dest, 'secret.txt'))).toBe(false);
    });

    // SEC-2 MEDIUM: resync trusts record.sourcePath and has no containment check (resync.ts ~279)
    it('resync does not copy a file outside the source when sourcePath uses ../', async () => {
      fs.writeFileSync(path.join(outside, 'secret.txt'), SECRET);
      await seedRecord('stolen.txt', '../outside/secret.txt');

      const { handleResync } = await import('../src/commands/resync.js');
      await swallow(handleResync('test-dst', { dryRun: false, unghost: false, clean: false }));

      const destFile = path.join(dirs.dest, 'stolen.txt');
      const copied = fs.existsSync(destFile) ? fs.readFileSync(destFile, 'utf8') : undefined;
      expect(copied).not.toBe(SECRET);
    });
  });
});
