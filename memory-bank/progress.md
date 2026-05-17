# Project Progress

## Status
Work in progress

## Current Focus
Refining subcommands to enhance features and user experience

## Recent Changes
- Scaffolded Node.js project (ESM, Commander CLI, core deps, .gitignore)
- Implemented `scopy source` sub-command: add (git/local), remove, list with location validation
- Set config file JSON serialization to 2-space indentation
- Added `ghost` subcommand for tracking and deploying managed file sets across destinations
- Changed sync tracking to upsert by `(destination, file)` pair using global indices
- Extended `ghost` with filename and wildcard selectors for finer-grained file targeting