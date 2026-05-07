import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} dir
 * @returns {{valid: boolean, error?: string}}
 */
export function validateLocalPath(dir) {
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    return { valid: false, error: `Path does not exist: ${resolved}` };
  }
  if (!fs.statSync(resolved).isDirectory()) {
    return { valid: false, error: `Not a directory: ${resolved}` };
  }
  return { valid: true };
}
