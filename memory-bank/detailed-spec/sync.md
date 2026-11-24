# Sync
Command for copying files from a registered source to a registered destination. Handles git and local sources, optional file filtering, overwrite confirmation, and a persistent copies registry.

## Command Signature
`scopy sync <source-spec> <dest> [--force] [--dry-run] [--branch <name>]`
- `source-spec` (str): `<sourceName>[/<fileSpec>]` — registered source name, optionally followed by `/` and a file path or glob pattern
- `dest` (str): registered destination name
- `--force`: skip overwrite confirmation (also honoured when `sync.allowOverwrite` pref is true)
- `--dry-run`: preview files to be copied without copying
- `--branch <name>`: fetch git source files from this branch instead of the default; valid only for git sources; not persisted — resync won't remember the branch unless `--branch` is passed again

## Source Spec Resolution
- No `/<fileSpec>`: copies all files at the root of the source work tree (non-recursive)
- `/<glob>`: e.g. `mysource/*.md` — matches files by glob pattern in the specified sub-directory (non-recursive)
- `/<globstar>`: e.g. `mysource/**/*.md` — recursively matches files at any depth under the work tree; only files are copied, never directories
- `/<globstar>` alone: e.g. `mysource/**` — all files recursively under the work tree
- `/<path>`: e.g. `mysource/CLAUDE.md` — copies a single specific file; a directory path expands its immediate files (non-recursive)
- Glob patterns use `*` (single segment) and `**` (zero or more path segments)
- The destination never replicates source directory structure: every matched file — single path, glob, or globstar, nested or not — is flattened to the destination root by basename. Only `sourcePath` in the copies registry retains the full source-relative path, for resync

## Git Source Handling
Git sources (GitHub HTTPS URLs) are fetched directly from the GitHub API — no local clone is made.
- Shallow specs (no `**`): file listing from `https://api.github.com/repos/{owner}/{repo}/contents/{path}` (only entries of type `file`); each file downloaded from the `download_url` the API returns for it
- Globstar specs (`**` in fileSpec): full tree from `https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1`; blobs filtered by globstar match, then downloaded from raw URL per matched path
- If source has a `path` field, it scopes the work tree; API paths are relative to that root
- Errors if the tree response is `truncated` (repo too large — user must narrow the query)
- With `--branch <name>`: the branch is resolved once to a commit SHA (`https://api.github.com/repos/{owner}/{repo}/commits/{branch}`) before any file listing; that SHA — never the raw branch name — is used as the ref: `git/trees/{sha}`, `contents/{path}?ref={sha}`, and `raw.githubusercontent.com/.../{sha}/{path}` (globstar downloads), avoiding ambiguity with slashes in branch names like `feature/x`. Without `--branch`, the tree and raw URLs use `HEAD` and the Contents request omits `ref`

## Copy Behaviour
Files matched by glob or globstar are copied flat into the destination directory (basename only — no subdirectory structure preserved)
If a destination file exists and `--force` is not set: interactive checkbox to select which conflicting files to overwrite; unselected files are skipped
Flattening collision guard: if two or more matched source files share the same basename, sync aborts before copying any file — user must narrow the query or rename files in the source
Each copied file is logged to the copies registry at `<envPaths('scopy').data>/scopy-register.json` (upsert by destination + file, updates `copiedAt` timestamp and `sourcePath`; the data dir can be overridden with `SCOPY_DATA_DIR`) and its bytes are stored in the file cache `<data>/cache/<dest>/<index>` (used by resync and ghost)
Summary printed on completion: `N copied, N skipped`. If any file failed, an aggregated error is thrown after the summary (non-zero exit)

## Copies Registry
Schema of `<envPaths('scopy').data>/scopy-register.json`:
```json
{
  "copies": [
    { "source": "{sourceName}", "destination": "{destName}", "file": "{dest_basename}", "sourcePath": "{source_rel_path}", "copiedAt": "{iso8601}", "index": 1, "ghosted": false }
  ]
}
```
- `source` (str): registered source name
- `destination` (str): registered destination name
- `file` (str): destination filename (basename for glob/globstar syncs)
- `sourcePath` (str): full relative path within the source work tree — used by resync to re-fetch nested files
- `copiedAt` (str): ISO 8601 timestamp of last copy
- `index` (int): global counter (max + 1 at creation), never reassigned; names the cache file and is the ghost selector
- `ghosted` (bool): file is removed from the destination and held in cache only

## Resync
See `tracking.md` — re-copies tracked files for a destination using the copies registry built by `sync`.

## Validation
- Errors if source name not registered
- Errors if destination name not registered
- Errors if `--branch` is used with a non-git source
- Errors if `--branch` names a branch that doesn't exist in the repo
- Errors on flattening basename collision within a single sync query (lists all conflicts)
- Errors if fileSpec escapes the source work tree (path traversal)
- Prints `No files to copy` and returns (no error) if no files match the spec
- Validation errors (unknown source/destination, `--branch` on a local source, branch resolution or listing failure) are printed and the command returns; only per-file copy failures set a non-zero exit