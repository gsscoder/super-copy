#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import registerSource from './commands/source.js';
import registerDest from './commands/dest.js';
import registerSync from './commands/sync.js';
import registerInfo from './commands/info.js';
import registerList from './commands/list.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

program
  .name('scopy')
  .description(pkg.description)
  .version(pkg.version);

registerSource(program);
registerDest(program);
registerSync(program);
registerInfo(program);
registerList(program);

program.parse();
