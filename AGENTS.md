# ALIF SHOHOJ PRINT — Agent Instructions

## 1. Purpose and language

This file is the shared project rulebook for coding agents working in this repository. Follow it in Codex, Kilo Code, Cline, and other tools that support repository instructions; verify each tool's instruction-loading behavior rather than assuming it reads this file.

- Write code, identifiers, comments, commit messages, and technical documentation in clear English unless the existing feature requires Bengali or another language.
- Final user-facing summaries and progress reports must be in Bengali.
- Prefer small, focused, reviewable changes. Do not perform unrelated cleanup or broad rewrites.

## 2. Verified project architecture

ALIF SHOHOJ PRINT is a React + TypeScript POS/print-shop UI built with Vite and a Windows Electron desktop print agent.

- `src/` — renderer, product features, shared UI, types, and services.
- `src/features/` — Shop POS, studio editor, print agent, printers, and customer PWA.
- `src/shared/` — shared components, contexts, types, and services.
- `electron/main.ts` — Electron lifecycle and main-process wiring.
- `electron/preload.cjs` — preload bridge.
- `electron/services/` — print queue/storage, WebSocket, local gateway, logging, and print services.
- `scripts/` — runtime and signing verification helpers.
- `electron-builder.yml` — Windows NSIS packaging configuration.
- `artifacts/releases/` — configured installer output directory.

Renderer code must not access Node.js or Electron APIs directly. Use the existing preload bridge and `src/shared/desktop-api.ts` for renderer-to-desktop communication.

## 3. Package manager and verified commands

The repository contains both `package-lock.json` and `bun.lock`; the current README and project scripts document npm. Use **npm as the canonical package manager** unless the maintainer explicitly changes this policy. Do not regenerate or delete either lockfile as incidental cleanup.

Run only the checks relevant to the task; inspect `package.json` before relying on a command.

- `npm run dev` — start Vite on port 3000 (the script binds to `0.0.0.0`; do not assume it is loopback-only).
- `npm run dev:desktop` — run Vite and Electron together.
- `npm run lint` — TypeScript check for the renderer project.
- `npm run test:desktop` — Electron service tests listed in `package.json`.
- `npm run test:renderer` — renderer service tests listed in `package.json`.
- `npm run test:electron-runtime` — Electron SQLite runtime smoke test.
- `npm run build` — build the renderer.
- `npm run build:electron` — type-check/build Electron main-process code and copy preload.
- `npm run verify` — lint, listed desktop and renderer tests, runtime smoke test, and both builds.
- `npm run app:dir` — verify and package an unpacked app directory.
- `npm run app:dist` — verify and build a Windows NSIS installer.
- `npm run app:dist:signed` — verify signing configuration, then build the installer.

The current test scripts do not list `electron/services/__tests__/sound-service.test.ts` or `src/shared/services/__tests__/voiceGuideService.test.ts`. If relevant, inspect these tests and report this coverage gap; do not silently change scripts as part of an unrelated task.

## 4. Implementation and compatibility rules

- Follow existing TypeScript, React, Vite, and Electron patterns.
- Preserve the existing WebSocket message protocol and SQLite schema/data compatibility unless the task explicitly requires a migration.
- Validate all untrusted inputs at process, network, filesystem, and renderer boundaries.
- Keep job state transitions and print side effects explicit; queue acceptance is not proof that printing completed.
- Handle temporary print files and customer documents carefully; clean up only when it is safe and consistent with retry behavior.
- Update `README.md` when setup, user-visible behavior, print-agent configuration, or packaging instructions change.
- Add or update focused tests for behavior changes. Never claim tests passed unless they were actually run.

## 5. Electron and network security

Security settings are invariants, not optional cleanup:

- Keep renderer Node.js integration disabled, context isolation enabled, and sandboxing enabled where compatible with the current architecture. Any exception requires a documented reason and explicit maintainer approval.
- Expose only narrow, purpose-specific methods through `electron/preload.cjs`; never expose unrestricted Node.js access or the entire IPC renderer API.
- Validate IPC sender identity and payload shape before performing privileged operations.
- Treat WebSocket bearer tokens as passwords. Never log, commit, print in reports, or place them in screenshots.
- The WebSocket listener must remain loopback-bound by default. Binding to a LAN or other non-loopback interface requires TLS, a trusted matching certificate, and a suitably restricted Windows Firewall rule.
- Treat the local customer-order gateway, uploaded print files, URLs, and message payloads as untrusted input. Apply size/type validation and safe error handling.
- Do not weaken authentication, TLS, navigation restrictions, filesystem boundaries, or print-job validation merely to make a test pass.
- Never include real customer data, local credentials, certificate contents, or signing passwords in code, logs, fixtures, or documentation.

Consult the official Electron security guidance before changing security-sensitive Electron behavior: https://www.electronjs.org/docs/latest/tutorial/security

## 6. Generated files and local data

Do not hand-edit or commit generated build/package output unless the task explicitly requires it and the maintainer approves:

- `dist/`
- `dist-electron/`
- `artifacts/releases/`
- `release/` (if present)

Do not overwrite local configuration, user data, SQLite databases, logs, crash dumps, or secrets. Never inspect or print secret values unnecessarily. Keep machine-specific files and signing certificates out of source control.

## 7. Git, dependency, packaging, and release boundaries

- Start by checking `git status --short --branch` and identify the repository root.
- Preserve pre-existing staged, unstaged, and untracked changes. Do not revert or overwrite work unrelated to the task.
- Do not run destructive Git commands, reset/clean the working tree, or delete user data.
- Do not add, remove, or upgrade dependencies without a task-related reason; explain lockfile impact.
- Do not run installer packaging, code signing, publish a release, commit, push, create a PR, or deploy unless the user explicitly authorizes that action.
- Approval to edit a file does not imply approval to commit, push, sign, publish, or deploy.
- Never bypass a security or repository policy gate to complete a task.

## 8. Definition of done

Before reporting completion:

1. Review the final diff and confirm only intended files changed.
2. Run the narrowest relevant checks; run broader verification only when appropriate and authorized.
3. Report commands and results truthfully, including failures and checks not run.
4. Note remaining risks, assumptions, test gaps, and any follow-up needed.
5. Do not claim the app was tested on a real printer unless that hardware test actually occurred.

## 9. Final report / চূড়ান্ত প্রতিবেদন

Respond to the user in Bengali. Include:

- কী পরিবর্তন করা হয়েছে এবং কেন
- পরিবর্তিত ফাইলের তালিকা
- চালানো validation/test command ও ফলাফল
- যে পরীক্ষা চালানো হয়নি এবং তার কারণ
- অবশিষ্ট ঝুঁকি বা পরবর্তী সুপারিশ

Do not include credentials, private customer information, or secret values in the report.


## 10. AI-assisted contributions and review

When preparing a contribution for an issue, pull request, or external repository:

- Disclose the use of AI/LLM assistance in the initial issue or pull request when the target project's contribution policy requires it. Name the tools and models actually used; never guess or invent model names.
- Personally review every AI-generated or AI-edited line of code, configuration, documentation, and other content before requesting review. The contributor must understand the change and be able to explain its purpose, behavior, trade-offs, and risks.
- Do not submit code that the contributor cannot explain or maintain. Validate generated code against the project's actual architecture, security boundaries, tests, and coding conventions.
- Answer maintainer questions and review comments from the contributor's own understanding. AI may help translate or polish a response, but must not manufacture an explanation or answer that the contributor does not understand or endorse.
- Avoid repetitive, superficial PR-fix cycles. Investigate review feedback, understand the root cause, and validate the complete change before requesting another review.
- Do not add AI attribution trailers such as `Assisted-by`, `Co-developed-by`, or equivalent to commit messages unless the target repository explicitly requires them.
- If a target project's explicit contribution policy cannot or will not be followed, do not continue submitting the contribution; follow that project's stated process for withdrawing or closing it. Do not close unrelated issues or PRs automatically.

These rules do not replace the contribution policy of an external repository. Check its current instructions before opening or updating an issue or PR.

## 11. Git hygiene, commit messages, and line endings

- Write commit messages in English. Keep the subject concise and imperative where practical; put implementation details, rationale, test results, and screenshots in the pull request description rather than an overly long commit subject.
- Before staging, inspect `git status --short` and stage only files intentionally included in the change. Never use broad staging as a shortcut when unrelated or pre-existing modifications are present.
- Use LF line endings for tracked text files. The repository's `.gitattributes` is the source of truth for Git's text normalization and line-ending behavior; do not rely solely on local editor settings.
- If line-ending normalization is needed, inspect `.gitattributes`, `git status`, and the proposed diff first. Treat `git add --renormalize .` as a deliberate repository-wide operation, not a routine command. Do not run it, stage its results, or commit them without explicit authorization and a review of the full impact.
- Add suitable binary-file rules to `.gitattributes` when introducing a new binary file extension, so Git does not attempt text normalization or misleading text diffs.
- Do not make a repository-wide line-ending conversion part of an unrelated feature change. Keep normalization changes separate and reviewable.

## 12. Ignore rules and repository hygiene

- Review `.gitignore` whenever introducing new generated output, local configuration, caches, temporary files, test artifacts, or machine-specific data.
- Ignore only files that should not be versioned, such as secrets, local-only configuration, caches, and reproducible build output. Do not ignore source files, required project configuration, lockfiles, tests, or documentation merely to hide a dirty working tree.
- Keep real credentials, customer documents/data, signing certificates, private keys, local databases, logs, crash dumps, and temporary print files out of version control when they are local/runtime data.
- Preserve and document safe example configuration files such as `.env.example`; never put real secrets in examples.
- Before adding or changing an ignore pattern, check whether matching files are already tracked. `.gitignore` does not untrack files that are already committed; do not remove tracked files from the index without explicit approval.
- Use targeted patterns and verify important cases with `git check-ignore -v <path>`. Do not add broad patterns that could hide legitimate source or required assets.
- Do not treat ignored files as disposable. Never delete local files or customer data merely because they are ignored by Git.


## 13. Code style and maintainability

- Keep comments minimal. Add comments to explain **why** a non-obvious decision, constraint, workaround, or security measure exists—not what the code already makes clear.
- Do not add change-history comments such as `// newly added`, `// changed to fix`, or `// updated logic`. Put change descriptions in commit messages or pull request descriptions.
- Follow the repository's existing formatting, naming conventions, ESLint rules, and TypeScript configuration. Do not introduce a competing style or formatter without approval.
- Prefer explicit, accurate TypeScript types. Avoid `any`; use `unknown` at untrusted boundaries and narrow it before use. Avoid unnecessary type assertions and never suppress type errors merely to make checks pass.
- Keep functions and components focused on a clear responsibility. Prefer straightforward, readable code over clever expressions, excessive abstraction, or premature generalization.
- Reuse established components, hooks, utilities, and types when appropriate. Avoid duplicating business logic or introducing a second implementation of an existing behavior.
- In React, derive values directly when practical. Use effects for genuine synchronization with external systems, not as a default mechanism for derived state. Apply memoization when justified by actual requirements or measured performance.
- Handle asynchronous operations and errors explicitly. Do not silently swallow failures, expose sensitive internals to users, or log credentials, tokens, or private customer data.
- Preserve public interfaces, persisted data formats, WebSocket protocols, and Electron IPC contracts unless the task explicitly requires a compatible change.
- Respect the Electron security boundary: renderer code must use the approved preload bridge and shared desktop API rather than accessing privileged Node.js or Electron APIs directly.
- Make the smallest coherent change that solves the task. Avoid unrelated formatting, file-wide rewrites, dependency changes, and opportunistic refactoring.
- Add or update focused tests for behavior changes. Run relevant checks and report their actual results; do not claim unverified correctness.
- Before finishing, review the diff for redundant comments, unclear names, unnecessary complexity, duplicated logic, and unrelated changes.
