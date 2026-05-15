import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';
import {
  getSources,
  getDestinations,
  destinationExists,
  addCopy,
  getCopiesByDestination,
  fileCacheDir,
  fileCachePath,
  setGhosted,
} from '../config.js';
import { error as uiError, dim } from '../ui.js';
import type { CopyRecord, Source } from '../types.js';

export interface ResyncOptions {
  dryRun: boolean;
  unghost: boolean;
}

export async function handleResync(dest: string, opts: ResyncOptions): Promise<void> {
      const dryRun = opts.dryRun;

      if (!destinationExists(dest)) {
        uiError(`Destination "${dest}" is not registered`);
        return;
      }

      const destinations = getDestinations();
      const destination = destinations.find((d) => d.name === dest);
      if (destination === undefined) {
        uiError(`Destination "${dest}" is not registered`);
        return;
      }

      const records = getCopiesByDestination(dest);
      if (records.length === 0) {
        dim(`No tracked files for "${dest}"`);
        return;
      }

      const ghostedRecords = records.filter((r) => r.ghosted);
      const activeRecords = records.filter((r) => !r.ghosted);

      // --unghost: restore ghosted files from cache
      if (opts.unghost) {
        if (ghostedRecords.length === 0) {
          dim('No ghosted files to restore');
          return;
        }

        if (dryRun) {
          console.log(`Would restore ${ghostedRecords.length} ghosted file(s):`);
          for (const record of ghostedRecords) {
            console.log(chalk.dim(`· ${record.file}`));
          }
          return;
        }

        let restored = 0;
        let errs = 0;
        for (const record of ghostedRecords) {
          if (record.index === undefined) {
            console.log(`❌ ${record.file}: missing index, cannot restore`);
            errs++;
            continue;
          }
          const cachePath = fileCachePath(dest, record.index);
          if (!fs.existsSync(cachePath)) {
            console.log(`❌ ${record.file}: cache not found, cannot restore`);
            errs++;
            continue;
          }
          const destPath = path.join(destination.location, record.file);
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(cachePath, destPath);
          setGhosted(dest, record.index, false);
          addCopy({
            source: record.source,
            destination: dest,
            file: record.file,
            copiedAt: new Date().toISOString(),
          });
          console.log(`${chalk.green('✓')} ${record.file} (restored from cache)`);
          restored++;
        }

        const restoredStr = chalk.green(String(restored));
        const errStr = errs > 0 ? chalk.red(`${errs} error(s)`) : `${errs} error(s)`;
        console.log(`${restoredStr} restored, ${errStr}`);
        if (errs > 0) process.exitCode = 1;
        return;
      }

      // Group records by source name
      const bySource = new Map<string, CopyRecord[]>();
      for (const record of activeRecords) {
        const group = bySource.get(record.source);
        if (group !== undefined) {
          group.push(record);
        } else {
          bySource.set(record.source, [record]);
        }
      }

      const sources = getSources();

      if (dryRun) {
        // Collect all valid files first, then list
        const validFiles: string[] = [];
        for (const [sourceName, group] of bySource) {
          const source: Source | undefined = sources.find((s) => s.name === sourceName);
          if (source === undefined) {
            for (const record of group) {
              console.log(`❌ ${record.file}: source "${sourceName}" is no longer registered`);
            }
            continue;
          }

          if (source.type === 'git') {
            for (const record of group) {
              validFiles.push(record.file);
            }
            continue;
          }

          const workTree: string = source.location;
          for (const record of group) {
            const srcPath = path.join(workTree, record.file);
            if (!fs.existsSync(srcPath)) {
              console.log(`❌ ${record.file}: file not found in source`);
              continue;
            }
            validFiles.push(record.file);
          }
        }

        console.log(`Would copy ${validFiles.length} file(s)`);
        for (const file of validFiles) {
          console.log(chalk.dim(`· ${file}`));
        }
        return;
      }

      let copied = 0;
      let errors = 0;

      for (const [sourceName, group] of bySource) {
        const source: Source | undefined = sources.find((s) => s.name === sourceName);
        if (source === undefined) {
          for (const record of group) {
            console.log(`❌ ${record.file}: source "${sourceName}" is no longer registered`);
            errors++;
          }
          continue;
        }

        if (source.type === 'git') {
          // Parse owner/repo from stored location (https://github.com/{owner}/{repo})
          const urlParts = new URL(source.location).pathname.split('/').filter(Boolean);
          const owner = urlParts[0];
          const repo = urlParts[1];
          const subPath = source.path ? source.path.replace(/^\//, '') : '';

          for (const record of group) {
            const filePath = subPath ? `${subPath}/${record.file}` : record.file;
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${filePath}`;
            try {
              const res = await fetch(rawUrl);
              if (!res.ok) {
                console.log(`❌ ${record.file}: HTTP ${res.status}`);
                errors++;
                continue;
              }
              const content = Buffer.from(await res.arrayBuffer());
              const destPath = path.join(destination.location, record.file);
              fs.mkdirSync(path.dirname(destPath), { recursive: true });
              fs.writeFileSync(destPath, content);
              if (record.index !== undefined) {
                fs.mkdirSync(fileCacheDir(dest), { recursive: true });
                fs.writeFileSync(fileCachePath(dest, record.index), content);
              }
              addCopy({ source: sourceName, destination: dest, file: record.file, copiedAt: new Date().toISOString() });
              console.log(`${chalk.green('✓')} ${record.file}`);
              copied++;
            } catch (err) {
              console.log(`❌ ${record.file}: ${err instanceof Error ? err.message : String(err)}`);
              errors++;
            }
          }
          continue; // next source group
        }

        // Local source
        const workTree: string = source.location;

        for (const record of group) {
          const srcPath = path.join(workTree, record.file);
          if (!fs.existsSync(srcPath)) {
            console.log(`❌ ${record.file}: file not found in source`);
            errors++;
            continue;
          }

          const destPath = path.join(destination.location, record.file);
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(srcPath, destPath);
          if (record.index !== undefined) {
            fs.mkdirSync(fileCacheDir(dest), { recursive: true });
            fs.copyFileSync(srcPath, fileCachePath(dest, record.index));
          }
          addCopy({
            source: sourceName,
            destination: dest,
            file: record.file,
            copiedAt: new Date().toISOString(),
          });
          console.log(`${chalk.green('✓')} ${record.file}`);
          copied++;
        }
      }

      const copiedStr = chalk.green(String(copied));
      const errorStr = errors > 0 ? chalk.red(`${errors} error(s)`) : `${errors} error(s)`;
      console.log(`${copiedStr} copied, ${errorStr}`);

      if (errors > 0) {
        process.exitCode = 1;
      }
}

export default function registerResync(program: Command): void {
  program
    .command('resync <dest>')
    .description('Re-copy all tracked files to a destination')
    .option('--dry-run', 'Preview what would be copied without making changes')
    .option('--unghost', 'Restore ghosted files from cache')
    .action(handleResync);
}
