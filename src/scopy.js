#!/usr/bin/env node

const { program } = require('commander');
const pkg = require('../package.json');

program
  .name('scopy')
  .description(pkg.description)
  .version(pkg.version);

program.parse();
