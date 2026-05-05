import Conf from 'conf';
import os from 'node:os';
import path from 'node:path';

const config = new Conf({
  cwd: path.join(os.homedir(), '.config', 'scopy'),
  configName: 'scopy',
  defaults: { sources: [] },
  serialize: (data) => JSON.stringify(data, null, 2),
});

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
