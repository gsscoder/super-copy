import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import { getDestinations, addDestination, removeDestination, destinationExists } from '../config.js';
import { validateLocalPath } from '../validate.js';

function handleAdd(name: string, location: string): void {
  if (destinationExists(name)) {
    console.log(chalk.red(`✖ Destination "${name}" already exists`));
    return;
  }

  const result = validateLocalPath(location);
  if (!result.valid) {
    console.log(chalk.red(`✖ ${result.error}`));
    return;
  }

  addDestination({ name, location: path.resolve(location) });
  console.log(chalk.green(`✓ Destination "${name}" added`));
}

function handleRemove(name: string): void {
  if (!destinationExists(name)) {
    console.log(chalk.red(`✖ Destination "${name}" not found`));
    return;
  }
  removeDestination(name);
  console.log(chalk.green(`✓ Destination "${name}" removed`));
}

function handleList(): void {
  const destinations = getDestinations();
  if (destinations.length === 0) {
    console.log(chalk.dim('No destinations registered'));
    return;
  }
  for (const d of destinations) {
    console.log(`  ${chalk.cyan(d.name)}  ${chalk.dim('→')}  ${d.location}`);
  }
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
