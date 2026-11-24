# Architecture Overview
Target: machine consumption (AI agents) first, human readers second
Purpose: orientation before reading code; details live in the specs linked under Pointers
Scope: `scopy` CLI, npm `@kzer0x/scopy` v1.0.8, ~2080 LOC in `src/`

## Purpose & Scope
- Distributes files from registered sources to registered destinations
- Source: local dir or GitHub repo (optional subpath); destination: local dir only
- Single-user, local, scriptable; one process at a time
- Tracks every copy in a registry + file cache; enables `resync`, `ghost`, `log`, `purge`

## Tech Stack
- Node `>=20`, ESM, TypeScript 6 strict, target ES2022, module NodeNext
- Build: `tsc` compiles `src/` -> `dist/`; bin `scopy` = `dist/scopy.js`
- Runtime deps: `commander` (CLI), `conf` (JSON persistence), `env-paths` (data dir), `chalk` (colors), `@inquirer/checkbox` + `@inquirer/select` (prompts), `figlet` (banner in `info`)
- GitHub access: global `fetch` against REST API + raw content; no SDK, no auth token, no git clone
- Dev: `tsx` (`npm run dev`), `vitest` (`tests/**/*.test.ts`), typecheck `tsc --noEmit`

## Module Map
- `src/scopy.ts` — entry; reads `../package.json` (checked by `isPackageJson`), builds commander program, calls `register<X>(program)` per command, `program.parse()`
- `src/commands/*.ts` — one file per command; default export `register(program)` + exported handler(s)
  - `source.ts`, `dest.ts` — location registration (`add`, `remove`, `rename`, `list`)
  - `sync.ts` (largest, 516) — copy files source -> dest
  - `resync.ts` (372) — refresh tracked files of a dest
  - `ghost.ts` — hide/restore tracked files via cache
  - `log.ts`, `purge.ts` — read / prune copies registry
  - `list.ts`, `info.ts`, `config.ts` — listing, version + paths, prefs
- `src/config.ts` — only persistence layer (two `Conf` stores, file cache paths, prefs, tips)
- `src/types.ts` — `Source = GitSource | LocalSource` (discriminated on `type`), `Destination`, `CopyRecord`, `Prefs`, `AppState`, `ScopyConfig`, `CopiesConfig`, `PackageJson` + `isPackageJson`
- `src/github.ts` — `resolveBranchSha(owner, repo, branch)`: GET `repos/{o}/{r}/commits/{branch}` with `Accept: application/vnd.github.sha`; 404 -> "branch not found"
- `src/glob.ts` — `globPattern` (single-segment `*`), `hasGlobstar`, `matchGlobstar` (`**` = zero or more segments), `assertNoFlattenCollisions`
- `src/safe-path.ts` — `resolveInside(base, rel, {realpath?})`; throws on escape from base
- `src/validate.ts` — `validateLocalPath(dir)`: exists and is a directory
- `src/ui.ts` — chalk helpers: `heading`, `keyValue`, `listItem`, `printSourceList`, `printDestinationList`, `success`, `error`, `dim`, `blank`

## Layering
```
src/scopy.ts
    |
src/commands/*        (handlers hold business logic; no command imports another)
    |
    +-- config.ts      (only module touching Conf / registry / cache paths)
    +-- ui.ts  glob.ts  safe-path.ts  github.ts  validate.ts
    |
src/types.ts
```
- No service layer between commands and `config.ts`
- Commands never use `Conf` directly

## Persistent State
- Config store: `configDir` = `$SCOPY_CONFIG_DIR` ?? `~/.config/scopy`, file `scopy.json`
  - `{sources, destinations, prefs: {'sync.allowOverwrite'}, state: {tips}}`
- Copies registry: `dataPath` = `$SCOPY_DATA_DIR` ?? `envPaths('scopy', {suffix: ''}).data`, file `scopy-register.json`
  - `{copies: CopyRecord[]}`; `CopyRecord{source, destination, file, sourcePath?, copiedAt?, index?, ghosted?}`
  - `addCopy` upserts on `destination + file`; new record gets global `index` = max + 1 (`getNextIndex`); existing `index`/`ghosted` never reassigned; missing `index`/`ghosted` migrated on upsert
  - Other API: `getCopies`, `getCopiesBySource`, `getCopiesByDestination`, `purgeCopies(predicate)`, `getCopyByIndex`, `setGhosted`
- Location API: `getSources`/`addSource`/`removeSource`/`sourceExists`/`renameSource`; `getDestinations`/`addDestination`/`removeDestination`/`destinationExists`/`renameDestination`
  - `renameSource(old, new)`: rewrites `CopyRecord.source` (registry), then `sources[].name`
  - `renameDestination(old, new)`: moves `cache/<old>` -> `cache/<new>` (`fileCacheDir`), rewrites `CopyRecord.destination`, then `destinations[].name`; cache move and records rolled back if the registry/config write throws
- File cache: `fileCachePath(dest, index)` = `<dataPath>/cache/<dest>/<index>`; holds bytes of last copy; keyed by index, not by content
- Prefs: `PREF_KEYS` (`sync.allowOverwrite` only), `isPrefKey`, `getPrefs` (merges defaults), `getPref`, `setPref`
- Tips: `dismissTip`, `isTipDismissed`
- Concurrency: not supported; get/set sequences not atomic; parallel processes lose data silently (comment in `src/config.ts`)

## Core Flows
### Registration
- `source add <name> <location>`: `https://github.com/{owner}/{repo}[/{subpath}]` -> git source (repo URL + `path`); SSH and non-GitHub URLs rejected; else local path resolved + `validateLocalPath`; no network call; duplicate names rejected
- `dest add`: local dirs only
- `source rename <old> <new>`, `dest rename <old> <new>`: name only, location unchanged; checks in order: old not found, old === new, new exists; dest only: unsafe name (`resolveInside` against `<dataPath>/cache`), leftover records/cache for new -> hint `scopy purge log <new>`; source has no orphan check (orphan records adopted); updates copy records + cache dir (dest) so `resync`/`ghost`/`log` keep working

### sync
`sync <source>[/<fileSpec>] <dest> [--force] [--dry-run] [--branch]`
- Spec split at first `/`; source and dest must exist; `--branch` git only
- `force` = `--force` || pref `sync.allowOverwrite`; tip shown unless dismissed
- Git: owner/repo from location; optional `resolveBranchSha` -> SHA ref
  - Shallow spec: Contents API listing (`?ref={sha}` if branch); each file fetched from its `download_url`
  - Globstar spec: `git/trees/{ref|HEAD}?recursive=1`; error if `truncated`; filter by `matchGlobstar`; collision check; files fetched from `raw.githubusercontent.com/{o}/{r}/{ref|HEAD}/{path}`
- Local (`resolveFiles`): no spec = root files (non-recursive); `*` = glob in one dir; `**` = recursive walk + `matchGlobstar` + collision guard; explicit path (dir -> its immediate files)
- Both:
```
resolve files -> flatten to basename -> resolveInside(dest)
  -> conflicts? (force ? all : checkbox selectOverwrites)
  -> write dest file -> addCopy (upsert) -> write cache <dest>/<index>
  -> summary "N copied, N skipped" -> throw aggregated Error if any file failed
```
- `sourcePath` keeps full relative source path; dest is flat

### resync
`resync <dest> [--dry-run] [--unghost] [--clean] [--branch]`
- Reads registry for dest; groups records by source
- Git group: branch resolved once to SHA; per file Contents API `.../contents/{path}?ref=sha`, then fetch `download_url`; 404 = missing from source
- Local group: missing if source path gone
- Missing: warn, untrack (remove record + cache blob); `--clean` also deletes dest file; not an error exit
- Present: overwrite without confirmation; refresh registry + cache; ghosted files skipped
- Exit code 1 if any error; `--dry-run` detects missing files for local sources only
- `--unghost`: restore ghosted files from cache instead of fetching (exit code 1 on errors)
- Summary "N copied, N missing, N error(s)"

### ghost
`ghost [dest] [selector]`; selector = index | filename | wildcard
- Selector read as index only if it matches `/^\d+$/` (all digits), else filename/glob on `file`
- Toggle: ghost = delete dest file + `ghosted=true` (missing cache blob only warns); restore = copy cache -> dest + `ghosted=false` (missing cache blob = error)
- No dest or no selector -> interactive select

### log, purge, list, info, config
- `log [dest]`: registry grouped by destination; shows `index`, `file`, `copiedAt`, `[ghosted]`/`[unghosted]`; lists unsynced destinations
- `purge log <dest|*> [--dry-run] [--force]`: `purgeCopies` by predicate; y/N confirm unless `--force` or `--dry-run`; omitted dest = error; non-dry-run also deletes the cache blob of each removed record with an index; dest files kept
- `list`: sources + destinations; `info`: banner, name + version, config path, register path; `config [key] [value]`: get/set prefs, dismiss tips

## Cross-Cutting Concerns
- Path safety: `resolveInside` on every source read and dest write in `sync`/`resync`/`ghost`; rejects `..`, absolute, Windows `..\`; `{realpath: true}` on source reads also rejects symlinks/junctions resolving outside base
- Flattening: all files land at dest root by basename; `assertNoFlattenCollisions` aborts before any copy if two source paths share a basename
- Validation: `validateLocalPath` for local locations; existence checks via `sourceExists`/`destinationExists`
- Errors & exit: validation failures -> `ui.error` + return (exit 0, no throw); `sync` throws aggregated Error after loop on per-file failures (non-zero exit); `resync`, `ghost` (unsafe path) and `config` (bad key/value) set `process.exitCode = 1`; `log` with unknown dest calls `process.exit(1)`; GitHub API errors thrown with status + URL
- Destructive ops guarded by confirm prompts, `--dry-run`, `--force` opt-in, path containment
- UI: all console output via `src/ui.ts`
- Prefs/tips: stored in config store; `sync` reads `sync.allowOverwrite` and tip state

## Design Decisions
- No local git clone; GitHub HTTP API only; unauthenticated -> subject to GitHub rate limits; `github.com` only
- Flat destination by basename; collisions abort early
- Registry + per-index file cache enable `resync`, `ghost`/unghost without re-download
- JSON stores; single-user; non-concurrent

## Testing
- `vitest`; `tests/*.test.ts` per module/command: config, config-command, dest, fetchGitHubFiles, ghost, glob, purge, resync, safe-path, security, source, sync, types
- `tests/helpers.ts`: temp source/dest/config/data dirs; populates sources
- Isolation via `SCOPY_CONFIG_DIR` / `SCOPY_DATA_DIR`

## Known Gaps / Drift
- Structural: `sync.ts` and `resync.ts` each duplicate git/local branches (copy loop, cache write)
- Specs and `README.md` were aligned to the code; the code is the source of truth

## Pointers
- `detailed-spec/locations-registration.md` — config file, `source`/`dest` commands, validation
- `detailed-spec/sync.md` — `sync` signature, source spec resolution, git handling, copy behaviour, copies registry
- `detailed-spec/tracking.md` — `resync`, `log`, `ghost`, `purge log`
