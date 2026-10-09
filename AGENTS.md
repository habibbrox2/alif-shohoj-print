# Agent Guide

## Project overview

ALIF SHOHOJ PRINT is a React and TypeScript point-of-sale application built with Vite, plus a Windows Electron desktop print agent. The renderer lives in `src/`; Electron main-process code and print services live in `electron/`.

## Development commands

- `npm run dev` — start the web UI at `http://127.0.0.1:3000`.
- `npm run dev:desktop` — run the UI and Electron app together.
- `npm run lint` — type-check the renderer TypeScript project.
- `npm run test:desktop` — run Electron service tests.
- `npm run test:renderer` — run renderer service tests.
- `npm run build` — build the renderer.
- `npm run verify` — run lint, tests, Electron SQLite smoke check, and both builds.

Run the narrowest relevant check for a change. Do not run packaging or signing commands unless the task calls for them.

## Code layout

- `src/features/` — user-facing product areas such as Shop POS, studio editor, print agent, printers, and customer PWA.
- `src/shared/` — shared components, contexts, types, and services.
- `electron/main.ts` — Electron lifecycle and main-process wiring.
- `electron/services/` — print queue, WebSocket server, logging, and printing services.
- `scripts/` — build and runtime verification helpers.

Keep renderer code independent from Node/Electron APIs. Use the existing preload bridge in `electron/preload.cjs` and `src/shared/desktop-api.ts` for renderer-to-desktop communication.

## Implementation guidance

- Follow the existing TypeScript and React patterns; keep changes scoped to the relevant feature or service.
- Preserve the WebSocket protocol and persisted SQLite data compatibility unless the task explicitly changes them.
- Validate data received across process or network boundaries. Treat the shared WebSocket bearer token as a credential; never log or commit it, certificates, signing passwords, or real customer data.
- Use the existing tests under `electron/services/__tests__/` and `src/shared/services/__tests__/` when changing those areas.
- Update `README.md` when changing setup, user-visible behavior, print-agent configuration, or packaging instructions.

## Generated and local data

Do not hand-edit generated output under `dist/`, `dist-electron/`, or `release/`. Keep local credentials and machine-specific configuration out of source control.
