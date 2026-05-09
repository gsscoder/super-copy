import Conf from 'conf';
import envPaths from 'env-paths';
import os from 'node:os';
import path from 'node:path';
import type { CopiesConfig, CopyRecord, Destination, ScopyConfig, Source } from './types.js';

// WARNING: concurrent access is not supported — config.get/set sequences are not atomic and parallel processes will cause silent data loss.
const config = new Conf<ScopyConfig>({
  cwd: path.join(os.homedir(), '.config', 'scopy'),
  configName: 'scopy',
  defaults: { sources: [], destinations: [], repo_pull_ttl_sec: 0, lastPullTimestamps: {} },
  serialize: (data) => JSON.stringify(data, null, 2),
});

const dataPath = envPaths('scopy', { suffix: '' }).data;

const copiesConfig = new Conf<CopiesConfig>({
  cwd: dataPath,
  configName: 'scopy-register',
  defaults: { copies: [] },
  serialize: (data) => JSON.stringify(data, null, 2),
});

export function getRepoPullTtlSec(): number {
  return config.get('repo_pull_ttl_sec');
}

export function getLastPull(sourceName: string): string | null {
  const timestamps = config.get('lastPullTimestamps');
  return timestamps[sourceName] || null;
}

export function setLastPull(sourceName: string, timestamp: string): void {
  const timestamps = config.get('lastPullTimestamps');
  timestamps[sourceName] = timestamp;
  config.set('lastPullTimestamps', timestamps);
}

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
    (c) => c.source === record.source && c.destination === record.destination && c.file === record.file
  );
  if (existing) {
    existing.copiedAt = record.copiedAt ?? new Date().toISOString();
  } else {
    copies.push({
      source: record.source,
      destination: record.destination,
      file: record.file,
      copiedAt: record.copiedAt ?? new Date().toISOString(),
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
