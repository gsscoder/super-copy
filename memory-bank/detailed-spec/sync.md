# Sync
Command for copying files from a registered source to a registered destination. Handles git and local sources, optional file filtering, overwrite confirmation, and a persistent copies registry.

## Command Signature
`scopy sync <source-spec> <dest> [--force] [--dry-run]`
- `source-spec` (str): `<sourceName>[/<fileSpec>]` — registered source name, optionally followed by `/` and a file path or glob pattern
- `dest` (str): registered destination name
- `--force`: skip per-file overwrite confirmation
- `--dry-run`: preview files to be copied without copying

## Source Spec Resolution
- No `/<fileSpec>`: copies all files at the root of the source work tree (non-recursive)
- `/<glob>`: e.g. `mysource/*.md` — matches files by glob pattern in the specified sub-directory
- `/<path>`: e.g. `mysource/CLAUDE.md` — copies a single specific file

## Git Source Handling
Git sources (location starts with `https://`) are cached locally at `<envPaths('scopy').data>/repos/<sourceName>`
- First sync: repository cloned with `--depth 1`
- Subsequent syncs: pulled to latest
- If source has a `path` field, work tree is `<cacheDir>/<source.path>`

## Copy Behaviour
Files are copied flat into the destination directory (basename only — no subdirectory structure preserved)
If a destination file exists and `--force` is not set: prompts `Overwrite <file>? [y/N]`; file is skipped if not confirmed
Each copied file is logged to the copies registry at `<envPaths('scopy').data>/scopy-register.json` (upsert by source + destination + file, updates `copiedAt` timestamp)
Summary printed on completion: `N copied, N skipped`

## Copies Registry
Schema of `<envPaths('scopy').data>/scopy-register.json`:
```json
{
  "copies": [
    { "source": "{sourceName}", "destination": "{destName}", "file": "{rel_path}", "copiedAt": "{iso8601}" }
  ]
}
```
- `source` (str): registered source name
- `destination` (str): registered destination name
- `file` (str): relative file path within the source work tree
- `copiedAt` (str): ISO 8601 timestamp of last copy

## Validation
- Errors if source name not registered
- Errors if destination name not registered
- Silently skips if no files match the spec