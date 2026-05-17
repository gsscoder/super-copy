import Conf from 'conf';
import envPaths from 'env-paths';
import os from 'node:os';
import path from 'node:path';
import type { AppState, CopiesConfig, CopyRecord, Destination, Prefs, ScopyConfig, Source } from './types.js';

// WARNING: concurrent access is not supported — config.get/set sequences are not atomic and parallel processes will cause silent data loss.
const configDir = process.env.SCOPY_CONFIG_DIR ?? path.join(os.homedir(), '.config', 'scopy');

const config = new Conf<ScopyConfig>({
  cwd: configDir,
  configName: 'scopy',
  defaults: { sources: [], destinations: [], prefs: { 'sync.allowOverwrite': false }, state: { tips: {} } },
  serialize: (data) => JSON.stringify(data, null, 2),
});

export const dataPath = process.env.SCOPY_DATA_DIR ?? envPaths('scopy', { suffix: '' }).data;

const copiesConfig = new Conf<CopiesConfig>({
  cwd: dataPath,
  configName: 'scopy-register',
  defaults: { copies: [] },
  serialize: (data) => JSON.stringify(data, null, 2),
});

export function getSources(): Source[] {
  return config.get('sources');
}

export function addSource(source: Source): void {
  const sources = getSources();
  sources.push(source);
  config.set('sources', sources);
}

export function removeSource(name: string): boolean {
  const sources = getSources();
  const index = sources.findIndex((s) => s.name === name);
  if (index === -1) {
    return false;
  }
  sources.splice(index, 1);
  config.set('sources', sources);
  return true;
}

export function sourceExists(name: string): boolean {
  return getSources().some((s) => s.name === name);
}

export function getDestinations(): Destination[] {
  return config.get('destinations');
}

export function addDestination(dest: Destination): void {
  const destinations = getDestinations();
  destinations.push(dest);
  config.set('destinations', destinations);
}

export function removeDestination(name: string): boolean {
  const destinations = getDestinations();
  const index = destinations.findIndex((d) => d.name === name);
  if (index === -1) {
    return false;
  }
  destinations.splice(index, 1);
  config.set('destinations', destinations);
  return true;
}

export function destinationExists(name: string): boolean {
  return getDestinations().some((d) => d.name === name);
}

export function getCopies(): CopyRecord[] {
  return copiesConfig.get('copies');
}

export function addCopy(record: CopyRecord): void {
  const copies = getCopies();
  const existing = copies.find(
    (c) => c.destination === record.destination && c.file === record.file
  );
  if (existing) {
    // Upsert: update copiedAt and source; never reassign index or ghosted
    existing.source = record.source;
    existing.copiedAt = record.copiedAt ?? new Date().toISOString();
    if (record.sourcePath !== undefined) {
      existing.sourcePath = record.sourcePath;
    }
    // Migration: assign index if missing
    if (existing.index === undefined) {
      existing.index = getNextIndex();
    }
    // Migration: default ghosted to false if missing
    if (existing.ghosted === undefined) {
      existing.ghosted = false;
    }
  } else {
    copies.push({
      source: record.source,
      destination: record.destination,
      file: record.file,
      sourcePath: record.sourcePath,
      copiedAt: record.copiedAt ?? new Date().toISOString(),
      index: getNextIndex(),
      ghosted: false,
    });
  }
  copiesConfig.set('copies', copies);
}

export function getCopiesBySource(sourceName: string): CopyRecord[] {
  return getCopies().filter((c) => c.source === sourceName);
}

export function getCopiesByDestination(destName: string): CopyRecord[] {
  return getCopies().filter((c) => c.destination === destName);
}

export function purgeCopies(predicate: (r: CopyRecord) => boolean): number {
  const copies = getCopies();
  const kept = copies.filter((r) => !predicate(r));
  const removed = copies.length - kept.length;
  if (removed > 0) {
    copiesConfig.set('copies', kept);
  }
  return removed;
}

export function getNextIndex(): number {
  const copies = getCopies();
  const maxIndex = copies.reduce((max, c) => {
    const idx = c.index ?? 0;
    return idx > max ? idx : max;
  }, 0);
  return maxIndex + 1;
}

export function getCopyByIndex(destName: string, index: number): CopyRecord | undefined {
  return getCopiesByDestination(destName).find((c) => c.index === index);
}

export function setGhosted(destName: string, index: number, ghosted: boolean): boolean {
  const copies = getCopies();
  const record = copies.find((c) => c.destination === destName && c.index === index);
  if (!record) return false;
  record.ghosted = ghosted;
  copiesConfig.set('copies', copies);
  return true;
}

export function fileCacheDir(destName: string): string {
  return path.join(dataPath, 'cache', destName);
}

export function fileCachePath(destName: string, index: number): string {
  return path.join(fileCacheDir(destName), String(index));
}

export const PREF_KEYS = ['sync.allowOverwrite'] as const;
export type PrefKey = typeof PREF_KEYS[number];

const PREF_DEFAULTS: Prefs = { 'sync.allowOverwrite': false };

export function getPrefs(): Prefs {
  const stored = config.get('prefs');
  const merged: Prefs = { ...PREF_DEFAULTS, ...(stored ?? {}) };
  if (stored === undefined || PREF_KEYS.some((k) => !(k in stored))) {
    config.set('prefs', merged);
  }
  return merged;
}

export function getPref<K extends PrefKey>(key: K): Prefs[K] {
  return getPrefs()[key];
}

export function setPref<K extends PrefKey>(key: K, value: Prefs[K]): void {
  const prefs = getPrefs();
  prefs[key] = value;
  config.set('prefs', prefs);
}

export function dismissTip(key: string): void {
  const state = config.get('state') ?? { tips: {} };
  state.tips = { ...state.tips, [key]: true };
  config.set('state', state);
}

export function isTipDismissed(key: string): boolean {
  return (config.get('state')?.tips?.[key]) === true;
}
