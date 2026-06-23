import Conf from 'conf';
import envPaths from 'env-paths';
import os from 'node:os';
import path from 'node:path';
// WARNING: concurrent access is not supported — config.get/set sequences are not atomic and parallel processes will cause silent data loss.
export const configDir = process.env.SCOPY_CONFIG_DIR ?? path.join(os.homedir(), '.config', 'scopy');
const config = new Conf({
    cwd: configDir,
    configName: 'scopy',
    defaults: { sources: [], destinations: [], prefs: { 'sync.allowOverwrite': false }, state: { tips: {} } },
    serialize: (data) => JSON.stringify(data, null, 2),
});
export const dataPath = process.env.SCOPY_DATA_DIR ?? envPaths('scopy', { suffix: '' }).data;
const copiesConfig = new Conf({
    cwd: dataPath,
    configName: 'scopy-register',
    defaults: { copies: [] },
    serialize: (data) => JSON.stringify(data, null, 2),
});
export function getSources() {
    return config.get('sources');
}
export function addSource(source) {
    const sources = getSources();
    sources.push(source);
    config.set('sources', sources);
}
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
export function sourceExists(name) {
    return getSources().some((s) => s.name === name);
}
export function getDestinations() {
    return config.get('destinations');
}
export function addDestination(dest) {
    const destinations = getDestinations();
    destinations.push(dest);
    config.set('destinations', destinations);
}
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
export function destinationExists(name) {
    return getDestinations().some((d) => d.name === name);
}
export function getCopies() {
    return copiesConfig.get('copies');
}
export function addCopy(record) {
    const copies = getCopies();
    const existing = copies.find((c) => c.destination === record.destination && c.file === record.file);
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
    }
    else {
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
export function getCopiesBySource(sourceName) {
    return getCopies().filter((c) => c.source === sourceName);
}
export function getCopiesByDestination(destName) {
    return getCopies().filter((c) => c.destination === destName);
}
export function purgeCopies(predicate) {
    const copies = getCopies();
    const kept = copies.filter((r) => !predicate(r));
    const removed = copies.length - kept.length;
    if (removed > 0) {
        copiesConfig.set('copies', kept);
    }
    return removed;
}
export function getNextIndex() {
    const copies = getCopies();
    const maxIndex = copies.reduce((max, c) => {
        const idx = c.index ?? 0;
        return idx > max ? idx : max;
    }, 0);
    return maxIndex + 1;
}
export function getCopyByIndex(destName, index) {
    return getCopiesByDestination(destName).find((c) => c.index === index);
}
export function setGhosted(destName, index, ghosted) {
    const copies = getCopies();
    const record = copies.find((c) => c.destination === destName && c.index === index);
    if (!record)
        return false;
    record.ghosted = ghosted;
    copiesConfig.set('copies', copies);
    return true;
}
export function fileCacheDir(destName) {
    return path.join(dataPath, 'cache', destName);
}
export function fileCachePath(destName, index) {
    return path.join(fileCacheDir(destName), String(index));
}
export const PREF_KEYS = ['sync.allowOverwrite'];
export function isPrefKey(key) {
    return PREF_KEYS.includes(key);
}
const PREF_DEFAULTS = { 'sync.allowOverwrite': false };
export function getPrefs() {
    const stored = config.get('prefs');
    const merged = { ...PREF_DEFAULTS, ...(stored ?? {}) };
    if (stored === undefined || PREF_KEYS.some((k) => !(k in stored))) {
        config.set('prefs', merged);
    }
    return merged;
}
export function getPref(key) {
    return getPrefs()[key];
}
export function setPref(key, value) {
    const prefs = getPrefs();
    prefs[key] = value;
    config.set('prefs', prefs);
}
export function dismissTip(key) {
    const state = config.get('state') ?? { tips: {} };
    state.tips = { ...state.tips, [key]: true };
    config.set('state', state);
}
export function isTipDismissed(key) {
    return (config.get('state')?.tips?.[key]) === true;
}
//# sourceMappingURL=config.js.map