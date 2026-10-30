# Gap Closure + Studio Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close documented Gaps G1/G9/G10/G11/G12 + AlifShohojPrint data-dir migration and harden Studio Canvas (walk-in print, overlays, validation, zoom-aware tools, history, focus trap, bg-removal progress).

**Tech Stack:** React 19 + TypeScript + Vite 8, Electron 43, better-sqlite3, pdf-to-printer/SumatraPDF, @imgly/background-removal

**Spec:** docs/design/plan.md Gaps G1–G14, docs/audit-2026-10-09.md, docs/ASSET_AUDIT.md, AGENTS.md §5

## Global Constraints

- npm is canonical package manager (AGENTS.md §3); do not add dependencies without reason.
- Renderer never touches Node/Electron directly — use preload bridge.
- Preserve WebSocket protocol and SQLite schema compatibility.
- Keep Electron sandbox/contextIsolation/sandbox invariants.
- Never log or commit bearer tokens/secrets.

## Tasks

### Task 1: G1 hygiene
### Task 2: G9/G10 PWA + packaging
### Task 3: G11/G12 docs + signing
### Task 4: Data-dir migration
### Task 5: Studio walk-in print + validation + TIFF
### Task 6: Studio overlays toggle UI
### Task 7: Studio zoom-aware tools
### Task 8: Studio history + focus trap + progress

