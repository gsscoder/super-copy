import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import chalk from 'chalk';
import type { Command } from 'commander';
import {
  getSources,
  sourceExists,
  getDestinations,
  destinationExists,
  addCopy,
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

interface GitHubFile {
  name: string
  downloadUrl: string
}

export async function fetchGitHubFiles(owner: string, repo: string, subPath: string, fileSpec: string | undefined): Promise<GitHubFile[]> {
  const dirPath = subPath ? subPath.replace(/^\//, '') : '';

  let listPath: string;
  let globPart: string | undefined;

  if (fileSpec !== undefined && fileSpec.includes('*')) {
    // glob: list the directory part, filter by glob
    const lastSlash = fileSpec.lastIndexOf('/');
    const dirPart = lastSlash === -1 ? '' : fileSpec.slice(0, lastSlash);
    globPart = fileSpec.slice(lastSlash + 1);
    listPath = [dirPath, dirPart].filter(Boolean).join('/');
  } else if (fileSpec !== undefined) {
    // specific file: listPath is the file itself
    listPath = [dirPath, fileSpec].filter(Boolean).join('/');
  } else {
    // all files in subPath dir
    listPath = dirPath;
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${listPath}`;
  const res = await fetch(apiUrl, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status} for ${apiUrl}`);
  }

  const data: unknown = await res.json();

  // Single file response
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (obj.type === 'file' && typeof obj.name === 'string' && typeof obj.download_url === 'string') {
      return [{ name: fileSpec ?? obj.name as string, downloadUrl: obj.download_url as string }];
    }
    // directory object — shouldn't happen for file spec
    return [];
  }

  if (!Array.isArray(data)) return [];

  let entries = (data as Array<Record<string, unknown>>).filter((e) => e.type === 'file');

  if (globPart !== undefined) {
    const regex = globPattern(globPart);
    entries = entries.filter((e) => typeof e.name === 'string' && regex.test(e.name as string));
  }

  return entries
    .filter((e) => typeof e.name === 'string' && typeof e.download_url === 'string')
    .map((e) => ({ name: e.name as string, downloadUrl: e.download_url as string }));
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

  if (source.type === 'git') {
    // Parse owner/repo from stored location (https://github.com/{owner}/{repo})
    const urlParts = new URL(source.location).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1];
    const subPath = source.path ?? '';

    let gitFiles: GitHubFile[];
    try {
      gitFiles = await fetchGitHubFiles(owner, repo, subPath, fileSpec);
    } catch (err) {
      uiError(`error fetching files from GitHub: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    if (gitFiles.length === 0) {
      dim('No files to copy');
      return;
    }

    if (dryRun) {
      console.log(`${chalk.dim('Would copy')} ${gitFiles.length} file${gitFiles.length === 1 ? '' : 's'}:`);
      for (const f of gitFiles) {
        console.log(`${chalk.dim('·')} ${f.name}`);
      }
      return;
    }

    let copied = 0;
    let skipped = 0;
    const copyErrors: Array<{ file: string; err: Error }> = [];

    for (const f of gitFiles) {
      const destPath = path.join(dest.location, f.name);
      const existed = fs.existsSync(destPath);

      if (existed && !force) {
        const ok = await confirm(`${chalk.dim('overwrite')} ${f.name}? `);
        if (!ok) { skipped++; continue; }
      }

      try {
        const contentRes = await fetch(f.downloadUrl);
        if (!contentRes.ok) throw new Error(`HTTP ${contentRes.status}`);
        const content = Buffer.from(await contentRes.arrayBuffer());

        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, content);

        addCopy({ source: sourceName, destination: destName, file: f.name, copiedAt: new Date().toISOString() });

        const copies = getCopiesByDestination(destName);
        const record = copies.find((c) => c.source === sourceName && c.file === f.name);
        if (record && record.index !== undefined) {
          fs.mkdirSync(fileCacheDir(destName), { recursive: true });
          fs.writeFileSync(fileCachePath(destName, record.index), content);
        }

        console.log(`${chalk.green('✓')} ${f.name}${existed ? chalk.dim(' (overwritten)') : ''}`);
        copied++;
      } catch (err) {
        const fileErr = err instanceof Error ? err : new Error(String(err));
        copyErrors.push({ file: f.name, err: fileErr });
        console.error(`❌ ${f.name}: ${fileErr.message}`);
      }
    }

    console.log(`${chalk.green(String(copied))} copied, ${chalk.yellow(String(skipped))} skipped`);
    if (copyErrors.length > 0) {
      const noun = copyErrors.length === 1 ? 'error' : 'errors';
      throw new Error(`${copyErrors.length} file ${noun} during sync:\n` +
        copyErrors.map(e => `  ${e.file}: ${e.err.message}`).join('\n'));
    }
    return;
  }

  // Local source
  const workTree = source.location;

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
