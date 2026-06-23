import { Command } from 'commander';
import readline from 'node:readline';
import { getCopies, purgeCopies } from '../config.js';
import type { CopyRecord } from '../types.js';
import { error as uiError, dim } from '../ui.js';

interface PurgeLogOptions {
  dryRun: boolean;
  force: boolean;
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

function applyPurge(predicate: (r: CopyRecord) => boolean, dryRun: boolean): void {
  if (dryRun) {
    const candidates = getCopies().filter(predicate);
    console.log(`Would remove ${candidates.length} entr${candidates.length === 1 ? 'y' : 'ies'}:`);
    for (const r of candidates) {
      dim(`· ${r.file} (${r.source} → ${r.destination})`);
    }
    return;
  }

  const removed = purgeCopies(predicate);
  console.log(`${removed} entr${removed === 1 ? 'y' : 'ies'} removed`);
}

export async function handlePurgeLog(dest: string | undefined, opts: PurgeLogOptions): Promise<void> {
  if (dest === undefined) {
    uiError('specify a destination name or * for all');
    return;
  }

  const predicate = dest === '*' ? (): boolean => true : (r: CopyRecord): boolean => r.destination === dest;

  if (!opts.dryRun && !opts.force) {
    const count = getCopies().filter(predicate).length;
    if (count === 0) {
      dim('nothing to purge');
      return;
    }
    const ok = await confirm(`Remove ${count} entr${count === 1 ? 'y' : 'ies'}? (y/N) `);
    if (!ok) {
      dim('aborted');
      return;
    }
  }

  applyPurge(predicate, opts.dryRun);
}

export default function registerPurge(program: Command): void {
  const purge = new Command('purge').description('Purge cached data');

  purge
    .command('log [dest]')
    .description('Remove copy log entries by destination (* = all, <name> = named dest) or by age (--older-than)')
    .option('--dry-run', 'Show what would be removed without modifying the registry')
    .option('--force', 'Skip confirmation prompt')
    .action((dest: string | undefined, opts: PurgeLogOptions) => handlePurgeLog(dest, opts));

  program.addCommand(purge);
}
