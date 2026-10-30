#!/usr/bin/env node
// Dispatches checkbox tasks from docs/superpowers/plans/*.md to subagents.
//
// This tool parses a plan file, reports progress, and builds a ready-to-send
// dispatch prompt for the next incomplete task section. `next` only prints the
// prompt (for a host agent's own subagent tool), while `dispatch` — and the
// MCP `dispatch_task` tool — run the prompt through a local agent runner CLI
// (codex exec, claude -p, opencode run, or a custom --runner/DISPATCH_RUNNER
// command) with the prompt on stdin. The runner's exit status is mirrored and
// plan boxes are never ticked automatically: the caller must verify first.
//
// CLI:
//   node scripts/subagent-dispatch.mjs status <plan.md> [--json]
//   node scripts/subagent-dispatch.mjs next  <plan.md> [--json] [--section N]
//   node scripts/subagent-dispatch.mjs mark  <plan.md> <line>
//   node scripts/subagent-dispatch.mjs dispatch <plan.md> [--section N]
//     [--runner "<cmd>"] [--timeout <seconds>] [--dry-run]
//   node scripts/subagent-dispatch.mjs --help
// MCP (stdio, newline-delimited JSON-RPC):
//   node scripts/subagent-dispatch.mjs --mcp

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_PLAN_BYTES = 4 * 1024 * 1024;
const CHECKBOX_RE = /^(\s*)- \[([ xX])\] (.*)$/;
const HEADING_RE = /^(#{1,6})\s+(\S.*\S|\S)\s*$/;
const FENCE_OPEN_RE = /^( {0,3})(`{3,}|~{3,})/;
const FENCE_CLOSE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

// Markdown code fences hide headings and ``- [ ]`` samples from readers, so a
// plan's checkbox block inside ``` or ~~~ must never be parsed or ticked.
function fenceMask(lines) {
  const inside = new Array(lines.length).fill(false);
  let char = '';
  let length = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (char) {
      const close = FENCE_CLOSE_RE.exec(lines[i]);
      if (close && close[1][0] === char && close[1].length >= length) {
        char = '';
        length = 0;
        continue;
      }
      inside[i] = true;
      continue;
    }
    const open = FENCE_OPEN_RE.exec(lines[i]);
    if (open) {
      char = open[2][0];
      length = open[2].length;
      inside[i] = true;
      continue;
    }
    inside[i] = false;
  }
  return inside;
}

export function validatePlanPath(planPath) {
  if (typeof planPath !== 'string' || planPath.length === 0) {
    throw new Error('plan must be a non-empty file path');
  }
  if (planPath.includes('\0')) {
    throw new Error('plan path contains an invalid character');
  }
  const resolved = path.resolve(process.cwd(), planPath);
  const root = process.cwd();
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`plan must live inside the working directory (received: ${planPath})`);
  }
  if (!/\.(md|markdown)$/i.test(resolved)) {
    throw new Error('plan must be a markdown (.md) file');
  }
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    throw new Error(`plan file not found: ${planPath}`);
  }
  if (!stat.isFile()) {
    throw new Error(`plan path is not a file: ${planPath}`);
  }
  if (stat.size > MAX_PLAN_BYTES) {
    throw new Error('plan file is too large to parse');
  }
  return resolved;
}

export function parsePlan(markdown) {
  const lines = markdown.split(/\r\n|\r|\n/);
  const fenced = fenceMask(lines);
  const sections = [];
  let title = '';
  let current = null;

  for (let i = 0; i < lines.length; i += 1) {
    if (fenced[i]) continue;
    const line = lines[i];
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      if (level === 1 && !title) {
        title = text;
      }
      current = { heading: text, level, line: i + 1, items: [] };
      sections.push(current);
      continue;
    }
    const box = CHECKBOX_RE.exec(line);
    if (box) {
      if (!current) {
        current = { heading: '', level: 1, line: 1, items: [] };
        sections.push(current);
      }
      current.items.push({
        line: i + 1,
        indent: box[1].length,
        text: box[3],
        done: box[2] !== ' ',
        raw: line,
      });
    }
  }

  const withItems = sections.filter((section) => section.items.length > 0);
  const total = withItems.reduce((sum, section) => sum + section.items.length, 0);
  const completed = withItems.reduce(
    (sum, section) => sum + section.items.filter((item) => item.done).length,
    0,
  );
  return {
    title,
    sections: withItems,
    total,
    completed,
    pending: total - completed,
  };
}

export function loadPlan(planPath) {
  const resolved = validatePlanPath(planPath);
  const plan = parsePlan(fs.readFileSync(resolved, 'utf8'));
  return { path: resolved, displayPath: path.relative(process.cwd(), resolved), ...plan };
}

export function sectionStatus(plan) {
  return plan.sections.map((section, index) => ({
    index,
    heading: section.heading,
    line: section.line,
    done: section.items.every((item) => item.done),
    completed: section.items.filter((item) => item.done).length,
    total: section.items.length,
    pendingItems: section.items.filter((item) => !item.done).map((item) => item.line),
  }));
}

export function pendingSections(plan) {
  return sectionStatus(plan).filter((section) => !section.done);
}

export function buildDispatchPrompt(plan, sectionIndex) {
  const status = sectionStatus(plan);
  const section = status[sectionIndex];
  if (!section) {
    throw new Error(`section index ${sectionIndex} does not exist in ${plan.displayPath}`);
  }
  const source = plan.sections[sectionIndex];
  const pendingBoxList = source.items
    .filter((item) => !item.done)
    .map((item) => `  - ${item.line}: - [ ] ${item.text}`)
    .join('\n');
  const allBoxes = source.items.map((item) => `  - ${item.line}: ${item.raw.trim()}`).join('\n');

  return [
    'You are executing exactly ONE section of an implementation plan in this repository.',
    '',
    `Plan file: ${plan.displayPath}`,
    `Plan title: ${plan.title || '(untitled)'}`,
    `Section: ${section.heading} (starts at line ${section.line})`,
    `Section boxes: ${section.completed} of ${section.total} already done`,
    '',
    'Section checklist (line numbers are 1-based and point at the checkbox):',
    allBoxes,
    '',
    'Rules:',
    '1. Read the whole plan file first; its Global Constraints, Review Focus and',
    '   verification commands apply to you.',
    '2. Complete every unchecked item below, and finish the whole section:',
    pendingBoxList,
    '3. Verify with the exact commands the plan names. Run the narrowest relevant',
    "   checks first, read the real output, and never claim a pass you did not observe.",
    '4. Tick a box only after its check actually passed: change `- [ ]` to `- [x]` on',
    `   exactly that line of ${plan.displayPath}, touching no other line. Leave a box`,
    '   unchecked and report the blocker if the check failed.',
    "5. Do not start other sections, do not commit/push/package (AGENTS.md §7), and",
    '   preserve any unrelated uncommitted work in the tree.',
    '6. Finish with a short report: files changed, commands run with their results,',
    '   and anything skipped.',
  ].join('\n');
}

export function markLine(markdown, line) {
  const lines = markdown.split('\n');
  const index = line - 1;
  if (!Number.isInteger(line) || line < 1 || index >= lines.length) {
    throw new Error(`line ${line} is outside the plan file`);
  }
  const match = CHECKBOX_RE.exec(lines[index]);
  if (!match) {
    throw new Error(`line ${line} is not a checkbox line`);
  }
  if (fenceMask(lines)[index]) {
    throw new Error(`line ${line} is inside a fenced code block, not a plan task`);
  }
  if (match[2] !== ' ') {
    return { line, changed: false, text: match[3], markdown };
  }
  const next = lines.slice();
  next[index] = lines[index].replace(/- \[[ xX]\]/, '- [x]');
  return { line, changed: true, text: match[3], markdown: next.join('\n') };
}

// ---------------------------------------------------------------------------
// Runner-based execution (`dispatch` CLI command and MCP `dispatch_task`)

export const RUNNER_CANDIDATES = [
  { name: 'codex', args: ['exec', '-'] },
  { name: 'claude', args: ['-p'] },
  { name: 'opencode', args: ['run'] },
];

export function parseCommand(command) {
  if (typeof command !== 'string' || command.trim() === '') {
    throw new Error('runner command must be a non-empty string');
  }
  const tokens = [];
  let current = '';
  let quote = '';
  let started = false;
  for (const char of command) {
    if (quote) {
      if (char === quote) quote = '';
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (current || started) tokens.push(current);
      current = '';
      started = false;
      continue;
    }
    current += char;
  }
  if (quote) throw new Error('unbalanced quote in runner command');
  if (current || started) tokens.push(current);
  if (tokens.length === 0) throw new Error('runner command is empty');
  return tokens;
}

function whichSync(name, pathValue, pathExt) {
  const dirs = String(pathValue || '').split(path.delimiter).filter(Boolean);
  const extraExts =
    path.delimiter === ';'
      ? String(pathExt || '')
          .split(';')
          .filter(Boolean)
          .map((ext) => ext.toLowerCase())
      : [];
  for (const dir of dirs) {
    for (const ext of ['', ...extraExts]) {
      try {
        const candidate = path.join(dir, name + ext);
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // not here; keep scanning PATH
      }
    }
  }
  return null;
}

export function detectRunner(pathValue, pathExt, candidates = RUNNER_CANDIDATES) {
  for (const candidate of candidates) {
    const found = whichSync(candidate.name, pathValue, pathExt);
    if (found) return { ...candidate, path: found };
  }
  return null;
}

export function resolveRunner({ flag, env = process.env, candidates = RUNNER_CANDIDATES } = {}) {
  if (typeof flag === 'string' && flag.trim()) {
    return { source: '--runner', tokens: parseCommand(flag) };
  }
  const configured = typeof env.DISPATCH_RUNNER === 'string' ? env.DISPATCH_RUNNER.trim() : '';
  if (configured) {
    return { source: 'DISPATCH_RUNNER', tokens: parseCommand(configured) };
  }
  const detected = detectRunner(env.PATH ?? env.Path ?? '', env.PATHEXT, candidates);
  if (detected) {
    return { source: 'auto', name: detected.name, tokens: [detected.path, ...detected.args] };
  }
  return null;
}

export function noRunnerError() {
  return new Error(
    'no agent runner found: pass --runner "<command>", set DISPATCH_RUNNER, or install ' +
      `${RUNNER_CANDIDATES.map((candidate) => candidate.name).join(', ')} on PATH`,
  );
}

const MAX_RUNNER_OUTPUT_BYTES = 2 * 1024 * 1024;

export async function runDispatch({
  planPath,
  sectionIndex,
  runner,
  timeoutMs = 900000,
  dryRun = false,
  quiet = false,
  env = process.env,
} = {}) {
  if (!runner || !Array.isArray(runner.tokens) || runner.tokens.length === 0) {
    throw noRunnerError();
  }
  const plan = loadPlan(planPath);
  const status = sectionStatus(plan);
  if (!Number.isInteger(sectionIndex) || sectionIndex < 0) {
    const pending = pendingSections(plan);
    if (pending.length === 0) {
      return { exitCode: 0, complete: true, message: 'All tasks complete; nothing to dispatch.' };
    }
    sectionIndex = pending[0].index;
  }
  const section = status[sectionIndex];
  if (!section) {
    throw new Error(`section index ${sectionIndex} does not exist in ${plan.displayPath}`);
  }
  if (section.done) {
    return {
      exitCode: 0,
      complete: pendingSections(plan).length === 0,
      message: `Section ${sectionIndex} is already complete; nothing dispatched.`,
    };
  }
  const prompt = buildDispatchPrompt(plan, sectionIndex);
  const base = {
    planPath: plan.displayPath,
    sectionIndex,
    heading: section.heading,
    runner: runner.tokens.join(' '),
    runnerSource: runner.source,
  };
  if (dryRun) {
    return { ...base, dryRun: true, exitCode: 0, prompt };
  }

  return new Promise((resolve) => {
    // Prompt goes over stdin only; argv is runner config, never plan content.
    const useShell = /\.(cmd|bat|ps1)$/i.test(runner.tokens[0]);
    const child = spawn(runner.tokens[0], runner.tokens.slice(1), {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: useShell,
      env,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const cap = (current, chunk) => {
      if (current.length >= MAX_RUNNER_OUTPUT_BYTES) {
        truncated = true;
        return current;
      }
      const next = current + chunk.toString('utf8');
      if (next.length > MAX_RUNNER_OUTPUT_BYTES) truncated = true;
      return next.slice(0, MAX_RUNNER_OUTPUT_BYTES);
    };
    const forward = (kind, chunk) => {
      if (!quiet) process[kind].write(chunk);
      if (kind === 'stdout') stdout = cap(stdout, chunk);
      else stderr = cap(stderr, chunk);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    const settle = (extra) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...base, timedOut, truncated, stdout, stderr, ...extra });
    };

    child.stdout.on('data', (chunk) => forward('stdout', chunk));
    child.stderr.on('data', (chunk) => forward('stderr', chunk));
    child.on('error', (error) => settle({ exitCode: 127, spawnError: error.message }));
    child.on('close', (code, signal) => {
      if (timedOut) settle({ exitCode: 124 });
      else settle({ exitCode: code ?? (signal ? 1 : 1) });
    });
    child.stdin.on('error', () => {
      // runner exited before reading the prompt; the close handler reports it
    });
    child.stdin.end(prompt);
  });
}

// ---------------------------------------------------------------------------
// CLI

function printHelp() {
  console.log(
    [
      'Subagent dispatch helper for docs/superpowers/plans/*.md',
      '',
      'Usage:',
      '  node scripts/subagent-dispatch.mjs status <plan.md> [--json]',
      '  node scripts/subagent-dispatch.mjs next <plan.md> [--json] [--section N]',
      '  node scripts/subagent-dispatch.mjs mark <plan.md> <line>',
      '  node scripts/subagent-dispatch.mjs dispatch <plan.md> [--section N]',
      '      [--runner "<cmd>"] [--timeout <seconds>] [--dry-run]',
      '  node scripts/subagent-dispatch.mjs --mcp',
      '',
      'dispatch runs the prompt through a local agent runner: --runner wins, then',
      'the DISPATCH_RUNNER environment variable, then codex/claude/opencode on',
      'PATH. The prompt is piped on stdin, the runner exit code is mirrored, and',
      'no plan checkbox is ever ticked automatically.',
      '',
      'Run from the repository root; the plan path must be inside it.',
    ].join('\n'),
  );
}

async function runCli(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }
  if (command === '--mcp') {
    startMcpServer();
    return null;
  }

  const json = rest.includes('--json');
  const positional = rest.filter((arg) => !arg.startsWith('--'));

  if (command === 'status') {
    const plan = loadPlan(positional[0]);
    const status = sectionStatus(plan);
    if (json) {
      console.log(
        JSON.stringify(
          {
            path: plan.displayPath,
            title: plan.title,
            total: plan.total,
            completed: plan.completed,
            pending: plan.pending,
            complete: plan.pending === 0,
            sections: status,
          },
          null,
          2,
        ),
      );
      return 0;
    }
    console.log(`Plan: ${plan.displayPath}${plan.title ? ` — ${plan.title}` : ''}`);
    for (const section of status) {
      const flag = section.done ? 'x' : ' ';
      console.log(
        ` [${flag}] ${section.index}: ${section.heading || '(preamble)'} — ` +
          `${section.completed}/${section.total} done (line ${section.line})`,
      );
    }
    console.log(
      `Progress: ${plan.completed}/${plan.total} checkboxes done, ` +
        `${plan.pending} pending across ${status.filter((s) => !s.done).length} section(s)`,
    );
    return 0;
  }

  if (command === 'next') {
    const plan = loadPlan(positional[0]);
    const all = pendingSections(plan);
    const flagIndex = rest.indexOf('--section');
    const explicit = flagIndex >= 0 ? Number.parseInt(rest[flagIndex + 1], 10) : NaN;
    const chosen = Number.isInteger(explicit) ? explicit : all.length ? all[0].index : -1;
    if (chosen < 0) {
      console.log(json ? JSON.stringify({ complete: true, prompt: null }) : 'All tasks complete.');
      return 0;
    }
    const prompt = buildDispatchPrompt(plan, chosen);
    if (json) {
      console.log(JSON.stringify({ complete: false, sectionIndex: chosen, prompt }, null, 2));
    } else {
      console.log(prompt);
    }
    return 0;
  }

  if (command === 'mark') {
    const planPath = positional[0];
    const line = Number.parseInt(positional[1], 10);
    if (!Number.isInteger(line)) {
      throw new Error('mark requires a 1-based line number: mark <plan.md> <line>');
    }
    const resolved = validatePlanPath(planPath);
    const current = fs.readFileSync(resolved, 'utf8');
    const result = markLine(current, line);
    if (result.changed) {
      fs.writeFileSync(resolved, result.markdown, 'utf8');
    }
    console.log(
      result.changed
        ? `Marked line ${line} done: ${result.text}`
        : `Line ${line} was already done: ${result.text}`,
    );
    return 0;
  }

  if (command === 'dispatch') {
    const options = {
      plan: undefined,
      runner: undefined,
      section: undefined,
      timeout: undefined,
      dryRun: false,
    };
    for (let i = 0; i < rest.length; i += 1) {
      const arg = rest[i];
      if (arg === '--dry-run') {
        options.dryRun = true;
        continue;
      }
      if (arg === '--runner' || arg === '--section' || arg === '--timeout') {
        const value = rest[i + 1];
        if (value === undefined || value.startsWith('--')) {
          throw new Error(`${arg} requires a value`);
        }
        i += 1;
        if (arg === '--runner') options.runner = value;
        if (arg === '--section') options.section = Number.parseInt(value, 10);
        if (arg === '--timeout') options.timeout = Number.parseInt(value, 10);
        continue;
      }
      if (options.plan === undefined) {
        options.plan = arg;
        continue;
      }
      throw new Error(`unexpected argument: ${arg}`);
    }
    if (options.plan === undefined) {
      throw new Error('dispatch requires a plan file');
    }
    if (options.section !== undefined && (!Number.isInteger(options.section) || options.section < 0)) {
      throw new Error('--section must be a non-negative integer');
    }
    if (options.timeout !== undefined && (!Number.isInteger(options.timeout) || options.timeout <= 0)) {
      throw new Error('--timeout must be a positive number of seconds');
    }
    const runner = resolveRunner({ flag: options.runner, env: process.env });
    if (!runner) throw noRunnerError();
    const timeoutSeconds = options.timeout ?? 900;
    const result = await runDispatch({
      planPath: options.plan,
      sectionIndex: options.section,
      runner,
      timeoutMs: timeoutSeconds * 1000,
      dryRun: options.dryRun,
    });
    if (result.dryRun) {
      console.log(
        [
          'dry-run: no runner was executed.',
          `runner (${result.runnerSource}): ${result.runner}`,
          `section ${result.sectionIndex}: ${result.heading} — ${result.planPath}`,
          '',
          result.prompt,
        ].join('\n'),
      );
      return 0;
    }
    if (result.message) {
      console.log(result.message);
      return 0;
    }
    if (result.spawnError) {
      throw new Error(`runner failed to start: ${result.spawnError}`);
    }
    if (result.timedOut) {
      console.error(`subagent-dispatch: runner timed out after ${timeoutSeconds}s and was stopped`);
      return 124;
    }
    if (result.exitCode === 0) {
      console.error(
        `subagent-dispatch: runner exited 0 for section ${result.sectionIndex} ` +
          `(${result.heading}). Verify its report, then tick boxes with: ` +
          `mark ${result.planPath} <line>`,
      );
    }
    return result.exitCode;
  }

  printHelp();
  throw new Error(`unknown command: ${command}`);
}

// ---------------------------------------------------------------------------
// MCP server (stdio JSON-RPC)

const TOOL_DEFINITIONS = [
  {
    name: 'plan_status',
    description:
      'Report checkbox progress for an implementation plan file: sections, line numbers, and how many boxes remain in each.',
    inputSchema: {
      type: 'object',
      properties: {
        plan: { type: 'string', description: 'Path to the plan markdown file (repository-relative)' },
      },
      required: ['plan'],
    },
  },
  {
    name: 'dispatch_next_task',
    description:
      'Return a ready-to-send dispatch prompt for the next incomplete section of a plan. Feed the returned text to your subagent-spawning tool verbatim; this server does not run models itself.',
    inputSchema: {
      type: 'object',
      properties: {
        plan: { type: 'string', description: 'Path to the plan markdown file (repository-relative)' },
        sectionIndex: {
          type: 'integer',
          minimum: 0,
          description: 'Optional section index from plan_status; defaults to the first incomplete section',
        },
      },
      required: ['plan'],
    },
  },
  {
    name: 'mark_task_done',
    description:
      'Tick the checkbox of a completed plan box at an exact 1-based line number. Refuses the call if that line is not a checkbox.',
    inputSchema: {
      type: 'object',
      properties: {
        plan: { type: 'string', description: 'Path to the plan markdown file (repository-relative)' },
        line: { type: 'integer', minimum: 1, description: '1-based line number of the checkbox' },
      },
      required: ['plan', 'line'],
    },
  },
  {
    name: 'dispatch_task',
    description:
      'Execute the next (or a chosen) incomplete plan section by piping the dispatch prompt to a local agent runner CLI. The runner command comes only from the server environment (DISPATCH_RUNNER or an auto-detected codex/claude/opencode on PATH) — never from tool input. Returns the runner exit code and output; plan boxes are not ticked automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        plan: { type: 'string', description: 'Path to the plan markdown file (repository-relative)' },
        sectionIndex: {
          type: 'integer',
          minimum: 0,
          description: 'Optional section index from plan_status; defaults to the first incomplete section',
        },
        timeoutSeconds: {
          type: 'integer',
          minimum: 1,
          description: 'Optional runner timeout in seconds (default 900)',
        },
      },
      required: ['plan'],
    },
  },
];

async function callTool(args) {
  const name = args.name;
  const input = args.arguments ?? {};
  if (name === 'plan_status') {
    const plan = loadPlan(input.plan);
    return JSON.stringify(
      {
        path: plan.displayPath,
        title: plan.title,
        total: plan.total,
        completed: plan.completed,
        pending: plan.pending,
        complete: plan.pending === 0,
        sections: sectionStatus(plan),
      },
      null,
      2,
    );
  }
  if (name === 'dispatch_next_task') {
    const plan = loadPlan(input.plan);
    const pending = pendingSections(plan);
    if (input.sectionIndex === undefined) {
      if (pending.length === 0) {
        return 'All tasks complete; nothing to dispatch.';
      }
      return buildDispatchPrompt(plan, pending[0].index);
    }
    if (!Number.isInteger(input.sectionIndex) || input.sectionIndex < 0) {
      throw new Error('sectionIndex must be a non-negative integer');
    }
    const section = sectionStatus(plan)[input.sectionIndex];
    if (section && section.done) {
      return `Section ${input.sectionIndex} is already complete; dispatch another section.`;
    }
    return buildDispatchPrompt(plan, input.sectionIndex);
  }
  if (name === 'mark_task_done') {
    const resolved = validatePlanPath(input.plan);
    const line = input.line;
    if (!Number.isInteger(line) || line < 1) {
      throw new Error('line must be a 1-based integer');
    }
    const current = fs.readFileSync(resolved, 'utf8');
    const result = markLine(current, line);
    if (result.changed) {
      fs.writeFileSync(resolved, result.markdown, 'utf8');
    }
    const plan = loadPlan(input.plan);
    return JSON.stringify(
      { line: result.line, changed: result.changed, task: result.text, remaining: plan.pending },
      null,
      2,
    );
  }
  if (name === 'dispatch_task') {
    const runner = resolveRunner({ flag: undefined, env: process.env });
    if (!runner) throw noRunnerError();
    const timeoutSeconds = input.timeoutSeconds ?? 900;
    if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0) {
      throw new Error('timeoutSeconds must be a positive integer');
    }
    const result = await runDispatch({
      planPath: input.plan,
      sectionIndex: input.sectionIndex,
      runner,
      timeoutMs: timeoutSeconds * 1000,
      quiet: true,
    });
    return JSON.stringify(
      {
        plan: result.planPath,
        sectionIndex: result.sectionIndex,
        heading: result.heading,
        runner: result.runner,
        runnerSource: result.runnerSource,
        exitCode: result.exitCode,
        timedOut: result.timedOut ?? false,
        truncated: result.truncated ?? false,
        spawnError: result.spawnError,
        message: result.message,
        stdout: result.stdout,
        stderr: result.stderr,
        next: 'Verify the report before running mark_task_done for any box.',
      },
      null,
      2,
    );
  }
  throw new Error(`unknown tool: ${name}`);
}

export function startMcpServer() {
  const write = (message) => {
    process.stdout.write(`${JSON.stringify(message)}\n`);
  };

  const handle = async (line) => {
    let request;
    try {
      request = JSON.parse(line);
    } catch {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
      return;
    }
    const { id, method, params } = request;
    try {
      if (method === 'initialize') {
        write({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion:
              typeof params?.protocolVersion === 'string' ? params.protocolVersion : '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'subagent-dispatch', version: '1.0.0' },
          },
        });
        return;
      }
      if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
        return;
      }
      if (method === 'ping') {
        if (id !== undefined) write({ jsonrpc: '2.0', id, result: {} });
        return;
      }
      if (method === 'tools/list') {
        write({ jsonrpc: '2.0', id, result: { tools: TOOL_DEFINITIONS } });
        return;
      }
      if (method === 'tools/call') {
        try {
          const text = await callTool(params ?? {});
          write({
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text }], isError: false },
          });
        } catch (error) {
          write({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            },
          });
        }
        return;
      }
      if (id !== undefined) {
        write({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `method not found: ${method}` },
        });
      }
    } catch (error) {
      if (id !== undefined) {
        write({ jsonrpc: '2.0', id, error: { code: -32603, message: error.message } });
      }
    }
  };

  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let index = buffer.indexOf('\n');
    while (index >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line) handle(line);
      index = buffer.indexOf('\n');
    }
  });
  process.stdin.on('end', () => {
    const tail = buffer.trim();
    if (tail) handle(tail);
  });
}

async function main() {
  try {
    const code = await runCli(process.argv.slice(2));
    if (code !== null) process.exitCode = code;
  } catch (error) {
    console.error(`subagent-dispatch: ${error.message}`);
    process.exitCode = 1;
  }
}

const entry = process.argv[1];
let isMain = false;
if (entry) {
  try {
    isMain = fs.realpathSync(entry) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    isMain = false;
  }
}

if (isMain) void main();