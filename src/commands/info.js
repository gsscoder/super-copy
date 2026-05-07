import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import chalk from 'chalk';
import envPaths from 'env-paths';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));

/**
 * Display application information: version, config path, and repo clone path.
 *
 * @returns {void}
 */
function handleInfo() {
  const configDir = path.join(os.homedir(), '.config', 'scopy');
  const configPath = path.join(configDir, 'scopy.json');
  const repoPath = path.join(envPaths('scopy', { suffix: '' }).data, 'repos');

  console.log('');
  console.log(`  ${chalk.bold.cyan(pkg.name)}  ${chalk.dim(`v${pkg.version}`)}`);
  console.log(`  ${chalk.dim('─'.repeat(50))}`);
  console.log(`  ${chalk.cyan('Config File'.padEnd(20))}${chalk.dim(configPath)}`);
  console.log(`  ${chalk.cyan('Repo Clone Path'.padEnd(20))}${chalk.dim(repoPath)}`);
  console.log('');
}

/**
 * @param {import('commander').Command} program
 */
export default function register(program) {
  program
    .command('info')
    .description('Display configuration and environment information')
    .action(handleInfo);
}
