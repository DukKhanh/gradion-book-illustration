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

### Phase 6 — Gemini Book File Reference

- explicit Gemini Files API initialization
- persisted reusable Gemini book file URI
- atomic acquisition, failure, retry, and stale recovery
- local `book.txt` retained as durable source of truth
- no provider conversation/interaction state required

### Phase 7 — STYLE Generation

- optional manual or structured AI-generated style
- persisted Gemini Files URI reuse
- stateless `generateContent` request
- conditional STYLE persistence and durable checkpoint recovery

### Phase 8 — CHARACTERS Generation

- one or two validated adult-character prompts
- transactional complete-set persistence at positions 0 and 1
- stateless `generateContent` request using persisted STYLE
- durable complete-set checkpoint recovery

### Phase 9 — PORTRAITS Generation

- sequential image generation with per-character durable checkpoints
- local portrait persistence and authenticated retrieval
- stateless image `generateContent` request using persisted STYLE + character prompt
- partial retry without regenerating completed portraits

### Phase 10 — CHAPTERS Generation

- one validated opening-scene illustration prompt
- transactional single-chapter persistence
- stateless `generateContent` request using persisted STYLE + characters + book reference
- durable checkpoint recovery after lost final completion

### Phase 11 — ILLUSTRATIONS Generation

- one durable final chapter illustration
- authenticated illustration retrieval
- stateless multimodal `generateContent` request using persisted portrait JPEGs
- checkpoint retry without regenerating durable images

### Phase 12 — Frontend Foundation & Project Flow

- session bootstrap, identity, and sign out
- owned project library and project creation
- pasted text and `.txt` upload flow
- persisted project workspace and read-only pipeline progress
- responsive frontend foundation

### Phase 13 — Generation Workflow

- explicit Gemini-book initialization and pipeline actions
- STYLE through ILLUSTRATIONS controls
- failures, retries, and stale recovery UI

## Current

### Phase 14 — Final Testing and Documentation

- audit and approved final corrections
- final typecheck, test, build, and migration verification pending
- submission documentation and hygiene review pending
