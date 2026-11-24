# AI guidance

## Project Brief
A file distribution utility for deploying assets — such as Claude Code agents, dotfiles, or config files —
from registered sources (GitHub repos via the GitHub API, or local directories) to registered destinations
(local directories). Tracks every copy to support resync and ghosting (removing and restoring tracked files).
Requirements:
- Scriptable and composable
- Designed for single-user, local workflows

## Core Technologies
Node.js, TypeScript, Commander, Conf, Inquirer, Chalk

## Memory
The development documents are in the `memory-bank` dir — they primarily focus on specific feature implementation details

## Output
- Code: match the architectural and stylistic conventions of the existing codebase
- Language: use English for all generated artifacts and symbols by default. Content in another language is allowed only in user-facing strings, messages, and labels when the application has a single localization
- Quality: production-grade — every line will be reviewed
- Markdown: compact, no linting compliance, formatting identical to this file

# TypeScript Code Standards
- Generate code for Node.js ESM (ES2022) with TypeScript 6, favoring modern and expressive syntax over legacy patterns
- Avoid `any`; use `unknown` for uncertain types and narrow before use
- Do not use non-null assertion (`!`); handle `null`/`undefined` explicitly
- Avoid `object`/`{}`/`Record<string, any>`; use specific interfaces or type aliases
- Avoid wide unions; use discriminated unions with `type`/`kind` for explicit handling
- Avoid `as` casting; use type guards (`is`) for safe narrowing

## Operational Rules
- For complex requests, start by reading file `memory-bank/architecture.md` before analyzing any code
- Read files in `memory-bank` only when required by the current task; scan filenames first and read file contents only if they are relevant to the task
- Review/audit/report requests end at the report; fixing findings needs its own separate request — authorization never carries across turns
- NEVER update this file
- NEVER modify `*.md` files in `memory-bank` (at any depth in the dir tree) without an explicit request
- NEVER commit changes to Git history without explicit authorization; do not suggest committing changes
- NEVER mention commit state (whether changes are committed, uncommitted, or pushed) unless I ask

### Before Implementing — Reason First
- Surface Uncertainty, Don't Guess Through It: When requirements are ambiguous, contradictory, or incomplete, stop and ask instead of assuming intent and proceeding silently. State assumptions explicitly; if multiple readings are viable, present them rather than picking one silently. Resolve intent up front — this is what makes autonomous execution safe afterward
- Plan Before Implementing: For non-trivial tasks, outline a brief approach before writing code so wrong directions surface early. For multi-step work, list the steps with a verification check for each

### Design & Scope — Code Minimally
- Simplicity Over Abstraction: Write the simplest solution that meets the requirements. Avoid speculative features, abstractions for single-use code, unrequested configurability, and error handling for impossible cases. If a construction could be materially shorter without losing correctness, rewrite it — ask whether a senior engineer would call it overcomplicated
- Surgical Scope: Every changed line should trace directly to the current task. Match the surrounding style even where you'd choose differently. Remove imports, variables, and comments that *your* changes made obsolete, but never modify, reformat, or delete code or comments orthogonal to the task. If you notice unrelated dead code, mention it — don't delete it

### Execution — Verify Against Goals
- Drive Toward Success Criteria: Turn the task into checkable goals and work until they're met — e.g. "add validation" → write tests for invalid inputs, then make them pass; "fix the bug" → write a failing test that reproduces it, then make it pass. When the goal is well-defined, loop and self-verify independently rather than pausing for confirmation the criteria already answer. (This is the counterpart to *Surface Uncertainty*: clarify the goal before starting; do not re-open a settled goal mid-execution)