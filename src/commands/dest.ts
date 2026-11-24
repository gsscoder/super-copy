import fs from 'node:fs';
import path from 'node:path';
import type { Command } from 'commander';
import { getDestinations, addDestination, removeDestination, renameDestination, destinationExists, getCopiesByDestination, fileCacheDir, dataPath } from '../config.js';
import { resolveInside } from '../safe-path.js';
import { validateLocalPath } from '../validate.js';
import { success, error, dim, printDestinationList } from '../ui.js';

function handleAdd(name: string, location: string): void {
  if (destinationExists(name)) {
    error(`destination "${name}" already exists`);
    return;
  }

  const result = validateLocalPath(location);
  if (!result.valid) {
    error(result.error ?? 'invalid local path');
    return;
  }

  addDestination({ name, location: path.resolve(location) });
  success(`Destination "${name}" added`);
}

function handleRemove(name: string): void {
  if (!destinationExists(name)) {
    error(`destination "${name}" not found`);
    return;
  }
  removeDestination(name);
  success(`Destination "${name}" removed`);
}

function handleRename(oldName: string, newName: string): void {
  if (!destinationExists(oldName)) {
    error(`destination "${oldName}" not found`);
    return;
  }
  if (oldName === newName) {
    error(`new name must differ from the current name "${oldName}"`);
    return;
  }
  if (destinationExists(newName)) {
    error(`destination "${newName}" already exists`);
    return;
  }
  try {
    resolveInside(path.join(dataPath, 'cache'), newName);
  } catch {
    error(`unsafe destination name: "${newName}"`);
    return;
  }
  if (getCopiesByDestination(newName).length > 0 || fs.existsSync(fileCacheDir(newName))) {
    error(`leftover copy records or cache exist for "${newName}"; run 'scopy purge log ${newName}' first`);
    return;
  }
  renameDestination(oldName, newName);
  success(`Destination "${oldName}" renamed to "${newName}"`);
}

function handleList(): void {
  const destinations = getDestinations();
  if (destinations.length === 0) {
    dim('No destinations registered');
    return;
  }
  printDestinationList(destinations);
}

export default function register(program: Command): void {
  const dest = program
    .command('dest')
    .description('Manage asset destinations');

  dest
    .command('add')
    .description('Add a destination (local path)')
    .argument('<name>', 'Destination name')
    .argument('<location>', 'Local filesystem path')
    .action(handleAdd);

  dest
    .command('remove')
    .description('Remove a destination by name')
    .argument('<name>', 'Destination name')
    .action(handleRemove);

  dest
    .command('rename')
    .description('Rename a destination')
    .argument('<old>', 'Current destination name')
    .argument('<new>', 'New destination name')
    .action(handleRename);

  dest
    .command('list')
    .description('List all registered destinations')
    .action(handleList);
}
