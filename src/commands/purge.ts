import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

import { Command } from 'commander';
import { dataPath, getCopies, purgeCopies } from '../config.js';
import type { CopyRecord } from '../types.js';
import { dim } from '../ui.js';

interface PurgeOptions {
  dryRun: boolean;
}

interface PurgeLogOptions {
  dryRun: boolean;
}

function reposDir(): string {
  return path.join(dataPath, 'repos');
}

export function handlePurgeRepos(opts: PurgeOptions): void {
  const dir = reposDir();

  if (!fs.existsSync(dir)) {
    dim('nothing to purge');
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const repoDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (repoDirs.length === 0) {
    dim('nothing to purge');
    return;
  }

  if (opts.dryRun) {
    console.log(`Would remove ${repoDirs.length} repo(s):`);
    for (const name of repoDirs) {
      console.log(chalk.dim(`· ${name}`));
    }
    return;
  }

  for (const name of repoDirs) {
    fs.rmSync(path.join(dir, name), { recursive: true, force: true });
    console.log(`${chalk.green('✓')} ${name}`);
  }

  console.log(`${repoDirs.length} repo(s) removed`);
}

function allPredicate(): (r: CopyRecord) => boolean {
  return (): boolean => true;
}

function byDestinationPredicate(destName: string): (r: CopyRecord) => boolean {
  return (r): boolean => r.destination === destName;
}

function applyPurge(predicate: (r: CopyRecord) => boolean, dryRun: boolean): void {
  if (dryRun) {
    const candidates = getCopies().filter(predicate);
    console.log(`Would remove ${candidates.length} entr${candidates.length === 1 ? 'y' : 'ies'}:`);
    for (const r of candidates) {
      console.log(chalk.dim(`· ${r.file} (${r.source} → ${r.destination})`));
    }
    return;
  }

  const removed = purgeCopies(predicate);
  console.log(`${removed} entr${removed === 1 ? 'y' : 'ies'} removed`);
}

export function handlePurgeLog(dest: string | undefined, opts: PurgeLogOptions): void {
  if (dest === '*') {
    applyPurge(allPredicate(), opts.dryRun);
    return;
  }

  if (dest !== undefined) {
    applyPurge(byDestinationPredicate(dest), opts.dryRun);
    return;
  }

  dim('nothing to purge (provide a destination or * for all)');
}

export default function registerPurge(program: Command): void {
  const purge = new Command('purge').description('Purge cached data');

  purge
    .command('repos')
    .description('Delete all cloned git repo cache directories')
    .option('--dry-run', 'List dirs that would be deleted without deleting them')
    .action((opts: PurgeOptions) => handlePurgeRepos(opts));

  purge
    .command('log [dest]')
    .description('Remove copy log entries by destination (* = all, <name> = named dest) or by age (--older-than)')
    .option('--dry-run', 'Show what would be removed without modifying the registry')
    .action((dest: string | undefined, opts: PurgeLogOptions) => handlePurgeLog(dest, opts));

  program.addCommand(purge);
}
