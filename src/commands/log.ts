import type { Command } from 'commander';
import { getCopies, getCopiesByDestination, getDestinations, destinationExists } from '../config.js';
import { heading, dim, blank, error } from '../ui.js';
import chalk from 'chalk';

function printDestGroup(destName: string, files: Array<{ file: string; copiedAt: string | undefined }>): void {
  heading(destName);

  if (files.length === 0) {
    dim('no tracked files');
    return;
  }

  const indexWidth = String(files.length).length;
  const nameWidth = Math.max(...files.map((f) => f.file.length));

  for (let i = 0; i < files.length; i++) {
    const index = String(i + 1).padStart(indexWidth);
    const name = files[i].file.padEnd(nameWidth);
    const ts = chalk.dim(files[i].copiedAt ?? '');
    console.log(`  ${index}  ${name}  ${ts}`);
  }
}

function handleLog(dest: string | undefined): void {
  if (dest !== undefined) {
    if (!destinationExists(dest)) {
      error(`destination '${dest}' is not registered`);
      process.exit(1);
    }
    const copies = getCopiesByDestination(dest);
    printDestGroup(dest, copies.map((c) => ({ file: c.file, copiedAt: c.copiedAt })));
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
    printDestGroup(d.name, copies.map((c) => ({ file: c.file, copiedAt: c.copiedAt })));
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
