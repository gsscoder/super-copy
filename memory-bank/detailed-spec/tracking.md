# Tracking
Commands for re-syncing, inspecting, toggling, and purging tracked file copies

## Resync
Re-copies all tracked active files for a destination from their original sources

### Command Signature
`scopy resync <dest> [--dry-run] [--unghost] [--clean] [--branch <name>]`
- `dest` (str): registered destination name
- `--dry-run`: preview files without copying
- `--unghost`: restore ghosted files from cache instead of re-copying active files
- `--clean`: also delete destination files that are missing from source (see below); without it, such files are untracked but left in place
- `--branch <name>`: fetch git source groups from this branch instead of the default; not persisted in the registry — a later resync without `--branch` falls back to the default branch

### Resolution
- Reads all registry entries where `destination` matches `<dest>`
- Groups entries by source name
- Handles git sources (fetches each file from `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{subPath}/{file}`) and local sources
- With `--branch <name>`: for each git source group, the branch is resolved once (per group, not globally — a resync can span multiple git sources across different repos) to a commit SHA via `https://api.github.com/repos/{owner}/{repo}/commits/{branch}`; that SHA is appended as `?ref={sha}` to the group's Contents API requests. A no-op for local-source groups

### Copy Behaviour
Files are overwritten without confirmation. Each copied file updates its registry entry via `addCopy` upsert (`copiedAt` timestamp) and refreshes the file cache at `fileCachePath(dest, index)`

### Missing-From-Source Behaviour
A tracked file is missing when its local source path no longer exists, or a git source's Contents API returns 404 (other fetch failures remain plain errors, keeping the entry tracked for retry). On detection, per file:
- Prints a warning (⚠) instead of a checkmark
- Untracks it — removes the registry entry and its cached blob — regardless of `--clean`
- With `--clean`: also deletes the file from the destination
- Without `--clean`: leaves the destination file in place
- Does not set a non-zero exit code (untracking a stale file is cleanup, not a failure)
- `--dry-run` previews the same detection without untracking, deleting, or writing anything

### `--unghost` Behaviour
Instead of re-copying from source, restores ghosted files from `fileCachePath(dest, index)`. Sets `ghosted=false` in the registry. Active (non-ghosted) files are not touched. Missing-from-source detection does not apply here

### Summary
- Normal: `N copied, N missing, N error(s)`; when any files are missing, a trailing report lists their destination paths under `untracked file(s) missing from source:`, with a `use '--clean' to automatically remove` hint unless `--clean` was already used
- Unghost: `N restored, N error(s)`

### Validation
- Errors if dest not registered
- Errors if no tracked files exist for dest
- If `--branch <name>` names a branch that doesn't exist for a given git source, only that source's group fails (error reported, error count bumped by the group's file count); other groups still resync normally

## Log
Shows tracked files grouped by destination, read from the copies registry

### Command Signature
`scopy log [dest]`
- `dest` (str, optional): registered destination name

### Output
Each row: index, filename, `copiedAt` timestamp, `[ghosted]` tag if file is ghosted.

- Without `dest`: lists all destinations split into two groups — destinations with files, and destinations not yet synced
- With `dest`: shows only that destination's entries

### Validation
- Errors if `dest` provided but not registered

## Ghost
Toggles a tracked file between present and ghosted state by index

### Command Signature
`scopy ghost <dest> <selector>`
- `dest` (str): registered destination name
- `selector`: file index (int), exact filename, or wildcard pattern (e.g. `task-*`)

### Ghost (active → ghosted)
Removes the file from the destination directory. Sets `ghosted=true` in the registry. Cache at `fileCachePath(dest, index)` is expected to already exist; warns if missing

### Restore (ghosted → active)
Copies from `fileCachePath(dest, index)` back to the destination directory. Sets `ghosted=false` in the registry. Updates `copiedAt` via `addCopy` upsert

### Validation
- Errors if dest not registered
- Errors if selector is an index and no matching record exists
- Warns (dim) if no files match a filename/wildcard selector
- Errors if cache file missing on restore

## Purge
Deletes cached data from the copy log

### `purge log`
`scopy purge log [dest] [--dry-run]`
- `*`: purge all copy log entries
- `<destName>`: purge entries where `destination === destName`
- omitted: no-op (prints nothing-to-purge message)
- `--dry-run`: shows candidates without modifying the registry