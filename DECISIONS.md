# Engineering Decisions

This document records the most meaningful engineering decisions and trade-offs
made during the implementation of the Gradion assessment.

It is intentionally not a worklog. Git history and `docs/prompts/` record
implementation progress and the detailed AI-assisted workflow.

The final document keeps only a small number of decisions that materially
affected:

- architecture;
- correctness;
- concurrency;
- resumability;
- Gemini API cost;
- implementation simplicity;
- AI-assisted engineering judgment.

Each decision explains:

- what was initially proposed or considered;
- what was challenged;
- the final decision;
- the trade-off accepted.

---

## Decision 1 — Use cost-oriented Gemini models and explicit paid-call control

### Context

The application requires both text reasoning and image generation through the
Gemini API.

API usage is paid, so model choice matters, but model selection alone is not
enough to control cost.

Duplicate calls caused by retries, concurrent requests, lost persistence
transitions, or partial multi-image failures could consume more quota than the
normal successful pipeline.

### Decision

Use:

- `gemini-3.6-flash` for text generation;
- `gemini-3.1-flash-lite-image` for image generation.

Keep the model names configuration-driven.

Cost control is also enforced through application behavior:

- reuse the persisted Gemini Files API book reference;
- limit characters to at most two;
- limit chapters to one;
- generate at most two portraits in the normal flow;
- generate only the required chapter illustration;
- never automatically retry Gemini generation;
- atomically acquire pipeline work before any paid call;
- persist successful paid results as durable checkpoints;
- skip already durable results during explicit retry;
- generate multi-image work sequentially rather than eagerly in parallel;
- use fake Gemini adapters in automated tests;
- perform real Gemini calls only through explicit user-triggered actions.

### Trade-off

The implementation prioritizes controlled API usage and predictable behavior
over maximum generation quality or maximum generation speed.

Sequential image generation can be slower than parallel generation, and the
chosen models may not provide the highest possible output quality.

For this assessment, predictable cost, resumability, and correctness are more
important than optimizing for raw throughput or premium model quality.

---

## Decision 2 — Replace better-sqlite3 with @libsql/client

**AI override #1**

### Context

AI initially suggested using `better-sqlite3` with Drizzle because it provides
a straightforward SQLite integration for a small local application.

During project setup on Windows, installing `better-sqlite3` required native
compilation through `node-gyp`.

The installation failed because the development environment did not contain
the required Visual Studio C++ build workload.

Node's built-in `node:sqlite` was also investigated, but adopting it cleanly
with the selected Drizzle setup would have required changing the dependency
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

Installing a large native C++ build toolchain only to support the local
database driver would make the assessment unnecessarily difficult to set up,
especially on Windows.

The database requirement did not justify adding that environment dependency.

Changing the driver solved the actual setup problem without changing the
application's persistence architecture.

### Trade-off

The project gains another JavaScript dependency and uses a different SQLite
driver than originally proposed.

In return, setup is simpler and more portable while preserving SQLite +
Drizzle and the existing repository design.

---

## Decision 3 — Use reduced Clean Architecture instead of a full layered implementation

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
substantial boilerplate and make the implementation harder to review.

### Decision

Keep the useful architectural boundaries but implement them as a modular
monolith organized primarily by feature.

Backend dependency flow:

```text
Route
→ Controller
→ Service / Pipeline orchestration
→ Repository / Gemini adapter / FileStorageService
```

Responsibilities remain separated:

- Controller: HTTP concerns.
- Service: business rules and orchestration.
- Repository: persistence and conditional state transitions.
- Gemini adapter: provider-specific API behavior.
- FileStorageService: local durable filesystem persistence.
- Pipeline executor: step-specific generation behavior.

Additional abstractions are introduced only when a concrete requirement needs
them.

For example, Gemini integration uses small task-specific contracts such as:

```text
GeminiStyleAdapter
GeminiCharactersAdapter
GeminiPortraitAdapter
```

rather than a generic provider framework.

### Why I Overrode the AI Suggestion

A complete ports-and-adapters architecture was more complex than the
assessment required.

The important requirement was not the number of architectural layers. It was
maintaining clear boundaries so that:

- business behavior can be tested;
- Gemini can be mocked;
- persistence logic can be verified independently;
- HTTP concerns do not leak into generation logic.

The reduced structure provides those benefits without speculative
infrastructure.

### Trade-off

The implementation has less theoretical isolation than a complete Clean
Architecture implementation.

Some composition is performed directly in the application bootstrap rather
than through factories or a dependency-injection framework.

In return, the project has substantially less boilerplate and remains easier
to understand, implement, test, and review within the assessment timeframe.

---

## Decision 4 — Preserve the failed pipeline step instead of clearing its identity

**AI override #3**

### Context

During the Phase 4 pipeline design, Codex initially proposed clearing the
running execution fields after both successful and failed execution.

The existing project persistence model does not contain a separate
`failedStep` column.

If `runningStep` were cleared after failure, the system would lose the
identity of the exact step that should be explicitly retried.

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

Explicit stale recovery follows the same rule:

```text
RUNNING
→ explicit stale recovery
→ FAILED
```

while preserving the retryable step in `runningStep`.

Retry is permitted only when the requested step matches the preserved failed
step and its expected predecessor remains complete.

### Why I Overrode the AI Suggestion

Clearing `runningStep` on failure discarded information required by the retry
semantics.

Adding a separate `failedStep` column would also solve the problem, but it
would introduce another state field and migration for information the current
sequential pipeline can represent without it.

### Trade-off

`runningStep` now means:

```text
currently active step
or
currently retryable failed step
```

rather than strictly "a step executing at this exact moment."

That slightly broadens the field's semantics.

In return, the persistence model remains small and failed-step retry behavior
is unambiguous without introducing another project state field.

---

## Decision 5 — Checkpoint paid Gemini results at the smallest durable useful boundary

### Context

Once real Gemini generation was introduced, the pipeline gained several
failure windows where a provider call could succeed but a later local
operation could fail.

Examples include:

```text
Gemini STYLE succeeds
→ STYLE persists
→ final pipeline completion fails
```

```text
Gemini CHARACTERS succeeds
→ complete character set persists
→ final pipeline completion fails
```

and:

```text
portrait 0 succeeds and persists
→ portrait 1 fails
```

A naive retry strategy would rerun the entire step and repeat already successful
paid Gemini calls.

At the same time, blindly treating any existing database data as completed work
would weaken correctness because persisted data may be:

- partial;
- stale;
- inconsistent;
- unrelated to the current retry path;
- missing its durable filesystem artifact.

### Decision

Persist each paid generation result at the smallest boundary that represents a
complete durable unit for that type of output.

Different pipeline steps therefore use different checkpoint granularity.

### STYLE

STYLE is one logical text-generation result.

```text
Gemini
→ validate STYLE
→ persist STYLE
→ complete pipeline step
```

If the final pipeline completion transition is lost, a qualified failed-STYLE
retry may validate and reuse the persisted STYLE with zero additional Gemini
calls.

A non-null STYLE alone is not sufficient.

Checkpoint reuse requires the appropriate pre-acquisition retry context and a
valid persisted result.

### CHARACTERS

The generated character list is one logical structured result.

```text
Gemini
→ validate complete 1–2 character set
→ transactionally replace entire set
→ complete pipeline step
```

Individual characters are not checkpointed independently during CHARACTERS
generation.

The complete validated set is persisted atomically.

If persistence succeeds but final pipeline completion is lost, a qualified
CHARACTERS retry can validate the persisted complete set and make zero
additional Gemini calls.

Partial or incorrectly positioned rows are not accepted as checkpoints.

### PORTRAITS

Portraits are different because each character requires an independent paid
image-generation call.

Therefore each portrait is checkpointed immediately:

```text
generate portrait
→ write image file
→ conditional database DONE checkpoint
→ move to next character
```

A durable portrait requires:

```text
generationStatus = DONE
imagePath is non-null
referenced image file exists
```

On retry:

```text
durable portrait
→ skip
→ zero Gemini calls

incomplete portrait
→ generate
```

This permits partial progress:

```text
portrait 0 DONE
portrait 1 FAILED
```

to resume without regenerating portrait 0.

### ILLUSTRATIONS reuse durable portrait references

The final chapter illustration consumes the already persisted portrait JPEGs as
multimodal Gemini image references instead of relying only on character text or
on a provider interaction ID. This preserves the notebook requirement that the
scene reuse the established portraits while keeping resume behavior tied to
application-owned durable files.

Before the paid ILLUSTRATIONS call, the executor requires every chapter-linked
character to have a `DONE` portrait checkpoint, verifies the referenced JPEG
exists and is readable, and then supplies at most the server-bounded two
portrait images to Gemini. Missing or corrupt portrait references fail before
the provider call. A durable final illustration still follows the same
write-file-then-conditional-DONE checkpoint rule, so a lost terminal pipeline
completion can reuse the saved illustration without another paid call.

### Stale execution protection

A result may be checkpointed only while the request still owns the exact
project-level pipeline acquisition.

Paid-result persistence is conditionally guarded by values such as:

```text
projectId
userId
runningStep
stepState = RUNNING
exact stepStartedAt
```

and the relevant item ID where needed.

An old Gemini response returning after stale recovery therefore cannot become a
new durable checkpoint.

### Why I Challenged the Simpler Retry Strategy

The simplest implementation would rerun a failed step from the beginning.

That is easy to implement but unnecessarily expensive once a step contains
paid provider operations.

The opposite shortcut — "if some persisted output exists, skip Gemini" — is
also unsafe.

The final design distinguishes between:

```text
data exists
```

and:

```text
a validated durable checkpoint exists for this retry
```

### Trade-off

Checkpoint qualification makes retry logic more explicit and requires
additional validation against both database state and, for images, filesystem
state.

Multi-image generation also runs sequentially rather than in parallel.

In return:

- already paid work is not unnecessarily repeated;
- partial success survives later failure;
- retries remain explicit;
- stale responses cannot silently overwrite newer work;
- automated tests can verify exactly when a paid call is allowed.

This pattern is intentionally applied at different granularity depending on
the generated artifact instead of forcing every pipeline step into one generic
checkpoint abstraction.

---

## Decision 6 — Use a reusable Files API URI with stateless `generateContent` calls

### Context

The initial persistence model included an opaque Gemini interaction identifier,
which suggested that later steps might depend on provider-retained interaction
state.

That does not match the final pipeline design. Every downstream step can
reconstruct its complete input from application-owned durable results:

```text
STYLE         → persisted project style
CHARACTERS    → persisted character rows
PORTRAITS     → persisted JPEG files + per-character checkpoints
CHAPTERS      → persisted chapter row
ILLUSTRATIONS → persisted JPEG file + chapter checkpoint
```

The Gemini Files API already provides a reusable file URI for the source book,
so the book does not need a second provider object merely to represent context.

### Decision

Treat Gemini as a stateless generation dependency:

```text
Local persisted book.txt
→ Gemini Files API upload
→ persist geminiBookFileUri
→ models.generateContent(...)
```

Text and image generation use `models.generateContent()` without a
`previous_interaction_id` dependency. A later step depends on durable
application-owned outputs rather than on Gemini retaining the interaction that
produced them.

Examples:

```text
CHARACTERS
= persisted STYLE + Gemini book file URI

PORTRAITS
= persisted STYLE + persisted character prompt

CHAPTERS
= persisted STYLE + persisted characters + Gemini book file URI

ILLUSTRATIONS
= persisted STYLE + persisted chapter + persisted portrait JPEGs
```

The obsolete `geminiBookInteractionId` field is removed from the current schema.
No provider interaction/cache object is created for pipeline continuity.

### Remote-reference lifetime

The Gemini file URI is a provider-managed temporary resource, not durable
application storage:

```text
Local book.txt
= durable application source of truth

Gemini file URI
= reusable temporary provider reference
```

The application does not silently refresh or re-upload the remote reference
during an unrelated generation step. Reinitialization remains an explicit user
action if the provider reference can no longer be used.

### Why not provider-managed interaction state?

Using provider history would make retry and resume depend on a second source of
workflow state. The application already needs durable checkpoints for paid-call
control, partial recovery, local images, and deterministic ownership.

Keeping the model calls stateless gives the pipeline:

- explicit and inspectable inputs;
- deterministic retry boundaries;
- simpler unit tests;
- no provider-retention dependency;
- less coupling between workflow semantics and a Gemini API lifecycle.

The trade-off is that some persisted context, such as STYLE, character prompts,
or portrait images, is sent again when a downstream step needs it. That cost is
accepted in exchange for durable, application-owned workflow state.

### Concurrency

Book initialization and generation remain guarded by persisted execution state
and atomic SQLite acquisition. Only the caller that acquires the corresponding
operation may perform the paid provider call. This decision changes provider
transport, not the established retry or checkpoint semantics.

---

## Final decision set

The document intentionally stays limited to six highlighted decisions.

The current final candidates are:

```text
1. Cost-oriented Gemini models and paid-call control
2. Portable SQLite driver choice
3. Reduced Clean Architecture
4. Failed-step preservation and retry semantics
5. Durable paid-result checkpoint strategy
6. Reusable Gemini Files URI plus stateless generateContent calls
```

Later implementation phases should not automatically create additional
decisions.

If a future phase introduces a substantially stronger trade-off, it may replace
one of these entries during the final submission review.

The goal is to document engineering judgment, not to create one decision per
implementation phase.

---

## If I Had One More Day

I would add one mocked end-to-end integration test that drives a project through
all five pipeline steps and verifies the final persisted artifacts after a
simulated refresh or restart boundary.

The individual step, retry, recovery, ownership, storage, and frontend-state
tests already cover the important local behaviors well. One cross-step test
would add confidence that the contracts between STYLE, CHARACTERS, PORTRAITS,
CHAPTERS, and ILLUSTRATIONS stay compatible as the workflow evolves, without
adding production infrastructure or consuming Gemini quota.
