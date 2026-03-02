# AGENTS.md

## Scope
- This file defines how the coding agent must work in this repository.
- Scope is the entire project root and all subdirectories.

## Required Workflow
1. Record every user request in `requirements.md` before implementation.
2. Report planned actions to the user before running commands or editing files.
3. Wait for user review/approval, then execute the work.
4. Record executed work in `worklog.md` after each completed task.

## requirements.md Rules
- Keep one requirement per entry.
- Include: timestamp, request summary, status (`pending`, `approved`, `done`).
- Update status as work progresses.

## worklog.md Rules
- Append in chronological order.
- Include: timestamp, what was changed, files touched, and result.
- Keep entries short and factual.

## Quality Rules
- Prefer minimal, safe changes.
- Do not run destructive commands unless explicitly requested.
- If blocked, document blocker in `worklog.md` and report to user.
