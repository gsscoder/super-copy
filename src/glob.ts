export function globPattern(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}

export function hasGlobstar(pattern: string): boolean {
  return pattern.includes('**');
}

function matchGlobSegment(segment: string, name: string): boolean {
  return globPattern(segment).test(name);
}

function matchGlobstarSegments(patternParts: string[], pathParts: string[], pi: number, si: number): boolean {
  if (pi === patternParts.length) {
    return si === pathParts.length;
  }

  const part = patternParts[pi];
  if (part === '**') {
    if (pi === patternParts.length - 1) {
      return si <= pathParts.length;
    }
    for (let skip = 0; skip <= pathParts.length - si; skip++) {
      if (matchGlobstarSegments(patternParts, pathParts, pi + 1, si + skip)) {
        return true;
      }
    }
    return false;
  }

  if (si >= pathParts.length) {
    return false;
  }

  if (!matchGlobSegment(part, pathParts[si])) {
    return false;
  }

  return matchGlobstarSegments(patternParts, pathParts, pi + 1, si + 1);
}

export function matchGlobstar(pattern: string, relativePath: string): boolean {
  const patternParts = pattern.split('/').filter((p) => p.length > 0);
  const pathParts = relativePath.split('/').filter((p) => p.length > 0);
  return matchGlobstarSegments(patternParts, pathParts, 0, 0);
}

export interface FlattenCandidate {
  name: string
  sourcePath: string
}

export function assertNoFlattenCollisions(candidates: FlattenCandidate[]): void {
  const byName = new Map<string, string[]>();
  for (const { name, sourcePath } of candidates) {
    const paths = byName.get(name);
    if (paths === undefined) {
      byName.set(name, [sourcePath]);
    } else {
      paths.push(sourcePath);
    }
  }

  const collisions = [...byName.entries()].filter(([, paths]) => paths.length > 1);
  if (collisions.length === 0) {
    return;
  }

  const lines = collisions.map(([name, paths]) =>
    `  ${name} ← ${paths.join(', ')}`,
  );
  throw new Error(
    'flattening collision — multiple source files map to the same destination name:\n' +
    lines.join('\n') +
    '\nNarrow your query or rename files in the source.',
  );
}