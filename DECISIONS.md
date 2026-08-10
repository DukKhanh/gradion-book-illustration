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

- reuse the persisted Gemini book file reference;
- limit characters to 2;
- limit chapters to 1;
- generate at most 2 portraits and 1 chapter illustration in the normal flow;
- never automatically retry Gemini generation;
- persist generated results as durable checkpoints where appropriate;
- persist generated images immediately;
- skip completed generation work during retry when a valid durable result
  already exists;
- mock Gemini in automated tests.

### Trade-off

The implementation prioritizes cost efficiency over using the most expensive
model available for maximum generation quality.

For this assessment, reliable pipeline behavior, resumability, and controlled
API usage are more important than maximizing generation quality.

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

```text
better-sqlite3
```

with:

```text
@libsql/client
```

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

```text
Route
→ Controller
→ Service
→ Repository / GeminiService / FileStorageService
```

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

## Decision 5 — Treat validated STYLE persistence as a durable paid-call checkpoint

### Context

Phase 7 introduced the first real Gemini generation step in the pipeline.

A difficult failure window exists between successfully generating and
persisting STYLE and successfully completing the pipeline state transition:

```text
Gemini generation succeeds
→ STYLE validates
→ STYLE persistence succeeds
→ final pipeline completeStep() fails
```

At this point, the application has already paid for and safely persisted a
valid generation result, but the pipeline still cannot claim that STYLE
completed.

A naive retry would call Gemini again and pay for a duplicate result.

A second naive approach would treat every non-null `projects.style` as proof
that STYLE generation is complete. That is also unsafe because STYLE may be
user-supplied, stale, or unrelated to the exact retry path.

### Decision

Treat a validated persisted STYLE as a durable generation checkpoint, but only
in a narrowly defined retry path.

`PipelineService` derives retry state from the project snapshot that existed
before the atomic STYLE acquisition and passes that information to the STYLE
executor.

The executor may reuse the persisted STYLE and make zero Gemini calls only
when:

- the current execution is an explicit retry of the failed STYLE step;
- the persisted STYLE validates against the expected STYLE schema;
- the pipeline state indicates that STYLE is the retryable step.

The executor does not use a blanket rule such as:

```text
projects.style != null
→ skip Gemini
```

The important recovery flow is:

```text
Gemini generation
→ validate STYLE
→ persist STYLE
→ final pipeline completion transition fails
→ operation remains RUNNING
→ explicit stale recovery
→ STYLE becomes FAILED
→ explicit user retry
→ validate persisted STYLE checkpoint
→ skip Gemini
→ retry pipeline completion
```

Manual STYLE follows the same pipeline acquisition and persistence guarantees
but makes zero Gemini calls.

### Why I Overrode the AI Suggestion

A simpler retry implementation could repeat the Gemini call after the final
pipeline transition failed.

That behavior would be functionally recoverable, but it would unnecessarily
consume paid API quota even though the valid generation result had already
been persisted.

Conversely, blindly trusting any existing STYLE would weaken pipeline
correctness.

The final implementation therefore distinguishes between:

```text
persisted data exists
```

and:

```text
persisted data is a valid checkpoint for this explicit retry
```

### Trade-off

The retry logic requires slightly more execution context because
`PipelineService` must derive and pass retry information from the
pre-acquisition snapshot.

In return, the system avoids duplicate paid Gemini calls in an important
partial-failure case while preserving strict pipeline completion semantics.

This checkpoint pattern can also inform later paid generation steps, but it
should only be reused where a durable generated result can be safely proven.

---

## Decision 6 — Persist a Gemini Files API URI, not an invented context object

### Context

The initial schema included an opaque Gemini interaction identifier, which
could suggest creating a provider interaction or cache while preparing a book.

During Phase 6 design, the proposed integration was reviewed against the actual
Gemini API behavior.

The Gemini Files API already returns a reusable file URI after upload. Later
model requests can reference that URI directly, so preparing the book does not
require inventing a second provider interaction or cache operation.

Phase 7 further validated this decision because STYLE generation can consume
the persisted file URI directly without uploading or resending the book.

### Decision

Phase 6 performs one explicit provider operation:

```text
Local persisted book
→ Gemini Files API upload
→ persist returned file URI
→ READY
```

The application stores the returned URI in:

```text
geminiBookFileUri
```

The existing:

```text
geminiBookInteractionId
```

remains nullable and unused.

No provider interaction/cache identifier is created merely to populate an
existing database field.

Later text-generation steps, beginning with Phase 7 STYLE, reuse
`geminiBookFileUri` directly.

Uploaded Files API resources are temporary provider resources.

The local persisted `book.txt` remains the durable source of truth.

If a later generation request discovers that a provider reference has expired,
the application should require explicit user reinitialization rather than
silently performing another paid upload.

The book preparation state is persisted as:

```text
IDLE
RUNNING
FAILED
READY
```

Initialization is explicitly user-triggered and guarded by an atomic
conditional database update so concurrent requests cannot both perform the
Gemini upload.

A project already in `READY` returns without another Gemini call.

### Trade-off

This keeps the Gemini integration small and avoids building a speculative
interaction or cache lifecycle before it is actually required.

It also means that persisted readiness does not guarantee that the provider
still retains the referenced file indefinitely.

The application therefore distinguishes between:

```text
Local book
= durable application data

Gemini file URI
= temporary provider reference
```

This design favors explicit behavior, controlled API cost, and a small
integration surface over attempting to hide provider-resource expiration from
the user.

---

## Future Decisions

The document has reached the intended six-decision limit.

Phase 7 produced a stronger assessment-specific engineering decision around
durable generation checkpoints and paid-call recovery. It therefore replaced
the previous local-session decision in this document.

The session implementation remains part of the application architecture and
Git history, but it is no longer one of the six decisions highlighted here.

If a later implementation produces a more meaningful engineering trade-off,
an existing weaker decision should be replaced rather than continuously adding
new entries.

This keeps the document focused on decisions that materially affected:

- architecture;
- correctness;
- concurrency;
- resumability;
- Gemini API cost;
- AI-assisted engineering decisions.

It should not become an implementation worklog.

---

## If I Had One More Day

*To be completed near the end of the assessment.*