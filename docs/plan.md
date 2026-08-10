# Implementation Plan

## Completed

### Phase 1 — Workspace

- React + Vite + TypeScript
- Express + TypeScript
- Drizzle + SQLite
- environment validation
- health endpoint
- backend test harness
- migration setup

Verified:
- typecheck
- tests
- build
- migration
- health endpoint

## Completed

### Phase 2 — Architecture and AI Context

- AGENTS.md
- architecture.md
- implementation plan
- DECISIONS.md
- TESTING.md

### Phase 3 — Persistence Model

- users
- projects
- characters
- chapters

### Phase 4 — Pipeline Engine

- ordering
- atomic execution guard
- retry
- stale recovery
- ownership-scoped pipeline mutations

### Phase 5 — Identity and Projects

- passwordless session identity
- owned project list/detail/create
- pasted text and `.txt` uploads
- local book persistence

### Phase 6 — Gemini Book Context

- explicit Gemini Files API initialization
- persisted reusable Gemini book file URI
- atomic acquisition, failure, retry, and stale recovery
- local `book.txt` retained as durable source of truth

### Phase 7 — STYLE Generation

- optional manual or structured AI-generated style
- persisted Gemini Files URI reuse
- conditional STYLE persistence and durable checkpoint recovery

### Phase 8 — CHARACTERS Generation

- one or two validated adult-character prompts
- transactional complete-set persistence at positions 0 and 1
- durable complete-set checkpoint recovery

### Phase 9 — PORTRAITS Generation

- sequential image generation with per-character durable checkpoints
- local portrait persistence and authenticated retrieval
- partial retry without regenerating completed portraits

### Phase 10 — CHAPTERS Generation

- one validated opening-scene illustration prompt
- transactional single-chapter persistence
- durable checkpoint recovery after lost final completion

## Current

### Phase 11 — ILLUSTRATIONS Generation

Implement:
- one durable final chapter illustration
- authenticated illustration retrieval
- checkpoint retry without regenerating durable images

Models:
- gemini-3.6-flash
- gemini-3.1-flash-lite-image

### Phase 12 — Frontend

Implement:
- Identity
- Projects
- New Project
- Project Detail
- pipeline state UI
- retry/recovery

### Phase 13 — Final Testing and Documentation

- backend tests
- frontend tests
- mocked integration test
- real UAT
- README
- DECISIONS.md
- TESTING.md
