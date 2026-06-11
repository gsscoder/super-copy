import path from 'node:path';
import chalk from 'chalk';
import figlet from 'figlet';
import type { Command } from 'commander';
import type { PackageJson } from '../types.js';
import { configDir, dataPath } from '../config.js';
import { keyValue } from '../ui.js';

function handleInfo(pkg: PackageJson): void {
  const configPath = path.join(configDir, 'scopy.json');
  const repoPath = path.join(dataPath, 'repos');
  const registerPath = path.join(dataPath, 'scopy-register.json');

  console.log(chalk.cyan(figlet.textSync('scopy', { font: 'Small Slant' }).replace(/^\n+/, '\n')));
  console.log();
  console.log(`${chalk.bold.white(pkg.name)} ${chalk.dim(`v${pkg.version}`)}`)
  keyValue('config', configPath);
  keyValue('clone path', repoPath);
  keyValue('register', registerPath);
}

export default function register(program: Command, pkg: PackageJson): void {
  program
    .command('info')
    .description('Display configuration and environment information')
    .action(() => handleInfo(pkg));
}
