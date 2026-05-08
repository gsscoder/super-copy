import Conf from 'conf';
import envPaths from 'env-paths';
import os from 'node:os';
import path from 'node:path';

// WARNING: concurrent access is not supported — config.get/set sequences are not atomic and parallel processes will cause silent data loss.
const config = new Conf({
  cwd: path.join(os.homedir(), '.config', 'scopy'),
  configName: 'scopy',
  defaults: { sources: [], destinations: [], repo_pull_ttl_sec: 0, lastPullTimestamps: {} },
  serialize: (data) => JSON.stringify(data, null, 2),
});

const dataPath = envPaths('scopy', { suffix: '' }).data;

const copiesConfig = new Conf({
  cwd: dataPath,
  configName: 'scopy-register',
  defaults: { copies: [] },
  serialize: (data) => JSON.stringify(data, null, 2),
});

/**
 * @returns {number}
 */
export function getRepoPullTtlSec() {
  return config.get('repo_pull_ttl_sec');
}

/**
 * @param {string} sourceName
 * @returns {string|null}
 */
export function getLastPull(sourceName) {
  const timestamps = config.get('lastPullTimestamps');
  return timestamps[sourceName] || null;
}

/**
 * @param {string} sourceName
 * @param {string} timestamp
 * @returns {void}
 */
export function setLastPull(sourceName, timestamp) {
  const timestamps = config.get('lastPullTimestamps');
  timestamps[sourceName] = timestamp;
  config.set('lastPullTimestamps', timestamps);
}

/**
 * @returns {Array<{name: string, location: string, path?: string}>}
 */
export function getSources() {
  return config.get('sources');
}

/**
 * @param {{name: string, location: string, path?: string}} source
 */
export function addSource(source) {
  const sources = getSources();
  sources.push(source);
  config.set('sources', sources);
}

/**
 * @param {string} name
 * @returns {boolean} true if removed, false if not found
 */
export function removeSource(name) {
  const sources = getSources();
  const index = sources.findIndex((s) => s.name === name);
  if (index === -1) {
    return false;
  }
  sources.splice(index, 1);
  config.set('sources', sources);
  return true;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function sourceExists(name) {
  return getSources().some((s) => s.name === name);
}

/**
 * @returns {Array<{name: string, location: string}>}
 */
export function getDestinations() {
  return config.get('destinations');
}

/**
 * @param {{name: string, location: string}} dest
 */
export function addDestination(dest) {
  const destinations = getDestinations();
  destinations.push(dest);
  config.set('destinations', destinations);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function removeDestination(name) {
  const destinations = getDestinations();
  const index = destinations.findIndex((d) => d.name === name);
  if (index === -1) {
    return false;
  }
  destinations.splice(index, 1);
  config.set('destinations', destinations);
  return true;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function destinationExists(name) {
  return getDestinations().some((d) => d.name === name);
}

/**
 * @returns {Array<{source: string, destination: string, file: string, copiedAt: string}>}
 */
export function getCopies() {
  return copiesConfig.get('copies');
}

/**
 * @param {{source: string, destination: string, file: string, copiedAt?: string}} record
 */
export function addCopy(record) {
  const copies = getCopies();
  const existing = copies.find(
    (c) => c.source === record.source && c.destination === record.destination && c.file === record.file
  );
  if (existing) {
    existing.copiedAt = record.copiedAt || new Date().toISOString();
  } else {
    copies.push({
      source: record.source,
      destination: record.destination,
      file: record.file,
      copiedAt: record.copiedAt || new Date().toISOString(),
    });
  }
  copiesConfig.set('copies', copies);
}

/**
 * @param {string} sourceName
 * @returns {Array<{source: string, destination: string, file: string, copiedAt: string}>}
 */
export function getCopiesBySource(sourceName) {
  return getCopies().filter((c) => c.source === sourceName);
}

/**
 * @param {string} destName
 * @returns {Array<{source: string, destination: string, file: string, copiedAt: string}>}
 */
export function getCopiesByDestination(destName) {
  return getCopies().filter((c) => c.destination === destName);
}
