import chalk from 'chalk';
import { getPrefs, getPref, setPref, dismissTip, PREF_KEYS, isPrefKey } from '../config.js';
import { error as uiError } from '../ui.js';
const PREF_VALUES = {
    'sync.allowOverwrite': ['true', 'false'],
};
function handleConfig(key, value) {
    if (key === undefined) {
        const prefs = getPrefs();
        for (const k of PREF_KEYS) {
            console.log(`${k}=${chalk.cyan(String(prefs[k]))}`);
        }
        return;
    }
    if (!isPrefKey(key)) {
        uiError(`unknown key "${key}". Valid keys: ${PREF_KEYS.join(', ')}`);
        process.exitCode = 1;
        return;
    }
    if (value === undefined) {
        console.log(`${key}=${chalk.cyan(String(getPref(key)))}`);
        return;
    }
    const allowed = PREF_VALUES[key];
    if (!allowed.includes(value)) {
        uiError(`invalid value "${value}" for "${key}". Allowed: ${allowed.join(', ')}`);
        process.exitCode = 1;
        return;
    }
    if (key === 'sync.allowOverwrite') {
        setPref(key, value === 'true');
        if (value === 'true') {
            dismissTip('sync.allowOverwrite');
        }
    }
    console.log(`${key}=${chalk.cyan(value)}`);
}
export default function registerConfig(program) {
    program
        .command('config [key] [value]')
        .description('Get or set configuration preferences')
        .action(handleConfig);
}
//# sourceMappingURL=config.js.map