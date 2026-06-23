export function globPattern(pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + escaped + '$');
}
export function hasGlobstar(pattern) {
    return pattern.includes('**');
}
function matchGlobSegment(segment, name) {
    return globPattern(segment).test(name);
}
function matchGlobstarSegments(patternParts, pathParts, pi, si) {
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
export function matchGlobstar(pattern, relativePath) {
    const patternParts = pattern.split('/').filter((p) => p.length > 0);
    const pathParts = relativePath.split('/').filter((p) => p.length > 0);
    return matchGlobstarSegments(patternParts, pathParts, 0, 0);
}
export function assertNoFlattenCollisions(candidates) {
    const byName = new Map();
    for (const { name, sourcePath } of candidates) {
        const paths = byName.get(name);
        if (paths === undefined) {
            byName.set(name, [sourcePath]);
        }
        else {
            paths.push(sourcePath);
        }
    }
    const collisions = [...byName.entries()].filter(([, paths]) => paths.length > 1);
    if (collisions.length === 0) {
        return;
    }
    const lines = collisions.map(([name, paths]) => `  ${name} ← ${paths.join(', ')}`);
    throw new Error('flattening collision — multiple source files map to the same destination name:\n' +
        lines.join('\n') +
        '\nNarrow your query or rename files in the source.');
}
//# sourceMappingURL=glob.js.map