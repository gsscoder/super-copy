import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface TestDirs {
  source: string;
  dest: string;
  config: string;
  data: string;
}

export function makeTempDirs(): TestDirs {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'scopy-test-'));
  const dirs: TestDirs = {
    source: path.join(base, 'source'),
    dest: path.join(base, 'dest'),
    config: path.join(base, 'config'),
    data: path.join(base, 'data'),
  };
  for (const d of Object.values(dirs)) {
    fs.mkdirSync(d, { recursive: true });
  }
  return dirs;
}

export function populateSource(dir: string, files: Record<string, string>): void {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
}

export function cleanup(dirs: TestDirs): void {
  const base = path.dirname(dirs.source);
  fs.rmSync(base, { recursive: true, force: true });
}

export async function setupConfig(dirs: TestDirs): Promise<void> {
  const { addSource, addDestination } = await import('../src/config.js');
  addSource({ type: 'local', name: 'test-src', location: dirs.source });
  addDestination({ name: 'test-dst', location: dirs.dest });
}

export async function registerGitSource(dirs: TestDirs, url: string): Promise<void> {
  const { addSource, addDestination } = await import('../src/config.js');
  addSource({ type: 'git', name: 'test-src', location: url });
  addDestination({ name: 'test-dst', location: dirs.dest });
}
