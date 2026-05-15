import { Command } from 'commander';
import { getCopies, purgeCopies } from '../config.js';
import type { CopyRecord } from '../types.js';
import { dim } from '../ui.js';

interface PurgeLogOptions {
  dryRun: boolean;
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
      dim(`· ${r.file} (${r.source} → ${r.destination})`);
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
    .command('log [dest]')
    .description('Remove copy log entries by destination (* = all, <name> = named dest) or by age (--older-than)')
    .option('--dry-run', 'Show what would be removed without modifying the registry')
    .action((dest: string | undefined, opts: PurgeLogOptions) => handlePurgeLog(dest, opts));

  program.addCommand(purge);
}
