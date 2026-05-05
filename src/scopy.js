#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import registerSource from './commands/source.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

program
  .name('scopy')
  .description(pkg.description)
  .version(pkg.version);

registerSource(program);

program.parse();
