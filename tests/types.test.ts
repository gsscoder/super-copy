import { describe, expect, it } from 'vitest';
import { isPackageJson } from '../src/types.js';

describe('isPackageJson', () => {
  it('valid package.json shape returns true', () => {
    expect(isPackageJson({ name: 'scopy', description: 'a tool', version: '1.0.0' })).toBe(true);
  });

  it('missing field returns false', () => {
    expect(isPackageJson({ name: 'scopy', version: '1.0.0' })).toBe(false);
  });

  it('wrong type for a field returns false', () => {
    expect(isPackageJson({ name: 'scopy', description: 'a tool', version: 1 })).toBe(false);
  });

  it('null input returns false', () => {
    expect(isPackageJson(null)).toBe(false);
  });

  it('non-object input returns false', () => {
    expect(isPackageJson('not an object')).toBe(false);
  });
});
