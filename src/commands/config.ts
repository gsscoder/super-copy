import chalk from 'chalk';
import type { Command } from 'commander';
import { getPrefs, getPref, setPref, dismissTip, PREF_KEYS, isPrefKey, type PrefKey } from '../config.js';
import { error as uiError } from '../ui.js';

const PREF_VALUES: Record<PrefKey, readonly string[]> = {
  'sync.allowOverwrite': ['true', 'false'],
};

function parseBoolValue(raw: string): boolean {
  return raw === 'true';
}

function formatValue(val: unknown): string {
  return String(val);
}

function handleConfig(key: string | undefined, value: string | undefined): void {
  if (key === undefined) {
    const prefs = getPrefs();
    for (const k of PREF_KEYS) {
      console.log(`${k}=${chalk.cyan(formatValue(prefs[k]))}`);
    }
    return;
  }

  if (!isPrefKey(key)) {
    uiError(`unknown key "${key}". Valid keys: ${PREF_KEYS.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const typedKey = key;

  if (value === undefined) {
    console.log(`${key}=${chalk.cyan(formatValue(getPref(typedKey)))}`);
    return;
  }

  const allowed = PREF_VALUES[typedKey];
  if (!allowed.includes(value)) {
    uiError(`invalid value "${value}" for "${key}". Allowed: ${allowed.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (typedKey === 'sync.allowOverwrite') {
    setPref(typedKey, parseBoolValue(value));
    if (value === 'true') {
      dismissTip('sync.allowOverwrite');
    }
  }
  console.log(`${key}=${chalk.cyan(value)}`);
}

export default function registerConfig(program: Command): void {
  program
    .command('config [key] [value]')
    .description('Get or set configuration preferences')
    .action(handleConfig);
}
