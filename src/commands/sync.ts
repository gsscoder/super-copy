import { simpleGit } from 'simple-git';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import chalk from 'chalk';
import envPaths from 'env-paths';
import type { Command } from 'commander';
import {
  getSources,
  sourceExists,
  getDestinations,
  destinationExists,
  addCopy,
  getLastPull,
  setLastPull,
  getRepoPullTtlSec,
  getCopiesByDestination,
  fileCacheDir,
  fileCachePath,
} from '../config.js';
import { error as uiError, dim } from '../ui.js';

function globPattern(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}

function confirm(msg: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(msg, (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function gitCacheDir(sourceName: string): string {
  const dataDir = envPaths('scopy', { suffix: '' }).data;
  return path.join(dataDir, 'repos', sourceName);
}

async function ensureGitRepo(name: string, url: string): Promise<void> {
  const cacheDir = gitCacheDir(name);
  const gitDir = path.join(cacheDir, '.git');

  if (fs.existsSync(gitDir)) {
    const ttl = getRepoPullTtlSec();
    if (ttl > 0) {
      const lastPull = getLastPull(name);
      if (lastPull !== null) {
        const elapsed = (Date.now() - new Date(lastPull).getTime()) / 1000;
        if (elapsed < ttl) {
          dim('Up-to-date (cached)');
          return;
        }
      }
    }

    process.stdout.write(`${chalk.dim('Fetching')} ${name}... `);
    try {
      const git = simpleGit(cacheDir);
      await git.pull();
      setLastPull(name, new Date().toISOString());
      console.log(chalk.green('done'));
    } catch (err) {
      console.log(chalk.red('failed'));
      throw new Error(`Failed to pull git repo for "${name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    process.stdout.write(`${chalk.dim('Cloning')} ${name}... `);
    try {
      if (!/^https?:\/\//.test(url)) {
        throw new Error(`Refusing to clone "${url}": only http:// and https:// URLs are allowed`);
      }
      fs.mkdirSync(path.dirname(cacheDir), { recursive: true });
      const git = simpleGit();
      await git.clone(url, cacheDir, ['--depth', '1']);
      setLastPull(name, new Date().toISOString());
      console.log(chalk.green('done'));
    } catch (err) {
      console.log(chalk.red('failed'));
      throw new Error(`Failed to clone git repo for "${name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

function resolveFiles(workTree: string, fileSpec: string | undefined): Array<{ src: string; rel: string }> {
  if (fileSpec === undefined) {
    return fs.readdirSync(workTree, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => ({ src: path.join(workTree, e.name), rel: e.name }));
  }

  if (fileSpec.includes('*')) {
    const lastSlash = fileSpec.lastIndexOf('/');
    const dirPart = lastSlash === -1 ? '' : fileSpec.slice(0, lastSlash);
    const globPart = fileSpec.slice(lastSlash + 1);
    const regex = globPattern(globPart);
    const dirPath = path.join(workTree, dirPart);
    const resolvedDir = path.resolve(dirPath);
    const baseRes = path.resolve(workTree);
    if (resolvedDir !== baseRes && !resolvedDir.startsWith(baseRes + path.sep)) {
      throw new Error(`fileSpec escapes base directory: ${fileSpec}`);
    }

    if (!fs.existsSync(dirPath)) {
      return [];
    }

    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => e.isFile() && regex.test(e.name))
      .map((e) => ({
        src: path.join(dirPath, e.name),
        rel: e.name,
      }));
  }

  // Specific file path
  const srcPath = path.join(workTree, fileSpec);
  const resolvedSrc = path.resolve(srcPath);
  if (!resolvedSrc.startsWith(path.resolve(workTree) + path.sep)) {
    throw new Error(`fileSpec escapes base directory: ${fileSpec}`);
  }
  if (!fs.existsSync(srcPath)) {
    return [];
  }
  if (fs.statSync(srcPath).isDirectory()) {
    return fs.readdirSync(srcPath, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => ({ src: path.join(srcPath, e.name), rel: e.name }));
  }
  return [{ src: srcPath, rel: fileSpec }];
}

export async function handleSync(sourceSpec: string, destName: string, options: { force?: boolean; dryRun?: boolean }): Promise<void> {
  const { force, dryRun } = options;

  // Parse source-spec
  const slashIndex = sourceSpec.indexOf('/');
  let sourceName: string;
  let fileSpec: string | undefined;
  if (slashIndex === -1) {
    sourceName = sourceSpec;
    fileSpec = undefined;
  } else {
    sourceName = sourceSpec.slice(0, slashIndex);
    fileSpec = sourceSpec.slice(slashIndex + 1);
  }

  // Validate
  if (!sourceExists(sourceName)) {
    uiError(`source "${sourceName}" not found`);
    return;
  }

  if (!destinationExists(destName)) {
    uiError(`destination "${destName}" not found`);
    return;
  }

  const source = getSources().find((s) => s.name === sourceName);
  const dest = getDestinations().find((d) => d.name === destName);

  if (source === undefined || dest === undefined) {
    uiError('internal error: source or destination missing after validation');
    return;
  }

  // Determine work tree
  let workTree: string;

  if (source.type === 'git') {
    await ensureGitRepo(sourceName, source.location);

    const cacheDir = gitCacheDir(sourceName);
    workTree = source.path
      ? path.join(cacheDir, source.path.replace(/^\//, ''))
      : cacheDir;
  } else {
    workTree = source.location;
  }

  // Resolve files
  let files: Array<{ src: string; rel: string }>;
  try {
    files = resolveFiles(workTree, fileSpec);
  } catch (err) {
    uiError(`error reading source files${fileSpec ? ` for "${fileSpec}"` : ''}: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  if (files.length === 0) {
    dim('No files to copy');
    return;
  }

  if (dryRun) {
    console.log(`${chalk.dim('Would copy')} ${files.length} file${files.length === 1 ? '' : 's'}:`);
    for (const f of files) {
      console.log(`${chalk.dim('·')} ${f.rel}`);
    }
    return;
  }

  // Copy files
  let copied = 0;
  let skipped = 0;
  const copyErrors: Array<{ file: string; err: Error }> = [];

  for (const f of files) {
    const destPath = path.join(dest.location, f.rel);
    const existed = fs.existsSync(destPath);

    if (existed && !force) {
      const ok = await confirm(`${chalk.dim('overwrite')} ${f.rel}? `);
      if (!ok) {
        skipped++;
        continue;
      }
    }

    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(f.src, destPath);

      addCopy({
        source: sourceName,
        destination: destName,
        file: f.rel,
        copiedAt: new Date().toISOString(),
      });

      const copies = getCopiesByDestination(destName);
      const record = copies.find((c) => c.source === sourceName && c.file === f.rel);
      if (record && record.index !== undefined) {
        fs.mkdirSync(fileCacheDir(destName), { recursive: true });
        fs.copyFileSync(f.src, fileCachePath(destName, record.index));
      }

      console.log(`${chalk.green('✓')} ${f.rel}${existed ? chalk.dim(' (overwritten)') : ''}`);
      copied++;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      copyErrors.push({ file: f.rel, err: error });
      console.error(`❌ ${f.rel}: ${error.message}`);
    }
  }

  console.log(`${chalk.green(String(copied))} copied, ${chalk.yellow(String(skipped))} skipped`);

  if (copyErrors.length > 0) {
    const noun = copyErrors.length === 1 ? 'error' : 'errors';
    throw new Error(`${copyErrors.length} file ${noun} during sync:\n` +
      copyErrors.map(e => `  ${e.file}: ${e.err.message}`).join('\n'));
  }
}

export default function register(program: Command): void {
  program
    .command('sync')
    .description('Copy files from a source to a destination')
    .argument('<source-spec>', 'Source name with optional /path/file pattern')
    .argument('<dest>', 'Destination name')
    .option('--force', 'Skip overwrite confirmation')
    .option('--dry-run', 'Preview without copying')
    .action(handleSync);
}
