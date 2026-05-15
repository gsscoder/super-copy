import path from 'node:path';
import type { Command } from 'commander';
import { getSources, addSource, removeSource, sourceExists } from '../config.js';
import { validateLocalPath } from '../validate.js';
import { listItem, success, error, dim, blank } from '../ui.js';

interface ParsedGitLocation {
  type: 'git'
  baseUrl: string
  subPath: string
}

interface ParsedLocalLocation {
  type: 'local'
}

type ParsedLocation = ParsedGitLocation | ParsedLocalLocation

function parseLocation(location: string): ParsedLocation | null {
  if (location.startsWith('https://')) {
    const url = new URL(location);
    if (url.host !== 'github.com') {
      return null;
    }
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 2) {
      return null;
    }
    const baseUrl = `${url.protocol}//${url.host}/${segments[0]}/${segments[1]}`;
    const subPath = segments.length > 2 ? '/' + segments.slice(2).join('/') : '';
    return { type: 'git', baseUrl, subPath };
  }
  return { type: 'local' };
}

async function handleAdd(name: string, location: string): Promise<void> {
  if (sourceExists(name)) {
    error(`source "${name}" already exists`);
    return;
  }

  const parsed = parseLocation(location);
  if (!parsed) {
    error(`invalid location: "${location}"`);
    return;
  }

  if (parsed.type === 'git') {
    addSource({ type: 'git', name, location: parsed.baseUrl, path: parsed.subPath || undefined });
  } else {
    const result = validateLocalPath(location);
    if (!result.valid) {
      error(result.error ?? 'invalid local path');
      return;
    }
    addSource({ type: 'local', name, location: path.resolve(location) });
  }

  success(`Source "${name}" added`);
}

function handleRemove(name: string): void {
  if (!sourceExists(name)) {
    error(`source "${name}" not found`);
    return;
  }
  removeSource(name);
  success(`Source "${name}" removed`);
}

function handleList(): void {
  const sources = getSources();
  if (sources.length === 0) {
    dim('No sources registered');
    return;
  }
  blank();
  for (const s of sources) {
    const loc = s.type === 'git' && s.path ? `${s.location} [path: ${s.path}]` : s.location;
    listItem(s.name, loc);
  }
  blank();
}

export default function register(program: Command): void {
  const source = program
    .command('source')
    .description('Manage asset sources');

  source
    .command('add')
    .description('Add a source (git URL or local path)')
    .argument('<name>', 'Source name')
    .argument('<location>', 'Git URL or local filesystem path')
    .action(handleAdd);

  source
    .command('remove')
    .description('Remove a source by name')
    .argument('<name>', 'Source name')
    .action(handleRemove);

  source
    .command('list')
    .description('List all registered sources')
    .action(handleList);
}
