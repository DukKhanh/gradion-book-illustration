# Project Context

Build the Gradion Book Illustration Studio assessment.

## Source of Truth

The Gradion assessment brief is authoritative.

## Stack

Frontend:
- React
- TypeScript
- Vite

Backend:
- Express
- TypeScript
- Drizzle
- SQLite

Gemini:
- Text: gemini-3.6-flash
- Image: gemini-3.1-flash-lite-image

## Architecture

Use a modular monolith with reduced Clean Architecture:

Route
→ Controller
→ Service
→ Repository / GeminiService / FileStorageService

Do not over-engineer.

## Required Pipeline

1. STYLE
2. CHARACTERS
3. PORTRAITS
4. CHAPTERS
5. ILLUSTRATIONS

## Hard Constraints

- Maximum 2 adult characters.
- Maximum 1 chapter.
- Limits are enforced server-side.
- Steps run only in order.
- Every step requires explicit user action.
- No duplicate Gemini calls.
- No automatic Gemini retries.
- Failed steps can be retried.
- Completed work must survive refresh and backend restart.
- Stale RUNNING steps must be recoverable.
- Book content is sent/referenced once and reused.
- Completed images are never regenerated unnecessarily.

## Cost Rules

- Use gemini-3.6-flash for text.
- Use gemini-3.1-flash-lite-image for images.
- Maximum 2 portraits + 1 illustration.
- Persist each generated image immediately.
- Retry skips completed images.
- Automated tests mock Gemini.

## Testing

Critical backend behavior must be tested:

- ordering;
- concurrency;
- retry;
- stale recovery;
- server-side caps.

Frontend tests focus on:

- empty;
- running;
- error;
- stale;
- done states.

## AI Rule

Do not blindly accept AI output.

When AI output is wrong, unsafe, costly, or over-engineered:
- correct it;
- test the correction;
- record meaningful cases in DECISIONS.md.

## Git Rule

After every completed and verified phase:

typecheck
→ test
→ build
→ git status
→ commit
→ push