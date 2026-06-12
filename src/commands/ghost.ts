import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import checkbox, { Separator } from '@inquirer/checkbox';
import {
  destinationExists,
  getDestinations,
  getCopyByIndex,
  getCopiesByDestination,
  setGhosted,
  fileCachePath,
  addCopy,
} from '../config.js';
import { error as uiError, dim } from '../ui.js';
import { globPattern } from '../glob.js';
import type { CopyRecord } from '../types.js';

function toggleRecord(dest: string, destLocation: string, record: CopyRecord): void {
  if (record.index === undefined) {
    uiError(`record for "${record.file}" has no index — skipping`);
    return;
  }

  const destPath = path.join(destLocation, record.file);

  if (record.ghosted === false || record.ghosted === undefined) {
    const cachePath = fileCachePath(dest, record.index);
    if (!fs.existsSync(cachePath)) {
      dim(`cache not found for "${record.file}" — proceeding without cache backup`);
    }

    fs.rmSync(destPath, { force: true });
    setGhosted(dest, record.index, true);
    console.log(`${chalk.red('ghosted')} ${record.file} → removed and cached`);
  } else {
    const cachePath = fileCachePath(dest, record.index);
    if (!fs.existsSync(cachePath)) {
      uiError(`cache not found for "${record.file}" — cannot restore`);
      return;
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(cachePath, destPath);
    setGhosted(dest, record.index, false);
    addCopy({
      source: record.source,
      destination: dest,
      file: record.file,
      copiedAt: new Date().toISOString(),
    });
    console.log(`${chalk.green('unghosted')} ${record.file} ← restored from cache`);
  }
}

async function handleGhostInteractive(destFilter?: string): Promise<void> {
  const destinations = destFilter === undefined
    ? getDestinations()
    : getDestinations().filter((d) => d.name === destFilter);
  const withFiles = destinations.filter((d) => getCopiesByDestination(d.name).length > 0);

  if (withFiles.length === 0) {
    dim(destFilter === undefined ? 'no destinations with tracked files' : `no tracked files for destination "${destFilter}"`);
    return;
  }

  // Build choices with Separator headers per destination
  type ChoiceValue = { dest: string; file: string };
  const choices: Array<InstanceType<typeof Separator> | { name: string; value: ChoiceValue; checked: boolean }> = [];

  const allRecords: Map<string, { dest: string; location: string; records: CopyRecord[] }> = new Map();

  for (const d of withFiles) {
    const records = getCopiesByDestination(d.name);
    allRecords.set(d.name, { dest: d.name, location: d.location, records });
    choices.push(new Separator(chalk.bold(d.name)));
    for (const r of records) {
      choices.push({
        name: r.file,
        value: { dest: d.name, file: r.file },
        checked: r.ghosted === true,
      });
    }
  }

  const chosen = await checkbox({
    message: '',
    choices,
    theme: {
      icon: {
        checked: chalk.red('● [ghosted]   '),
        unchecked: chalk.green('○ [unghosted] '),
        cursor: '›',
      },
      prefix: { idle: '', done: '' },
      style: { answer: () => '', message: () => '' },
    },
  });

  const nowGhosted = new Set(chosen.map((c) => `${c.dest}::${c.file}`));

  for (const { dest, location, records } of allRecords.values()) {
    for (const record of records) {
      const key = `${dest}::${record.file}`;
      const wasGhosted = record.ghosted === true;
      const shouldBeGhosted = nowGhosted.has(key);
      if (wasGhosted !== shouldBeGhosted) {
        toggleRecord(dest, location, record);
      }
    }
  }
}

export async function handleGhost(dest: string | undefined, selector: string | undefined): Promise<void> {
  if (dest === undefined) {
    await handleGhostInteractive();
    return;
  }

  if (!destinationExists(dest)) {
    uiError(`destination "${dest}" is not registered`);
    return;
  }

  if (selector === undefined) {
    await handleGhostInteractive(dest);
    return;
  }

  const destinations = getDestinations();
  const destination = destinations.find((d) => d.name === dest);
  if (destination === undefined) {
    uiError(`internal error: destination "${dest}" not found after validation`);
    return;
  }

  const index = parseInt(selector, 10);
  if (!isNaN(index)) {
    const record = getCopyByIndex(dest, index);
    if (record === undefined) {
      uiError(`no file with index ${index} for destination "${dest}"`);
      return;
    }
    toggleRecord(dest, destination.location, record);
  } else {
    const regex = globPattern(selector);
    const matches = getCopiesByDestination(dest).filter((r) => regex.test(r.file));
    if (matches.length === 0) {
      dim(`no matching files for "${selector}"`);
      return;
    }
    for (const record of matches) {
      toggleRecord(dest, destination.location, record);
    }
  }
}

export default function register(program: Command): void {
  program
    .command('ghost')
    .description('Toggle tracked file(s) between present and ghosted (cached); no args = interactive')
    .argument('[dest]', 'Destination name')
    .argument('[selector]', 'File index, filename, or wildcard pattern (e.g. task-*)')
    .action(handleGhost);
}
