import fs from 'node:fs';
import path from 'node:path';

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}

/**
 * Join `rel` onto `base` and throw if the result leaves `base`.
 * Catches `..`, absolute paths, and (on Windows) `..\` segments.
 * With `realpath: true` it also resolves symlinks/junctions of an existing target,
 * so a link inside `base` that points outside is rejected.
 */
export function resolveInside(base: string, rel: string, opts: { realpath?: boolean } = {}): string {
  const root = path.resolve(base);
  const full = path.resolve(root, rel);
  if (!isInside(root, full)) {
    throw new Error(`path escapes base directory: ${rel}`);
  }
  if (opts.realpath === true && fs.existsSync(full) && !isInside(fs.realpathSync(root), fs.realpathSync(full))) {
    throw new Error(`path escapes base directory via link: ${rel}`);
  }
  return full;
}
