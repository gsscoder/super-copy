export function isPackageJson(v) {
    if (typeof v !== 'object' || v === null)
        return false;
    if (!('name' in v) || typeof v.name !== 'string')
        return false;
    if (!('description' in v) || typeof v.description !== 'string')
        return false;
    if (!('version' in v) || typeof v.version !== 'string')
        return false;
    return true;
}
//# sourceMappingURL=types.js.map