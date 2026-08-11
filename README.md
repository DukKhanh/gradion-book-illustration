# Gradion Book Illustration Studio

Gradion turns a pasted or uploaded book into a small, persisted illustrated-story workflow. Each generation action is explicit: prepare the book reference, choose or generate art direction, then generate characters, portraits, one chapter scene, and its illustration.

## Architecture and stack

- Frontend: React, TypeScript, Vite, TanStack Query.
- Backend: Express, TypeScript, Drizzle, SQLite via `@libsql/client`.
- Storage: local files for source books and generated JPEG images.
- Gemini: `gemini-3.6-flash` for text and `gemini-3.1-flash-lite-image` for images.

The backend is a modular monolith:

```text
Route → Controller → Service → Repository / Gemini adapter / FileStorageService
```

Pipeline state is persisted and server-authoritative:

```text
STYLE → CHARACTERS → PORTRAITS → CHAPTERS → ILLUSTRATIONS
```

## Prerequisites

- Node.js 20+ and npm.
- A Gemini API key only when deliberately exercising real generation.

## Configuration

Copy `.env.example` to `.env` and set a strong local `SESSION_SECRET`. Leave `GEMINI_API_KEY` empty for automated tests. The supported model defaults are already supplied in `.env.example`.

```env
GEMINI_TEXT_MODEL=gemini-3.6-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-lite-image
```

Never commit `.env` or API keys.

## Install and run

```powershell
npm install
npm run db:migrate
npm run dev
```

The API defaults to `http://localhost:3000`; Vite defaults to `http://localhost:5173` and proxies relative `/api` requests to the API.

## Verification

```powershell
npm run typecheck --workspace=apps/api
npm run test --workspace=apps/api
npm run build --workspace=apps/api

npm run typecheck --workspace=apps/web
npm run test --workspace=apps/web
npm run build --workspace=apps/web

npm test
npm run typecheck
git diff --check
```

## Main user flow

1. Enter a name and email to create or reuse a session identity.
2. Create an owned project using exactly one source: pasted book text or a UTF-8 `.txt` file.
3. Open the workspace and explicitly prepare the reusable Gemini Files API book reference.
4. Explicitly run each pipeline step in order. STYLE accepts either trimmed manual art direction or a blank AI request.
5. View persisted characters, authenticated portrait URLs, the chapter scene, and the authenticated illustration URL.

## Gemini cost and persistence behavior

- No provider call happens on page load, refresh, project list/detail load, or artifact rendering.
- The backend atomically acquires each pipeline step before a paid call.
- Gemini retries are never automatic.
- Failed steps are explicitly retryable; successful paid outputs are checkpointed durably.
- Portraits are persisted one at a time, so retry skips already durable images.
- The local `book.txt` is durable source material; Gemini Files references are provider-managed resources.

## Project structure

```text
apps/api/       Express API, Drizzle schema/migrations, pipeline services
apps/web/       React/Vite application
data/books/     ignored local book storage
data/images/    ignored local generated-image storage
docs/           architecture, plan, prompts, and product reference
examples/       assessment notebook/reference material
```
