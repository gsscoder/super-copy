import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import envPaths from 'env-paths';
import { Command } from 'commander';
import { getCopies, purgeCopies } from '../config.js';
import { dim } from '../ui.js';

interface PurgeOptions {
  dryRun: boolean;
}

interface PurgeLogOptions {
  olderThan?: string;
  dryRun: boolean;
}

function reposDir(): string {
  return path.join(envPaths('scopy', { suffix: '' }).data, 'repos');
}

function handlePurgeRepos(opts: PurgeOptions): void {
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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function handlePurgeLog(opts: PurgeLogOptions): void {
  if (opts.olderThan === undefined) {
    dim('nothing to purge (use --older-than to specify age threshold)');
    return;
  }

  const days = parseInt(opts.olderThan, 10);
  if (isNaN(days) || days <= 0) {
    console.log(chalk.red('--older-than must be a non-negative integer'));
    process.exitCode = 1;
    return;
  }

  const todayStart = startOfDay(new Date());
  const cutoff = new Date(todayStart.getTime() - days * 24 * 60 * 60 * 1000);

  const shouldPurge = (copiedAt: string | undefined): boolean => {
    if (copiedAt === undefined) return true;
    const d = new Date(copiedAt);
    return startOfDay(d) < cutoff;
  };

  if (opts.dryRun) {
    const candidates = getCopies().filter((r) => shouldPurge(r.copiedAt));
    console.log(`Would remove ${candidates.length} entr${candidates.length === 1 ? 'y' : 'ies'}:`);
    for (const r of candidates) {
      console.log(chalk.dim(`· ${r.file} (${r.source} → ${r.destination})`));
    }
    return;
  }

  const removed = purgeCopies((r) => shouldPurge(r.copiedAt));
  console.log(`${removed} entr${removed === 1 ? 'y' : 'ies'} removed`);
}

export default function registerPurge(program: Command): void {
  const purge = new Command('purge').description('Purge cached data');

  purge
    .command('repos')
    .description('Delete all cloned git repo cache directories')
    .option('--dry-run', 'List dirs that would be deleted without deleting them')
    .action((opts: PurgeOptions) => handlePurgeRepos(opts));

  purge
    .command('log')
    .description('Remove copy log entries older than a given number of days')
    .option('--older-than <days>', 'Remove entries older than this many days')
    .option('--dry-run', 'Show what would be removed without modifying the registry')
    .action((opts: PurgeLogOptions) => handlePurgeLog(opts));

  program.addCommand(purge);
}
