import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import {
  destinationExists,
  getDestinations,
  getCopyByIndex,
  setGhosted,
  fileCachePath,
  addCopy,
} from '../config.js';
import { error as uiError, dim } from '../ui.js';

export async function handleGhost(dest: string, indexStr: string): Promise<void> {
  if (!destinationExists(dest)) {
    uiError(`destination "${dest}" is not registered`);
    return;
  }

  const index = parseInt(indexStr, 10);
  if (isNaN(index)) {
    uiError(`invalid file index: "${indexStr}"`);
    return;
  }

  const record = getCopyByIndex(dest, index);
  if (record === undefined) {
    uiError(`no file with index ${index} for destination "${dest}"`);
    return;
  }

  const destinations = getDestinations();
  const destination = destinations.find((d) => d.name === dest);
  if (destination === undefined) {
    uiError(`internal error: destination "${dest}" not found after validation`);
    return;
  }

  const destPath = path.join(destination.location, record.file);

  if (record.ghosted === false || record.ghosted === undefined) {
    const cachePath = fileCachePath(dest, index);
    if (!fs.existsSync(cachePath)) {
      dim(`cache not found for "${record.file}" — proceeding without cache backup`);
    }

    fs.rmSync(destPath, { force: true });
    setGhosted(dest, index, true);
    console.log(`${chalk.green('ghosted')} ${record.file}`);
  } else {
    const cachePath = fileCachePath(dest, index);
    if (!fs.existsSync(cachePath)) {
      uiError(`cache not found for "${record.file}" — cannot restore`);
      return;
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(cachePath, destPath);
    setGhosted(dest, index, false);
    addCopy({
      source: record.source,
      destination: dest,
      file: record.file,
      copiedAt: new Date().toISOString(),
    });
    console.log(`${chalk.green('restored')} ${record.file}`);
  }
}

export default function register(program: Command): void {
  program
    .command('ghost')
    .description('Toggle a tracked file between present and ghosted (cached)')
    .argument('<dest>', 'Destination name')
    .argument('<file-index>', 'File index number from scopy log')
    .action(handleGhost);
}
