# Engineering Decisions

This document records meaningful engineering decisions and trade-offs made
during the implementation of the Gradion assessment.

It is intentionally not a worklog. Git history records implementation
progress.

Each decision explains:

- what was initially proposed or considered;
- what was challenged;
- the final decision;
- the trade-off accepted.

---

## Decision 1 — Use cost-oriented Gemini models

### Context

The application requires both text reasoning and image generation through the
Gemini API. API usage is paid, so model selection and unnecessary generation
directly affect the cost of completing and testing the assessment.

### Decision

Use:

- `gemini-3.6-flash` for text generation;
- `gemini-3.1-flash-lite-image` for image generation.

Cost control is also enforced through application behavior:

- reuse the persisted book context;
- limit characters to 2;
- limit chapters to 1;
- generate at most 2 portraits and 1 chapter illustration in the normal flow;
- never automatically retry Gemini generation;
- persist generated images immediately;
- skip completed images during retry;
- mock Gemini in automated tests.

### Trade-off

The implementation prioritizes cost efficiency over using the most expensive
model available for maximum generation quality.

For this assessment, reliable pipeline behavior and controlled API usage are
more important than maximizing image quality.

---

## Decision 2 — Replace better-sqlite3 with @libsql/client

**AI override #1**

### Context

AI initially suggested using `better-sqlite3` with Drizzle because it provides
a simple SQLite integration for a small local application.

During project setup on Windows, installing `better-sqlite3` required native
compilation through `node-gyp`.

The installation failed because the environment did not contain the Visual
Studio C++ build workload.

Node's built-in `node:sqlite` was also investigated, but using it cleanly with
the selected stable Drizzle setup would have required changing the dependency
strategy.

### Decision

Keep:

- SQLite;
- Drizzle ORM.

Replace:

`better-sqlite3`

with:

`@libsql/client`

The application still uses a local SQLite database file.

### Why I Overrode the AI Suggestion

Installing a large native C++ build toolchain only to support the database
driver would make the assessment unnecessarily difficult to set up on Windows.

The database requirement itself did not justify that additional environment
dependency.

### Trade-off

The project gains another JavaScript dependency, but setup becomes simpler and
more portable while preserving the intended SQLite + Drizzle persistence
model.

---

## Decision 3 — Use reduced Clean Architecture

**AI override #2**

### Context

AI proposed applying Clean Architecture to improve separation of concerns and
testability.

A full implementation could introduce layers and abstractions such as:

- domain;
- application;
- infrastructure;
- ports;
- adapters;
- use-case classes;
- factories;
- mappers.

For a time-bounded assessment with a relatively small domain, this would add
substantial boilerplate.

### Decision

Keep the useful Clean Architecture boundaries but implement them as a modular
monolith organized by feature.

Backend dependency flow:

Route
→ Controller
→ Service
→ Repository / GeminiService / FileStorageService

Responsibilities remain separated:

- Controller: HTTP concerns.
- Service: business rules and orchestration.
- Repository: persistence.
- GeminiService: Gemini API integration.
- FileStorageService: filesystem persistence.

Additional abstractions are introduced only when a concrete requirement needs
them.

### Why I Overrode the AI Suggestion

The full architecture was more complex than necessary for the assessment.

The reduced structure preserves separation of concerns and testability without
building infrastructure for hypothetical future requirements.

### Trade-off

The implementation has less theoretical isolation than a complete
ports-and-adapters architecture.

In return, it has substantially less boilerplate and is easier to understand,
implement, and review within the assessment timeframe.

---

## Future Decisions

Additional decisions will be added only when they genuinely occur during
implementation.

The final submission will keep approximately 4–6 of the most meaningful
decisions, including at least three genuine cases where AI output was
challenged, corrected, or simplified.

---

## If I Had One More Day

_To be completed near the end of the assessment._

## Decision 4 — Preserve the failed step instead of clearing execution state

**AI override #3**

### Context

During the Phase 4 pipeline design, Codex initially proposed clearing the
running execution fields after both successful and failed execution.

The existing persistence model does not have a separate `failedStep` field.
Clearing `runningStep` after failure would therefore lose the identity of the
step that must be retried.

### Decision

On successful execution:

- advance `completedStep`;
- clear `runningStep`;
- clear `stepStartedAt`;
- clear `stepError`;
- return the pipeline to `IDLE`.

On failed execution:

- preserve `completedStep`;
- keep the failed step in `runningStep`;
- set `stepState` to `FAILED`;
- clear `stepStartedAt`;
- persist a safe error message.

Explicit stale recovery follows the same rule: stale `RUNNING` work becomes
`FAILED` while preserving the step identity.

### Why I Overrode the AI Suggestion

Clearing `runningStep` on failure discarded information required to retry the
exact failed step.

Adding another `failedStep` column would solve that problem but would introduce
an additional state field and migration that are unnecessary for the current
sequential pipeline.

### Trade-off

`runningStep` now represents the current active or retryable step rather than
strictly a step that is executing at this exact moment.

This slightly broadens the field's semantics, but keeps the persistence model
small and makes retry behavior unambiguous.

---

## Decision 5 — Use local server sessions for passwordless identity

### Context

The assessment needs lightweight name/email identity, authenticated project
ownership, and sign-out. Introducing JWTs, refresh tokens, OAuth, or an
external identity provider would add security and operational machinery that
the local assessment does not need.

### Decision

Use `express-session` with an HTTP-only cookie. The server stores only the
authenticated user ID in the session; project and pipeline services enforce
ownership through user-scoped repository queries.

The default memory session store is acceptable for this local phase. After a
backend restart, users identify again with the same email and recover their
persisted projects.

### Trade-off

Sessions are intentionally not durable across backend restarts. This avoids
adding a session database or external infrastructure while keeping project data
durable and ownership checks server-side.
