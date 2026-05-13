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
import registerResync from './commands/resync.js';
import { isPackageJson } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _raw: unknown = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), { encoding: 'utf8' }));
if (!isPackageJson(_raw)) throw new Error('Invalid package.json shape');
const pkg = _raw;

program
  .name('scopy')
  .description(pkg.description)
  .version(pkg.version);

registerSource(program);
registerDest(program);
registerSync(program);
registerInfo(program);
registerList(program);
registerResync(program);

program.parse();
