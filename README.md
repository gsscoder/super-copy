# Super Copy

[![npm version](https://img.shields.io/badge/npm-1.0.3-blue)](https://www.npmjs.com/package/@koder-0x/scopy/v/1.0.3)
[![license](https://img.shields.io/npm/l/@koder-0x/scopy)](LICENSE)
[![node](https://img.shields.io/node/v/@koder-0x/scopy)](package.json)

A CLI tool for deploying files from registered sources to registered destinations, with tracking, re-sync, and ghost support (remove and restore tracked files).

Designed for single-user, local workflows: dotfiles, config files, Claude Code agents, or any asset you distribute across machines and projects.

![Demo](docs/demo.gif)

## Why?

I maintain a set of [Claude Code agent definitions](https://github.com/gsscoder/claude-coding-agents) and reuse them across many projects — but every agent loaded eats context tokens, even when unused. I needed a way to make agents appear and disappear on demand without losing them. That's **ghost/unghost**: remove a tracked file (cached) when you don't need it, restore it instantly when you do.

## Install

```sh
npm install -g @koder-0x/scopy
```

## Quickstart

```sh
# Register Claude Code agents repo and a project-level destination
scopy source add cc-agents https://github.com/gsscoder/claude-coding-agents/agents
scopy dest add my-project /path/to/your/project/.claude/agents

# Sync agents in one subdirectory
scopy sync cc-agents/implement/*.md my-project

# Or recursively from nested dirs — flattened to dest root (quote on shells that expand **)
scopy sync 'cc-agents/**/*.md' my-project

# Re-sync after upstream updates
scopy resync my-project
```

## Ghost: make files disappear (and reappear)

Loaded agents you're not using right now still cost context tokens. `ghost` removes a tracked file from its destination (caching it first), `unghost` restores it — same command, toggled.

```sh
# Find a file's index, then ghost by index, filename, or wildcard
scopy log my-project
scopy ghost my-project 6
scopy ghost my-project task-builder.md
scopy ghost my-project task-*

# Or go interactive — all destinations and files in one grouped view
scopy ghost
```

## How it works

Register sources (GitHub repos or local directories) and destinations (local directories), then sync files between them. GitHub sources are fetched directly via the GitHub API — no local Git installation required. Glob patterns use `*` for a single directory level and `**` for recursive matching; nested files are copied flat (basename only). Sync aborts if a query would flatten two source files to the same name — narrow the pattern or rename files in the source. Every copy is tracked so you can re-sync, inspect history, or ghost files without losing the originals.

## Commands

```sh
# Sources
scopy source add <name> <url|path>   # register a git repo or local directory
scopy source remove <name>           # remove a registered source
scopy source list                    # list registered sources

# Destinations
scopy dest add <name> <path>         # register a local directory
scopy dest remove <name>             # remove a registered destination
scopy dest list                      # list registered destinations

# Sync
scopy sync <source>[/<glob>] <dest>  # copy files; existing files → interactive overwrite selector
scopy sync <source>/**/*.md <dest>   # recursive globstar; nested files flattened to dest root
scopy sync ... --force               # overwrite all without prompting
scopy resync <dest>                  # re-copy all tracked files from their original sources

# History & state
scopy log [dest]                     # show copy history grouped by destination
scopy ghost [dest] [selector]        # toggle file(s) ghosted/present; no args → interactive grouped view
scopy purge log <dest|*>             # remove log entries (asks confirmation)
scopy purge log <dest|*> --force     # remove log entries without prompting

# Config & info
scopy config [key] [value]           # get or set preferences (e.g. sync.allowOverwrite)
scopy info                           # show config path and registered locations
```

## Requirements

- Node.js >= 20

## License

MIT © [koder0x](https://github.com/gsscoder)
