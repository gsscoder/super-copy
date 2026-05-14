import type { Command } from 'commander';
import {
  getCopies,
  getCopiesByDestination,
  getDestinations,
  destinationExists,
} from '../config.js';
import { heading, dim, blank, error } from '../ui.js';
import type { CopyRecord } from '../types.js';
import chalk from 'chalk';

function printDestGroup(destName: string, records: CopyRecord[]): void {
  heading(destName);

  if (records.length === 0) {
    dim('no tracked files');
    return;
  }

  const indexWidth = String(Math.max(...records.map((r) => r.index ?? 0), records.length)).length;
  const nameWidth = Math.max(...records.map((r) => r.file.length));

  for (const r of records) {
    const idx = String(r.index ?? '?').padStart(indexWidth);
    const name = r.file.padEnd(nameWidth);
    const ts = chalk.dim(r.copiedAt ?? '');
    const ghosted = r.ghosted ? chalk.dim(' [ghosted]') : '';
    console.log(`  ${idx}  ${name}  ${ts}${ghosted}`);
  }
}

function handleLog(dest: string | undefined): void {
  if (dest !== undefined) {
    if (!destinationExists(dest)) {
      error(`destination '${dest}' is not registered`);
      process.exit(1);
    }
    const copies = getCopiesByDestination(dest);
    printDestGroup(dest, copies);
    return;
  }

  const destinations = getDestinations();
  const allCopies = getCopies();

  if (destinations.length === 0) {
    dim('no destinations registered');
    return;
  }

  const withFiles = destinations.filter((d) => allCopies.some((c) => c.destination === d.name));
  const withoutFiles = destinations.filter((d) => !allCopies.some((c) => c.destination === d.name));

  for (let i = 0; i < withFiles.length; i++) {
    const d = withFiles[i];
    const copies = allCopies.filter((c) => c.destination === d.name);
    printDestGroup(d.name, copies);
    if (i < withFiles.length - 1) blank();
  }

  if (withoutFiles.length > 0) {
    if (withFiles.length > 0) blank();
    heading('not yet synced');
    for (const d of withoutFiles) {
      console.log(`  ${chalk.gray(d.name)}`);
    }
  }
}

export default function register(program: Command): void {
  program
    .command('log [dest]')
    .description('Show tracked files grouped by destination')
    .action(handleLog);
}
