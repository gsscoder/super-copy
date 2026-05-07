import { simpleGit } from 'simple-git';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import chalk from 'chalk';
import envPaths from 'env-paths';
import {
  getSources,
  sourceExists,
  getDestinations,
  destinationExists,
  addCopy,
} from '../config.js';

/**
 * @param {string} pattern
 * @returns {RegExp}
 */
function globPattern(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}

/**
 * @param {string} msg
 * @returns {Promise<boolean>}
 */
function confirm(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(msg, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Ensure the git cache directory exists for a given source name.
 * @param {string} sourceName
 * @returns {string}
 */
function gitCacheDir(sourceName) {
  const dataDir = envPaths('scopy', { suffix: '' }).data;
  return path.join(dataDir, 'repos', sourceName);
}

/**
 * Clone or pull a git source into the local cache.
 * @param {string} name
 * @param {string} url
 * @returns {Promise<void>}
 */
async function ensureGitRepo(name, url) {
  const cacheDir = gitCacheDir(name);
  const gitDir = path.join(cacheDir, '.git');

  if (fs.existsSync(gitDir)) {
    process.stdout.write(`  ${chalk.dim('Fetching')} ${name}... `);
    try {
      const git = simpleGit(cacheDir);
      await git.pull();
      console.log(chalk.green('done'));
    } catch (err) {
      console.log(chalk.red('failed'));
      throw new Error(`Failed to pull git repo for "${name}": ${err.message}`);
    }
  } else {
    process.stdout.write(`  ${chalk.dim('Cloning')} ${name}... `);
    try {
      fs.mkdirSync(path.dirname(cacheDir), { recursive: true });
      const git = simpleGit();
      await git.clone(url, cacheDir, ['--depth', '1']);
      console.log(chalk.green('done'));
    } catch (err) {
      console.log(chalk.red('failed'));
      throw new Error(`Failed to clone git repo for "${name}": ${err.message}`);
    }
  }
}

/**
 * Resolve a list of file paths from a work tree and optional file spec.
 * @param {string} workTree
 * @param {string|undefined} fileSpec
 * @returns {Array<{src: string, rel: string}>}
 */
function resolveFiles(workTree, fileSpec) {
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

    if (!fs.existsSync(dirPath)) {
      return [];
    }

    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => e.isFile() && regex.test(e.name))
      .map((e) => ({
        src: path.join(dirPath, e.name),
        rel: dirPart ? path.join(dirPart, e.name) : e.name,
      }));
  }

  // Specific file path
  const srcPath = path.join(workTree, fileSpec);
  if (!fs.existsSync(srcPath)) {
    return [];
  }
  return [{ src: srcPath, rel: fileSpec }];
}

/**
 * @param {string} sourceSpec
 * @param {string} destName
 * @param {{force?: boolean, dryRun?: boolean}} options
 */
async function handleSync(sourceSpec, destName, options) {
  const { force, dryRun } = options;

  // Parse source-spec
  const slashIndex = sourceSpec.indexOf('/');
  let sourceName, fileSpec;
  if (slashIndex === -1) {
    sourceName = sourceSpec;
    fileSpec = undefined;
  } else {
    sourceName = sourceSpec.slice(0, slashIndex);
    fileSpec = sourceSpec.slice(slashIndex + 1);
  }

  // Validate
  if (!sourceExists(sourceName)) {
    console.log(chalk.red(`✖ Source "${sourceName}" not found`));
    return;
  }

  if (!destinationExists(destName)) {
    console.log(chalk.red(`✖ Destination "${destName}" not found`));
    return;
  }

  const source = getSources().find((s) => s.name === sourceName);
  const dest = getDestinations().find((d) => d.name === destName);

  console.log(`  ${chalk.cyan(sourceName)} ${chalk.dim('→')} ${chalk.cyan(destName)}`);

  // Determine work tree
  let workTree;

  if (source.location.startsWith('https://')) {
    await ensureGitRepo(sourceName, source.location);

    const cacheDir = gitCacheDir(sourceName);
    workTree = source.path
      ? path.join(cacheDir, source.path.replace(/^\//, ''))
      : cacheDir;
  } else {
    workTree = source.location;
  }

  // Resolve files
  let files;
  try {
    files = resolveFiles(workTree, fileSpec);
  } catch {
    console.log(chalk.red(`✖ Error reading source files${fileSpec ? ` for "${fileSpec}"` : ''}`));
    return;
  }

  if (files.length === 0) {
    console.log(chalk.dim('  No files to copy'));
    return;
  }

  if (dryRun) {
    console.log(`  ${chalk.dim('Would copy')} ${files.length} file${files.length === 1 ? '' : 's'}:`);
    for (const f of files) {
      console.log(`    ${chalk.dim('·')} ${f.rel}`);
    }
    return;
  }

  // Copy files
  let copied = 0;
  let skipped = 0;

  for (const f of files) {
    const destPath = path.join(dest.location, path.basename(f.rel));
    const existed = fs.existsSync(destPath);

    if (existed && !force) {
      const ok = await confirm(`    ${chalk.dim('Overwrite')} ${f.rel}? `);
      if (!ok) {
        skipped++;
        continue;
      }
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(f.src, destPath);

    console.log(`    ${chalk.green('✓')} ${f.rel}${existed ? chalk.dim(' (overwritten)') : ''}`);

    addCopy({
      source: sourceName,
      destination: destName,
      file: f.rel,
      copiedAt: new Date().toISOString(),
    });

    copied++;
  }

  console.log(`  ${copied} copied, ${skipped} skipped`);
}

/**
 * @param {import('commander').Command} program
 */
export default function register(program) {
  const syncCmd = program
    .command('sync')
    .description('Copy files from a source to a destination')
    .argument('<source-spec>', 'Source name with optional /path/file pattern')
    .argument('<dest>', 'Destination name')
    .option('--force', 'Skip overwrite confirmation')
    .option('--dry-run', 'Preview without copying')
    .action(handleSync);
}
