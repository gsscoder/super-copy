# Super Copy

A CLI tool for deploying files from registered sources to registered destinations — with tracking, re-sync, and ghost support.

Designed for single-user, local workflows: dotfiles, config files, Claude Code agents, or any asset you distribute across machines and projects.

## Install

```sh
npm install -g @koder0x/scopy@next
```

> Current version: `0.2.0-rc.1` — stable release coming soon. `@next` installs the current release candidate.

## How it works

Register sources (GitHub repos or local directories) and destinations (local directories), then sync files between them. GitHub sources are fetched directly via the GitHub API — no local Git installation required. Every copy is tracked so you can re-sync, inspect history, or ghost files without losing the originals.

## Commands

| Command | Description |
|---|---|
| `scopy source add <name> <url\|path>` | Register a git repo or local directory as a source |
| `scopy source remove <name>` | Remove a registered source |
| `scopy source list` | List registered sources |
| `scopy dest add <name> <path>` | Register a local directory as a destination |
| `scopy dest remove <name>` | Remove a registered destination |
| `scopy dest list` | List registered destinations |
| `scopy sync <source>[/<glob>] <dest>` | Copy files from source to destination |
| `scopy resync [dest]` | Re-copy tracked files from their original sources |
| `scopy log [dest]` | Show copy history |
| `scopy ghost <dest> <index>` | Soft-remove a tracked file (preserves cache for restore) |
| `scopy purge log [dest]` | Clear copy log entries |
| `scopy info` | Show config file location and registered locations |

## Example

```sh
# Register Claude Code agents repo and a project-level destination
scopy source add cc-agents https://github.com/gsscoder/claude-coding-agents
scopy dest add my-project /path/to/your/project/.claude/agents

# Sync all implement agents
scopy sync cc-agents/agents/implement/*.md my-project

# Re-sync after upstream updates
scopy resync my-project

# Check log to find index, then ghost task-builder.md
scopy log my-project
scopy ghost my-project 6

# Restore it (same command toggles back)
scopy ghost my-project 6
```

## Requirements

- Node.js >= 20

## License

MIT © [Koder0x](https://github.com/gsscoder)
