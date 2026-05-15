# Locations Registration

Commands and config for registering asset locations — sources to copy from, and destinations to copy to. Each location is an entry in the config file at `~/.config/scopy/scopy.json`. Sources can be git repositories (HTTPS) or local directories.

## Config File
Location: `~/.config/scopy/scopy.json` (user home, `.config/scopy/` directory); created on first write
```json
{
  "sources": [
    { "name": "{name}", "location": "{uri|abs_path}", "path": "{path?}" }
  ],
  "destinations": [
    { "name": "{name}", "location": "{abs_path}" }
  ]
}
```
- `sources` — array of registered source locations
- `name` (str): unique identifier for the source
- `location` (str): absolute URL (git) or absolute filesystem path (local)
- `path` (str, optional): sub-path within a git repository; only present for git sources
- `destinations` — array of registered destination locations
- `name` (str): unique identifier for the destination
- `location` (str): absolute filesystem path (local)

## Source Command
`scopy source` manages the set of registered asset sources
To add a source, run `scopy source add <name> <location>`. The location is parsed to determine its type. Git URLs must match `https://github.com/{owner}/{repo}[/{subpath}]` exactly — non-GitHub HTTPS URLs and SSH (`git@`) are rejected. An optional sub-path is extracted: `https://github.com/owner/repo/path/to/dir` resolves to base repo `https://github.com/owner/repo` with sub-path `/path/to/dir`. No network call is made during registration.
Local paths are resolved to an absolute path and validated to exist as a directory (not a file)
To remove a source, run `scopy source remove <name>`. Errors if the name is not found
To list all registered sources, run `scopy source list`

## Destination Command
`scopy dest` manages the set of registered destination locations
To add a destination, run `scopy dest add <name> <location>`. The location must be a local filesystem path. It is resolved to an absolute path and validated to exist as a directory (not a file)
To remove a destination, run `scopy dest remove <name>`. Errors if the name is not found
To list all registered destinations, run `scopy dest list`

## Validation
- Git URLs must match the `https://github.com/{owner}/{repo}` pattern; local paths must exist as directories
- Rejects duplicated names