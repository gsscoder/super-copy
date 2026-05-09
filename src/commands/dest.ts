import path from 'node:path';
import type { Command } from 'commander';
import { getDestinations, addDestination, removeDestination, destinationExists } from '../config.js';
import { validateLocalPath } from '../validate.js';
import { listItem, success, error, dim, blank } from '../ui.js';

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

function handleList(): void {
  const destinations = getDestinations();
  if (destinations.length === 0) {
    dim('No destinations registered');
    return;
  }
  blank();
  for (const d of destinations) {
    listItem(d.name, d.location);
  }
  blank();
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
    .command('list')
    .description('List all registered destinations')
    .action(handleList);
}
