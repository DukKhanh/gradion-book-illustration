# Gradion Book Illustration Studio

Gradion Book Illustration Studio turns pasted or uploaded book text into a small, persisted illustrated-story workflow powered by the Gemini API.

Each generation action is explicit and user-driven: prepare the reusable book reference, choose or generate the art direction, generate characters and portraits, derive a chapter scene, and finally generate its illustration.

The application is designed to run locally and keeps pipeline progress, generated artifacts, and recovery state persisted across refreshes and restarts.

## Preview

> Screenshots will be added from the final local UAT.

### Project Library

<!-- Replace with the final project library screenshot. -->

```text
docs/screenshots/project-library.png
```

<!--
![Project Library](docs/screenshots/project-library.png)
-->

### Generation Workspace

<!-- Replace with the final workspace screenshot showing pipeline progress and generated artifacts. -->

```text
docs/screenshots/generation-workspace.png
```

<!--
![Generation Workspace](docs/screenshots/generation-workspace.png)
-->

### Completed Project

<!-- Replace with the final completed-project screenshot showing portraits and illustration. -->

```text
docs/screenshots/completed-project.png
```

<!--
![Completed Project](docs/screenshots/completed-project.png)
-->

## Architecture and Stack

- **Frontend:** React, TypeScript, Vite, TanStack Query
- **Backend:** Express, TypeScript, Drizzle, SQLite via `@libsql/client`
- **Storage:** local filesystem for source books and generated JPEG images
- **Gemini text model:** `gemini-3.6-flash`
- **Gemini image model:** `gemini-3.1-flash-lite-image`

The backend follows a small modular-monolith structure:

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository / Gemini Adapter / FileStorageService
```

Pipeline state is persisted and remains server-authoritative:

```text
STYLE
  ↓
CHARACTERS
  ↓
PORTRAITS
  ↓
CHAPTERS
  ↓
ILLUSTRATIONS
```

The frontend reads that persisted state rather than maintaining a separate client-side pipeline state machine.

## Prerequisites

Before running the application, install:

- Node.js 20+
- npm
- a Gemini API key when deliberately exercising real generation

A Gemini API key is not required for the automated test suite.

## Configuration

Copy `.env.example` to `.env`.

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### macOS / Linux

```bash
cp .env.example .env
```

Set a strong local `SESSION_SECRET`.

When testing real Gemini generation, also provide:

```env
GEMINI_API_KEY=your_local_api_key
```

The supported model defaults are already documented in `.env.example`:

```env
GEMINI_TEXT_MODEL=gemini-3.6-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-lite-image
```

Never commit `.env`, Gemini credentials, or other secrets.

## Quick Start

### First-time setup

Install dependencies:

```bash
npm install
```

Create the local environment file as described above, then initialize the database:

```bash
npm run db:migrate
```

### Start the full stack

```bash
npm run dev
```

This single command starts both applications:

- API: `http://localhost:3000`
- Web: `http://localhost:5173`

Vite proxies relative `/api` requests to the local API, keeping frontend requests same-origin during development.

## Run Tests

Run the complete backend and frontend automated test suite from the repository root:

```bash
npm test
```

Latest verified result:

```text
Backend
Test Files  26 passed (26)
Tests       109 passed (109)

Frontend
Test Files  3 passed (3)
Tests       29 passed (29)

Total
Test Files  29 passed
Tests       138 passed
Failed      0
```

Automated tests use fake or mocked Gemini boundaries and make no real Gemini generation calls.

See [`TESTING.md`](TESTING.md) for the testing strategy, deliberate exclusions, manual UAT scope, and the recorded test report.

## Additional Verification

Individual verification commands are available when reviewing a specific workspace.

### API

```bash
npm run typecheck --workspace=apps/api
npm run test --workspace=apps/api
npm run build --workspace=apps/api
```

### Web

```bash
npm run typecheck --workspace=apps/web
npm run test --workspace=apps/web
npm run build --workspace=apps/web
```

### Repository-wide checks

```bash
npm test
npm run typecheck
git diff --check
```

## Main User Flow

1. Enter a name and email to create or reuse a session identity.
2. View projects owned by the current identity.
3. Create a project using exactly one source:
   - pasted book text; or
   - a UTF-8 `.txt` file.
4. Open the project workspace.
5. Explicitly prepare the reusable Gemini book reference.
6. Run the five pipeline steps in order:
   - STYLE
   - CHARACTERS
   - PORTRAITS
   - CHAPTERS
   - ILLUSTRATIONS
7. View generated artifacts as they become durably persisted.
8. Refresh or return later without restarting completed work.

STYLE accepts optional manual art direction. Leaving it blank explicitly requests AI-generated art direction.

## Pipeline Behavior

The generation workflow is intentionally user-driven.

A step cannot run before its predecessors have completed.

The persisted backend state determines:

- completed step;
- currently running step;
- failed step;
- retry target;
- stale recovery availability;
- generated artifacts.

Refreshes, navigation, and workspace rendering do not fabricate pipeline progress on the client.

### Failure and Recovery

A failed generation step does not reset previously completed work.

The workspace exposes the failed step and allows the user to retry that step explicitly.

A stranded `RUNNING` state also has an explicit recovery path so a server interruption cannot leave the project permanently unusable.

No recovery operation runs automatically.

## Gemini Cost and Persistence Behavior

Gemini usage is deliberately constrained.

- No provider call happens on page load.
- No provider call happens when loading the project library.
- No provider call happens when opening or refreshing a workspace.
- No provider call happens merely because an artifact is rendered.
- Every generation action requires explicit user intent.
- The backend atomically acquires a pipeline step before performing a paid call.
- Gemini retries are never automatic.
- Pipeline steps never automatically chain into the next step.
- Successful paid outputs are checkpointed durably.
- Failed steps can be retried without discarding completed work.
- Portraits are persisted incrementally so retry can reuse already durable images.
- The source `book.txt` remains durable local source material.
- Gemini Files references are provider-managed resources and are not treated as permanent local storage.

The server also enforces the assessment generation limits rather than relying only on frontend controls.

## Session and Ownership

Identity intentionally remains lightweight.

A user starts with:

```text
name + email
```

An existing email reuses the corresponding identity and projects. A new email creates the identity.

Authentication state is represented by the server session.

Project access remains ownership-scoped so authenticated users retrieve only their own projects.

The frontend uses TanStack Query as the server-state source of truth and centrally handles expired or unauthenticated sessions.

## Project Structure

```text
.
├── apps/
│   ├── api/
│   │   ├── src/
│   │   └── drizzle/
│   │
│   └── web/
│       └── src/
│
├── data/
│   ├── books/        # ignored local source-book storage
│   └── images/       # ignored local generated-image storage
│
├── docs/
│   ├── architecture.md
│   ├── plan.md
│   ├── prompts/
│   └── screenshots/  # final README screenshots
│
├── examples/
│   └── Book_illustration.ipynb
│
├── AGENTS.md
├── DECISIONS.md
├── TESTING.md
├── README.md
└── .env.example
```

## Documentation

The repository intentionally keeps the AI-assisted development artifacts used during implementation.

Important files include:

- [`DECISIONS.md`](DECISIONS.md) — engineering decisions, trade-offs, and places where AI proposals were overridden
- [`TESTING.md`](TESTING.md) — testing strategy and real test results
- [`AGENTS.md`](AGENTS.md) — AI coding context and project constraints
- [`docs/architecture.md`](docs/architecture.md) — architecture notes
- [`docs/plan.md`](docs/plan.md) — implementation plan and phase progress
- [`docs/prompts/`](docs/prompts/) — saved implementation/review prompts
- [`examples/Book_illustration.ipynb`](examples/Book_illustration.ipynb) — sanitized assessment notebook/reference material

Git history is also part of the development record and is organized around incremental implementation phases.

## Local Storage

The project deliberately uses local storage rather than external object storage.

Runtime data is stored beneath:

```text
data/books/
data/images/
```

These generated/local runtime artifacts are ignored by Git.

No S3 bucket, CDN, or external blob-storage service is required.

## Deployment

This project is intentionally designed for **local execution only**.

It should not be deployed publicly. Real generation requires a private Gemini API credential, and the assessment explicitly treats local execution as the intended environment.

## Scope

The implementation covers the required five-step book illustration workflow:

```text
STYLE → CHARACTERS → PORTRAITS → CHAPTERS → ILLUSTRATIONS
```

It intentionally does not add later notebook functionality such as:

- video generation;
- music generation;
- text-to-speech narration;
- media mixing;
- audiobook generation.

The focus is the smallest full-stack implementation that preserves correct ordering, persistence, concurrency protection, retry behavior, recovery, and explicit control over paid Gemini calls.