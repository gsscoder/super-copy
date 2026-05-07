import { simpleGit } from 'simple-git';
import path from 'node:path';
import chalk from 'chalk';
import { getSources, addSource, removeSource, sourceExists } from '../config.js';
import { validateLocalPath } from '../validate.js';

/**
 * @param {string} location
 * @returns {{type: 'git', baseUrl: string, subPath: string} | {type: 'local'}}
 */
function parseLocation(location) {
  if (location.startsWith('https://')) {
    const url = new URL(location);
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

/**
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function validateGitRepo(url) {
  try {
    const git = simpleGit();
    await git.listRemote(['--heads', url]);
    return true;
  } catch {
    return false;
  }
}

async function handleAdd(name, location) {
  if (sourceExists(name)) {
    console.log(chalk.red(`✖ Source "${name}" already exists`));
    return;
  }

  const parsed = parseLocation(location);
  if (!parsed) {
    console.log(chalk.red(`✖ Invalid location: "${location}"`));
    return;
  }

  if (parsed.type === 'git') {
    if (!(await validateGitRepo(parsed.baseUrl))) {
      console.log(chalk.red(`✖ Git repository not accessible: ${parsed.baseUrl}`));
      return;
    }
    addSource({ name, location, path: parsed.subPath || undefined });
  } else {
    const result = validateLocalPath(location);
    if (!result.valid) {
      console.log(chalk.red(`✖ ${result.error}`));
      return;
    }
    addSource({ name, location: path.resolve(location) });
  }

  console.log(chalk.green(`✓ Source "${name}" added`));
}

function handleRemove(name) {
  if (!sourceExists(name)) {
    console.log(chalk.red(`✖ Source "${name}" not found`));
    return;
  }
  removeSource(name);
  console.log(chalk.green(`✓ Source "${name}" removed`));
}

function handleList() {
  const sources = getSources();
  if (sources.length === 0) {
    console.log(chalk.dim('No sources registered'));
    return;
  }
  for (const s of sources) {
    const loc = s.path ? `${s.location} [path: ${s.path}]` : s.location;
    console.log(`  ${chalk.cyan(s.name)}  ${chalk.dim('→')}  ${loc}`);
  }
}

/**
 * @param {import('commander').Command} program
 */
export default function register(program) {
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
