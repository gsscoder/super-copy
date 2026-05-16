import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
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
import type { CopyRecord } from '../types.js';

function globPattern(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}

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

export async function handleGhost(dest: string, selector: string): Promise<void> {
  if (!destinationExists(dest)) {
    uiError(`destination "${dest}" is not registered`);
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
    .description('Toggle tracked file(s) between present and ghosted (cached)')
    .argument('<dest>', 'Destination name')
    .argument('<selector>', 'File index, filename, or wildcard pattern (e.g. task-*)')
    .action(handleGhost);
}
