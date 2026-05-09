import type { Command } from 'commander';
import { getSources, getDestinations } from '../config.js';
import { heading, listItem, dim } from '../ui.js';

function handleList(): void {
  const sources = getSources();
  const destinations = getDestinations();

  heading('sources');
  if (sources.length === 0) {
    dim('no sources registered');
  } else {
    const w = Math.max(...sources.map((s) => s.name.length)) + 2;
    for (const s of sources) {
      const loc = s.type === 'git' && s.path ? `${s.location} [path: ${s.path}]` : s.location;
      listItem(s.name, loc, w);
    }
  }

  heading('destinations');
  if (destinations.length === 0) {
    dim('no destinations registered');
  } else {
    const w = Math.max(...destinations.map((d) => d.name.length)) + 2;
    for (const d of destinations) {
      listItem(d.name, d.location, w);
    }
  }
}

export default function register(program: Command): void {
  program
    .command('list')
    .description('List all registered sources and destinations')
    .action(handleList);
}
