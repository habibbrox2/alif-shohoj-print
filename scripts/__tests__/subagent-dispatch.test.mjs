import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildDispatchPrompt,
  detectRunner,
  loadPlan,
  markLine,
  parseCommand,
  parsePlan,
  pendingSections,
  resolveRunner,
  sectionStatus,
  validatePlanPath,
} from '../subagent-dispatch.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'subagent-dispatch.mjs');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tmp', 'subagent-dispatch-test');
const FIXTURE_REL = path.join('tmp', 'subagent-dispatch-test', 'plan.md');

const FIXTURE = [
  '# Sample Plan',
  '',
  '> For agentic workers: execute task-by-task.',
  '',
  '## Global Constraints',
  '',
  '- Do not commit.',
  '',
  '### Task 1: Model',
  '',
  '- [ ] Write failing test.',
  '- [ ] Implement the model.',
  '',
  '### Task 2: Wire up',
  '',
  '- [x] Read the existing code.',
  '- [ ] Update the component.',
  '- [ ] Run `npm run lint`.',
  '',
].join('\n');

let writtenFixture;

before(() => {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  writtenFixture = path.join(FIXTURE_DIR, 'plan.md');
  fs.writeFileSync(writtenFixture, FIXTURE, 'utf8');
  fs.writeFileSync(
    path.join(FIXTURE_DIR, 'runner-ok.mjs'),
    [
      "import fs from 'node:fs';",
      "let data = '';",
      "process.stdin.on('data', chunk => (data += chunk));",
      "process.stdin.on('end', () => {",
      "  fs.writeFileSync(new URL('./runner-received.txt', import.meta.url), data, 'utf8');",
      "  process.exit(data.includes('Sample Plan') ? 0 : 5);",
      '});',
      '',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(FIXTURE_DIR, 'runner-fail.mjs'),
    "process.stdin.resume();\nprocess.stdin.on('end', () => process.exit(7));\n",
    'utf8',
  );
});

after(() => {
  fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

test('parsePlan splits sections, item line numbers and done state', () => {
  const plan = parsePlan(FIXTURE);
  assert.equal(plan.title, 'Sample Plan');
  assert.equal(plan.sections.length, 2);
  assert.equal(plan.total, 5);
  assert.equal(plan.completed, 1);
  assert.equal(plan.pending, 4);

  const [task1, task2] = plan.sections;
  assert.equal(task1.heading, 'Task 1: Model');
  assert.deepEqual(task1.items.map((item) => item.line), [11, 12]);
  assert.equal(task2.items[0].done, true);
  assert.equal(task2.items[1].done, false);
});

test('sectionStatus and pendingSections report progress in plan order', () => {
  const plan = parsePlan(FIXTURE);
  const status = sectionStatus(plan);
  assert.deepEqual(
    status.map((section) => [section.heading, section.completed, section.total, section.done]),
    [
      ['Task 1: Model', 0, 2, false],
      ['Task 2: Wire up', 1, 3, false],
    ],
  );
  assert.deepEqual(pendingSections(plan).map((section) => section.index), [0, 1]);
});

test('buildDispatchPrompt carries plan path, section heading and exact lines', () => {
  const plan = loadPlan(FIXTURE_REL);
  const prompt = buildDispatchPrompt(plan, 1);
  assert.match(prompt, /Plan file: .*plan\.md/);
  assert.match(prompt, /Section: Task 2: Wire up \(starts at line 14\)/);
  assert.ok(prompt.includes('- 17: - [ ] Update the component.'));
  assert.ok(prompt.includes('- 16: - [x] Read the existing code.'));
  assert.match(prompt, /change `- \[ \]` to `- \[x\]`/);
  assert.throws(() => buildDispatchPrompt(plan, 99), /section index 99/);
});

test('markLine ticks only the addressed checkbox and is idempotent', () => {
  const first = markLine(FIXTURE, 12);
  assert.equal(first.changed, true);
  const lines = first.markdown.split('\n');
  assert.equal(lines[11], '- [x] Implement the model.');
  assert.equal(lines[16], '- [ ] Update the component.');

  const again = markLine(first.markdown, 12);
  assert.equal(again.changed, false);
  assert.equal(again.markdown, first.markdown);

  assert.throws(() => markLine(FIXTURE, 4), /not a checkbox line/);
  assert.throws(() => markLine(FIXTURE, 9999), /outside the plan file/);
});

test('validatePlanPath rejects foreign, non-markdown and missing paths', () => {
  assert.equal(validatePlanPath(FIXTURE_REL), writtenFixture);
  assert.throws(() => validatePlanPath(path.join(REPO_ROOT, 'package.json')), /markdown/);
  assert.throws(() => validatePlanPath(undefined), /non-empty/);
  assert.throws(() => validatePlanPath('tmp/subagent-dispatch-test/missing.md'), /not found/);
  if (path.isAbsolute(path.relative(REPO_ROOT, path.parse(REPO_ROOT).root))) {
    assert.throws(() => validatePlanPath(path.join(path.parse(REPO_ROOT).root, 'plan.md')), /inside/);
  }
});

test('parsePlan ignores headings and checkboxes inside code fences', () => {
  const fenced = [
    '# Fenced Plan',
    '',
    '### Task 1: Real',
    '',
    '- [ ] Real box.',
    '',
    '```markdown',
    '### Fake Task in fence',
    '- [ ] Fake box.',
    '- [x] Fake done box.',
    '```',
    '',
    '### Task 2: Also real',
    '',
    '~~~text',
    '- [ ] Tilde box.',
    '~~~',
    '- [ ] Second real box.',
    '',
  ].join('\n');
  const plan = parsePlan(fenced);
  assert.deepEqual(
    plan.sections.map((section) => section.heading),
    ['Task 1: Real', 'Task 2: Also real'],
  );
  assert.equal(plan.total, 2);
  assert.equal(plan.pending, 2);
  assert.deepEqual(plan.sections[1].items.map((item) => item.line), [18]);

  assert.throws(() => markLine(fenced, 9), /fenced code block/);
  assert.throws(() => markLine(fenced, 8), /not a checkbox line/);

  const unclosed = ['# Plan', '### A', '- [ ] open box', '```', '- [ ] swallowed box'].join('\n');
  assert.equal(parsePlan(unclosed).total, 1);
});

function run(args, cwd = REPO_ROOT) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('CLI status --json and next --json report real plan progress', async () => {
  const status = await run(['status', FIXTURE_REL, '--json']);
  assert.equal(status.code, 0, status.stderr);
  const parsed = JSON.parse(status.stdout);
  assert.equal(parsed.total, 5);
  assert.equal(parsed.completed, 1);
  assert.equal(parsed.complete, false);
  assert.equal(parsed.sections.length, 2);

  const next = await run(['next', FIXTURE_REL, '--json']);
  assert.equal(next.code, 0, next.stderr);
  const dispatch = JSON.parse(next.stdout);
  assert.equal(dispatch.sectionIndex, 0);
  assert.match(dispatch.prompt, /Task 1: Model/);

  const bad = await run(['status', path.join('docs', 'missing-plan.md')]);
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /not found/);
});

test('CLI mark flips a checkbox in the plan file on disk', async () => {
  const marked = await run(['mark', FIXTURE_REL, '12']);
  assert.equal(marked.code, 0, marked.stderr);
  const current = fs.readFileSync(writtenFixture, 'utf8');
  assert.match(current, /\n- \[x\] Implement the model\.\n/);
  fs.writeFileSync(writtenFixture, FIXTURE, 'utf8');
});

function mcpSession(messages, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT, '--mcp'], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...extraEnv },
    });
    const responses = [];
    let buffer = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`mcp timeout; got ${JSON.stringify(responses)}`));
    }, 8000);
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let index = buffer.indexOf('\n');
      while (index >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        if (line.trim()) responses.push(JSON.parse(line));
        index = buffer.indexOf('\n');
      }
      if (responses.length >= messages.filter((m) => m.id !== undefined).length) {
        clearTimeout(timer);
        child.stdin.end();
        child.kill();
        resolve(responses);
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.stdin.write(`${messages.map((m) => JSON.stringify(m)).join('\n')}\n`);
  });
}

test('MCP server lists the tools and executes a status + dispatch call', async () => {
  const responses = await mcpSession([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'plan_status', arguments: { plan: FIXTURE_REL } } },
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'dispatch_next_task', arguments: { plan: FIXTURE_REL } },
    },
    {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'dispatch_next_task', arguments: { plan: FIXTURE_REL, sectionIndex: 1 } },
    },
  ]);

  const byId = new Map(responses.map((response) => [response.id, response]));
  assert.equal(byId.get(1).result.serverInfo.name, 'subagent-dispatch');
  assert.deepEqual(
    byId.get(2).result.tools.map((tool) => tool.name),
    ['plan_status', 'dispatch_next_task', 'mark_task_done', 'dispatch_task'],
  );

  const status = JSON.parse(byId.get(3).result.content[0].text);
  assert.equal(status.total, 5);
  assert.equal(status.complete, false);
  assert.match(byId.get(4).result.content[0].text, /Task 1: Model/);
  assert.equal(byId.get(4).result.isError, false);
  assert.match(byId.get(5).result.content[0].text, /Task 2: Wire up/);

  fs.writeFileSync(writtenFixture, FIXTURE, 'utf8');
});

test('parseCommand tokenizes quoted runner commands', () => {
  assert.deepEqual(parseCommand('codex exec -'), ['codex', 'exec', '-']);
  assert.deepEqual(parseCommand('node "C:/tools/my runner.mjs" --flag'), [
    'node',
    'C:/tools/my runner.mjs',
    '--flag',
  ]);
  assert.deepEqual(parseCommand("node 'a b.mjs'"), ['node', 'a b.mjs']);
  assert.throws(() => parseCommand('node "unbalanced'), /unbalanced/);
  assert.throws(() => parseCommand('   '), /non-empty/);
});

test('detectRunner scans PATH and resolveRunner honours precedence', () => {
  const fakeBin = path.join(FIXTURE_DIR, 'bin');
  fs.mkdirSync(fakeBin, { recursive: true });
  fs.writeFileSync(path.join(fakeBin, 'codex'), '', 'utf8');

  const found = detectRunner(fakeBin, '', [{ name: 'codex', args: ['exec', '-'] }]);
  assert.equal(found.name, 'codex');
  assert.equal(found.path, path.join(fakeBin, 'codex'));
  assert.equal(detectRunner(path.join(fakeBin, 'missing'), '', [{ name: 'codex', args: [] }]), null);

  const fromFlag = resolveRunner({ flag: 'node x.mjs', env: { DISPATCH_RUNNER: 'ignored' } });
  assert.deepEqual(fromFlag.tokens, ['node', 'x.mjs']);
  assert.equal(fromFlag.source, '--runner');

  const fromEnv = resolveRunner({ flag: undefined, env: { DISPATCH_RUNNER: 'node y.mjs', PATH: fakeBin } });
  assert.deepEqual(fromEnv.tokens, ['node', 'y.mjs']);
  assert.equal(fromEnv.source, 'DISPATCH_RUNNER');

  const auto = resolveRunner({
    flag: undefined,
    env: { PATH: fakeBin },
    candidates: [{ name: 'codex', args: ['exec', '-'] }],
  });
  assert.equal(auto.source, 'auto');
  assert.deepEqual(auto.tokens.slice(1), ['exec', '-']);

  assert.equal(
    resolveRunner({
      flag: undefined,
      env: { PATH: path.join(fakeBin, 'missing') },
      candidates: [{ name: 'codex', args: [] }],
    }),
    null,
  );
});

test('CLI dispatch --dry-run prints the prompt and runs nothing', async () => {
  const before = fs.readFileSync(writtenFixture, 'utf8');
  const result = await run([
    'dispatch',
    FIXTURE_REL,
    '--dry-run',
    '--runner',
    'node runner.mjs',
  ]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /dry-run: no runner was executed/);
  assert.match(result.stdout, /Task 1: Model/);
  assert.equal(fs.readFileSync(writtenFixture, 'utf8'), before);
});

test('CLI dispatch pipes the prompt on stdin and mirrors the runner exit code', async () => {
  const ok = await run([
    'dispatch',
    FIXTURE_REL,
    '--runner',
    `node "${path.join(FIXTURE_DIR, 'runner-ok.mjs')}"`,
    '--section',
    '0',
  ]);
  assert.equal(ok.code, 0, ok.stderr);
  const received = fs.readFileSync(path.join(FIXTURE_DIR, 'runner-received.txt'), 'utf8');
  assert.match(received, /Sample Plan/);
  assert.match(received, /Task 1: Model/);

  const fail = await run([
    'dispatch',
    FIXTURE_REL,
    '--runner',
    `node "${path.join(FIXTURE_DIR, 'runner-fail.mjs')}"`,
  ]);
  assert.equal(fail.code, 7);
});

test('CLI dispatch enforces the runner timeout', async () => {
  const slow = await run([
    'dispatch',
    FIXTURE_REL,
    '--runner',
    'node -e setTimeout(()=>{},8000)',
    '--timeout',
    '1',
  ]);
  assert.equal(slow.code, 124, slow.stdout + slow.stderr);
  assert.match(slow.stderr, /timed out after 1s/);
});

test('MCP dispatch_task runs the configured runner without auto-ticking boxes', async () => {
  const responses = await mcpSession(
    [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'dispatch_task',
          arguments: { plan: FIXTURE_REL, sectionIndex: 0, timeoutSeconds: 30 },
        },
      },
    ],
    { DISPATCH_RUNNER: `node "${path.join(FIXTURE_DIR, 'runner-ok.mjs')}"` },
  );
  const byId = new Map(responses.map((response) => [response.id, response]));
  assert.equal(byId.get(2).result.isError, false);
  const payload = JSON.parse(byId.get(2).result.content[0].text);
  assert.equal(payload.exitCode, 0);
  assert.equal(payload.sectionIndex, 0);
  assert.equal(payload.runnerSource, 'DISPATCH_RUNNER');
  assert.match(payload.next, /Verify the report/);
  const still = fs.readFileSync(writtenFixture, 'utf8');
  assert.ok(still.includes('- [ ] Write failing test.'), 'boxes stay unticked');
  fs.writeFileSync(writtenFixture, FIXTURE, 'utf8');
});

test('MCP tool errors are reported as isError results', async () => {
  const responses = await mcpSession([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'mark_task_done', arguments: { plan: FIXTURE_REL, line: 4 } },
    },
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'nope', arguments: {} },
    },
    { jsonrpc: '2.0', id: 4, method: 'unknown/method' },
  ]);

  const byId = new Map(responses.map((response) => [response.id, response]));
  assert.equal(byId.get(2).result.isError, true);
  assert.match(byId.get(2).result.content[0].text, /not a checkbox line/);
  assert.equal(byId.get(3).result.isError, true);
  assert.equal(byId.get(4).error.code, -32601);
  fs.writeFileSync(writtenFixture, FIXTURE, 'utf8');
});