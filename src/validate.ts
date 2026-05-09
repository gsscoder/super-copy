import fs from 'node:fs';
import path from 'node:path';

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateLocalPath(dir: string): ValidationResult {
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    return { valid: false, error: `path does not exist: ${resolved}` };
  }
  if (!fs.statSync(resolved).isDirectory()) {
    return { valid: false, error: `not a directory: ${resolved}` };
  }
  return { valid: true };
}
