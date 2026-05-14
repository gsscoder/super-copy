# Tracking
Commands for re-syncing, inspecting, toggling, and purging tracked file copies

## Resync
Re-copies all tracked active files for a destination from their original sources

### Command Signature
`scopy resync <dest> [--dry-run] [--unghost]`
- `dest` (str): registered destination name
- `--dry-run`: preview files without copying
- `--unghost`: restore ghosted files from cache instead of re-copying active files

### Resolution
- Reads all registry entries where `destination` matches `<dest>`
- Groups entries by source name
- Handles git sources (clone with `--depth 1` on first use, pull on subsequent; TTL-gated) and local sources

### Copy Behaviour
Files are overwritten without confirmation. Each copied file updates its registry entry via `addCopy` upsert (`copiedAt` timestamp) and refreshes the file cache at `fileCachePath(dest, index)`

### `--unghost` Behaviour
Instead of re-copying from source, restores ghosted files from `fileCachePath(dest, index)`. Sets `ghosted=false` in the registry. Active (non-ghosted) files are not touched

### Summary
- Normal: `N copied, N error(s)`
- Unghost: `N restored, N error(s)`

### Validation
- Errors if dest not registered
- Errors if no tracked files exist for dest

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
`scopy ghost <dest> <file-index>`
- `dest` (str): registered destination name
- `file-index` (int): index of the tracked file as shown by `scopy log`

### Ghost (active → ghosted)
Removes the file from the destination directory. Sets `ghosted=true` in the registry. Cache at `fileCachePath(dest, index)` is expected to already exist; warns if missing

### Restore (ghosted → active)
Copies from `fileCachePath(dest, index)` back to the destination directory. Sets `ghosted=false` in the registry. Updates `copiedAt` via `addCopy` upsert

### Validation
- Errors if dest not registered
- Errors if file-index is invalid
- Errors if cache file missing on restore

## Purge
Deletes cached data from repos or the copy log

### `purge repos`
`scopy purge repos [--dry-run]`

Deletes all cloned git repo cache directories under `<envPaths('scopy').data>/repos`
- `--dry-run`: lists directories without deleting

### `purge log`
`scopy purge log [dest] [--dry-run]`
- `*`: purge all copy log entries
- `<destName>`: purge entries where `destination === destName`
- omitted: no-op (prints nothing-to-purge message)
- `--dry-run`: shows candidates without modifying the registry