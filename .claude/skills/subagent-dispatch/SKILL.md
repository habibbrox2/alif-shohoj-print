---
name: subagent-dispatch
description: Dispatches implementation-plan tasks from docs/superpowers/plans/*.md to subagents. Use when executing a multi-task plan task-by-task, when asked to dispatch or pull the next task, when reporting plan progress, or when a completed checkbox line has to be ticked after its checks actually passed.
---

# Subagent Dispatch

Reads an implementation plan, reports which checkbox tasks remain, and builds a
ready-to-send dispatch prompt for the next incomplete task section. Two ways to
run that prompt:

- **Hand it over:** take the prompt from `next` and spawn your own subagent with
  it verbatim (your `spawn_agents` / task tool).
- **Run it locally:** `dispatch` (CLI) and `dispatch_task` (MCP) pipe the same
  prompt to a local agent-runner CLI — `codex exec -`, `claude -p`, `opencode
  run`, or a custom command — and mirror the runner's exit status. The runner
  command comes from `--runner` or the `DISPATCH_RUNNER` environment variable
  (otherwise the first of codex/claude/opencode found on `PATH`); the prompt
  travels on **stdin only**, so plan content never lands in an argv/shell
  string, and no checkbox is ever ticked automatically.

Implementation: `scripts/subagent-dispatch.mjs` (dependency-free Node, run from
the repository root; plan paths must stay inside the working directory).

## Two interfaces, same three operations

### CLI

```sh
node scripts/subagent-dispatch.mjs status <plan.md> [--json]
node scripts/subagent-dispatch.mjs next  <plan.md> [--json] [--section N]
node scripts/subagent-dispatch.mjs mark  <plan.md> <line>
node scripts/subagent-dispatch.mjs dispatch <plan.md> [--section N] \
  [--runner "<cmd>"] [--timeout <seconds>] [--dry-run]
node scripts/subagent-dispatch.mjs --help
```

`dispatch` exits with the runner's own exit code (124 on timeout, 127 when the
runner cannot start), streams its output live, and on success reminds you to
verify before `mark`. `--dry-run` prints the exact runner command and prompt
without executing anything.

### MCP tools (registered as `subagent-dispatch` in `opencode.json`)

| Tool | Input | Returns |
| --- | --- | --- |
| `plan_status` | `plan` | JSON: totals plus per-section heading, line, done/pending boxes |
| `dispatch_next_task` | `plan`, optional `sectionIndex` | the dispatch prompt as text (first incomplete section by default) |
| `mark_task_done` | `plan`, `line` | confirms the tick and how many boxes remain; refuses non-checkbox lines |
| `dispatch_task` | `plan`, optional `sectionIndex`, `timeoutSeconds` | runs the prompt via the env/auto-detected runner and returns its exit code and output (never auto-ticks) |

## Workflow (one subagent per section)

1. `plan_status` (or `status --json`) to choose a plan and see remaining sections.
2. `dispatch_next_task` to get the prompt for the next incomplete section — then
   either run `dispatch`/`dispatch_task` for a local runner, or spawn a subagent
   with the prompt exactly as returned. The prompt already tells the executor to
   read the whole plan, run the named verification commands, and tick only the
   checkboxes it actually verified.
4. Confirm the reported checks yourself before trusting them; re-run the narrow
   command if the result matters. Then loop until `plan_status` reports
   `complete: true`.
5. `mark_task_done` is for the box *you* verified — a subagent reporting success
   is not proof. Unknown index → queued section unchanged.

Dispatch sections in parallel only when their `**Files:**` lists do not overlap;
the plans serialize edits to shared files such as `StudioEditorCanvas.tsx`.

## Rules

- A checkbox is ticked only after its check passed. On failure, leave it
  unchecked and report the blocker — never edit plan structure, headings, or
  other tasks' boxes.
- The prompts carry AGENTS.md §7: no commit, push, packaging or signing unless
  the user authorizes it.
- A runner is spawned with an argv array and **no shell interpolation** of plan
  content (shell is only enabled for `.cmd`/`.bat`/`.ps1` runner wrappers, whose
  arguments are operator config, not plan text). Output captured from a runner
  is capped at 2 MiB per stream.
- Other `- [ ]` boxes (`**Quality Checklist:**` included) are tracked the same
  way; quality-gate boxes belong to their section.
- Validation lives at the tool boundary: `.md` files only, size-capped, path
  contained in the working directory, exact-line edits (a whole line only).
- The parser skips fenced code blocks (``` / ~~~), so documented ``- [ ]``
  samples and headings inside fences are never counted as tasks — and `mark`
  refuses to tick such a line.

## Verifying the tool itself

```sh
node --test scripts/__tests__/subagent-dispatch.test.mjs
```

Covers plan parsing, prompt contents, exact-line ticking, CLI JSON output and a
live MCP `initialize` → `tools/list` → `tools/call` round trip (including
`isError` results and unknown methods).