# Locations Registration

Commands and config for registering asset locations — sources to copy from, and destinations to copy to. Each location is an entry in the config file at `~/.config/scopy/scopy.json`. Sources can be git repositories (HTTPS) or local directories.

## Config File
Location: `~/.config/scopy/scopy.json` (user home, `.config/scopy/` directory); created on first write. The directory can be overridden with the `SCOPY_CONFIG_DIR` env var
```json
{
  "sources": [
    { "type": "git|local", "name": "{name}", "location": "{uri|abs_path}", "path": "{path?}" }
  ],
  "destinations": [
    { "name": "{name}", "location": "{abs_path}" }
  ],
  "prefs": { "sync.allowOverwrite": false },
  "state": { "tips": {} }
}
```
- `sources` — array of registered source locations
- `type` (str): `git` or `local`
- `name` (str): unique identifier for the source
- `location` (str): absolute URL (git) or absolute filesystem path (local)
- `path` (str, optional): sub-path within a git repository; only present for git sources
- `destinations` — array of registered destination locations
- `name` (str): unique identifier for the destination
- `location` (str): absolute filesystem path (local)
- `prefs` — user preferences (see `scopy config`); `state.tips` — dismissed one-time tips

## Source Command
`scopy source` manages the set of registered asset sources
To add a source, run `scopy source add <name> <location>`. The location is parsed to determine its type. A location starting with `https://` is a git URL: it must have host `github.com` and at least `{owner}/{repo}` (`https://github.com/{owner}/{repo}[/{subpath}]`), else `invalid location`. Any other location (including SSH `git@` and `http://`) is treated as a local path and fails validation (`path does not exist`). An optional sub-path is extracted: `https://github.com/owner/repo/path/to/dir` resolves to base repo `https://github.com/owner/repo` with sub-path `/path/to/dir`. No network call is made during registration.
Local paths are resolved to an absolute path and validated to exist as a directory (not a file)
To remove a source, run `scopy source remove <name>`. Errors if the name is not found
To rename a source, run `scopy source rename <old> <new>`. Only the name changes; `type`, `location` and `path` stay as they are. Every copy record with `source` equal to `<old>` is updated to `<new>` (copies registry written first, then the config). No orphan check is done: existing copy records already named `<new>` are adopted by the renamed source
To list all registered sources, run `scopy source list`

## Destination Command
`scopy dest` manages the set of registered destination locations
To add a destination, run `scopy dest add <name> <location>`. The location must be a local filesystem path. It is resolved to an absolute path and validated to exist as a directory (not a file)
To remove a destination, run `scopy dest remove <name>`. Errors if the name is not found
To rename a destination, run `scopy dest rename <old> <new>`. Only the name changes; `location` stays as it is. The cache directory `<dataPath>/cache/<old>` is moved to `<dataPath>/cache/<new>` (if it exists), every copy record with `destination` equal to `<old>` is updated to `<new>`, then the config entry is updated. If the record or config write throws, the cache move and the copy records are rolled back (best effort) and the error is re-thrown
To list all registered destinations, run `scopy dest list`

## Validation
- Git URLs must match the `https://github.com/{owner}/{repo}` pattern; local paths must exist as directories
- Rejects duplicated names (checked first; sources and destinations are separate namespaces)
- `rename` checks, in order (first failure prints an error and returns): `<old>` not found; `<old>` equals `<new>` (`new name must differ from the current name`); `<new>` already exists. For destinations only, then: unsafe `<new>` (`resolveInside` against `<dataPath>/cache` throws -> `unsafe destination name`); leftover copy records or cache dir for `<new>` (error hints `scopy purge log <new>`)
- Local locations are stored as absolute paths
- Errors are printed and the command returns (no throw)