import chalk from 'chalk';
import type { Command } from 'commander';
import { getSources, getDestinations } from '../config.js';

function handleList(): void {
  const sources = getSources();
  const destinations = getDestinations();

  // Sources section
  console.log('');
  console.log(`  ${chalk.bold('Sources')}`);
  console.log(`  ${chalk.dim('─'.repeat(50))}`);
  if (sources.length === 0) {
    console.log(`  ${chalk.dim('No sources registered')}`);
  } else {
    for (const s of sources) {
      const loc = s.type === 'git' && s.path ? `${s.location} [path: ${s.path}]` : s.location;
      console.log(`  ${chalk.cyan(s.name.padEnd(20))} ${chalk.dim('→')}  ${loc}`);
    }
  }

  console.log('');

  // Destinations section
  console.log(`  ${chalk.bold('Destinations')}`);
  console.log(`  ${chalk.dim('─'.repeat(50))}`);
  if (destinations.length === 0) {
    console.log(`  ${chalk.dim('No destinations registered')}`);
  } else {
    for (const d of destinations) {
      console.log(`  ${chalk.cyan(d.name.padEnd(20))} ${chalk.dim('→')}  ${d.location}`);
    }
  }
}

export default function register(program: Command): void {
  program
    .command('list')
    .description('List all registered sources and destinations')
    .action(handleList);
}
