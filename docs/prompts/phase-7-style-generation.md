# Phase 7 — STYLE Generation

## Initial Prompt

Read the current repository and do not modify files yet.

We are starting Phase 7: STYLE generation.

Current pipeline:

STYLE
→ CHARACTERS
→ PORTRAITS
→ CHAPTERS
→ ILLUSTRATIONS

Current Gemini configuration:

- text model: `gemini-3.6-flash`
- image model: `gemini-3.1-flash-lite-image`

Phase 6 already prepares and persists a reusable Gemini Files API reference:

- `geminiBookFileUri`
- `geminiBookState = READY`

The local `book.txt` remains the durable source of truth.

Phase 7 is the first real pipeline generation step.

## Scope

Implement only the `STYLE` pipeline step.

The user explicitly triggers STYLE through the existing pipeline endpoint.

Expected high-level flow:

authenticated request
→ existing PipelineService acquisition
→ STYLE executor
→ require Gemini book reference READY
→ call Gemini text model once
→ request structured STYLE output
→ validate output
→ persist STYLE result
→ complete pipeline STYLE step

Do not implement:

- CHARACTERS;
- PORTRAITS;
- CHAPTERS;
- ILLUSTRATIONS;
- image generation;
- automatic Gemini retry;
- queues;
- workers;
- Redis;
- WebSockets;
- generic AI/provider frameworks.

Keep the reduced architecture:

Route
→ Controller
→ PipelineService
→ Step Executor
→ Gemini adapter / Repository

## Important integration requirement

Do not create a second independent execution-state machine for STYLE.

Phase 4 already owns pipeline execution state:

- `completedStep`
- `runningStep`
- `stepState`
- `stepStartedAt`
- `stepError`

Reuse that state machine.

The STYLE executor should run only after PipelineService successfully performs
the existing atomic step acquisition.

Only the successful pipeline acquirer may invoke Gemini.

Double-clicks, multiple tabs, refreshes, and concurrent HTTP requests must
therefore still result in at most one Gemini generation call.

## Gemini book reference

STYLE generation must use the persisted `geminiBookFileUri` prepared in
Phase 6.

Do not upload the book again during STYLE.

Do not read and resend the entire local book if the valid Gemini file reference
is available.

If the project does not have:

`geminiBookState = READY`

and a non-null:

`geminiBookFileUri`

STYLE must fail safely without making a Gemini generation call.

Do not automatically initialize or re-upload the book from the STYLE executor.

Book initialization remains an explicit user action.

## Gemini integration

Use:

`gemini-3.6-flash`

through the existing Gemini integration boundary where practical.

Do not build a generic provider framework.

Introduce only the minimum adapter/service surface required for STYLE text
generation.

Automated tests must inject a fake Gemini adapter and consume zero Gemini
quota.

Real Gemini must only be exercised manually and intentionally.

## Structured output

STYLE generation must request structured JSON rather than relying on
free-form text parsing.

Before implementation, inspect the existing schema and determine the minimum
STYLE result required by the assessment.

Prefer a small explicit Zod schema.

The response must be validated before persistence.

Do not persist invalid or partially parsed model output.

Do not silently repair malformed Gemini output with another paid model call.

No automatic retry.

## Persistence

Inspect the existing database schema before proposing changes.

Determine whether the existing STYLE-related persistence fields/tables are
sufficient.

Persist only the structured STYLE result required by later phases.

Do not store:

- raw Gemini responses unless genuinely required;
- prompts in SQLite;
- API keys;
- duplicate copies of the book;
- speculative provider metadata.

The generated STYLE result must survive backend restart.

## Failure behavior

If Gemini generation fails:

- PipelineService must preserve completed work;
- STYLE remains the retryable failed step according to the existing Phase 4
  state machine;
- persist only a safe application error;
- do not automatically retry;
- do not advance `completedStep`.

If Gemini succeeds but STYLE persistence fails:

- the pipeline must not report STYLE as completed;
- surface the persistence failure;
- preserve a recoverable state according to the existing pipeline semantics.

Review this interaction carefully because a paid Gemini call may already have
occurred.

Do not introduce another Gemini call to recover from persistence failure.

## Cost control

The design must minimize paid Gemini usage.

Specifically:

- exactly one text-generation call for a normal STYLE execution;
- zero Gemini calls when pipeline acquisition fails;
- zero Gemini calls when the book reference is not READY;
- zero automatic retries;
- zero Gemini calls in automated tests;
- completed STYLE cannot be regenerated through the normal pipeline endpoint.

## Prompt management

Inspect:

- `docs/prompts/`
- `AGENTS.md`
- existing assessment-provided prompt/reference files

Determine where the production STYLE prompt should live.

Do not mix the development/Codex prompt documentation with the runtime Gemini
prompt unless there is a clear reason.

The runtime STYLE prompt should be versionable and easy to review.

## Tests

At minimum propose tests for:

1. STYLE can execute only as the first pipeline step.
2. Successful STYLE generation makes exactly one fake Gemini call.
3. Gemini receives the persisted book file URI.
4. Structured STYLE output is validated.
5. Valid STYLE is persisted before pipeline completion.
6. Invalid Gemini output does not persist STYLE.
7. Invalid Gemini output causes the pipeline step to fail.
8. Gemini provider failure causes STYLE to fail without automatic retry.
9. Missing/non-READY Gemini book reference causes zero generation calls.
10. Concurrent STYLE requests still result in one Gemini call.
11. Completed STYLE cannot run again.
12. Failed STYLE can be explicitly retried without rerunning earlier work.
13. User B cannot run STYLE for User A's project.
14. Automated tests use fake Gemini and consume zero quota.

Also inspect the difficult case:

Gemini succeeds
→ STYLE persistence fails

Explain what state should remain and how explicit retry should behave without
pretending the paid call never happened.

## Before implementation

First:

1. inspect the current repository;
2. explain the minimal Phase 7 architecture;
3. identify the exact STYLE structured-output schema;
4. identify the exact persistence model;
5. explain how the existing PipelineService will invoke the STYLE executor;
6. explain how `geminiBookFileUri` is supplied to Gemini;
7. explain validation and persistence ordering;
8. analyze the Gemini-success / DB-failure case;
9. identify concurrency and cost risks;
10. list exact files expected to be added or modified;
11. list the tests to implement;
12. identify any real engineering decision that might eventually justify
    replacing one of the existing six entries in `DECISIONS.md`.

Do not modify files until I approve the plan.

Do not commit or push.

---

## Review

I approve the Phase 7 direction with these final clarifications.

1. Keep STYLE output minimal.

Use the notebook/reference behavior as the source of truth.

Prefer one validated reusable art-direction string:

```ts
{
  style: string
}
```

Do not invent palette/lighting/mood/etc. fields unless the assessment or
reference implementation explicitly requires them.

2. Keep the production prompt versioned in source code, not `docs/prompts/`.

Prefer:

```text
apps/api/src/services/gemini/prompts/style.prompt.ts
```

`docs/prompts/` remains only for development/Codex workflow artifacts.

3. Reuse the persisted Gemini Files API URI directly.

STYLE must require:

- `geminiBookState === READY`
- non-null `geminiBookFileUri`

If either is missing, fail before the Gemini adapter call.

Do not upload or re-read the full book during STYLE.

4. Preserve the durable STYLE checkpoint behavior.

If Gemini succeeds and STYLE persistence succeeds but PipelineService final
completion fails, retry must not make another Gemini call.

However, do not blindly treat any non-null `projects.style` as a generated
checkpoint.

Only skip Gemini when the current STYLE execution is a retry/recovery path
where the persisted STYLE can safely be treated as the result of the prior
paid execution.

Explain exactly how this is determined from existing pipeline state.

5. Verify the assessment/reference regarding optional user-supplied STYLE.

If user-provided style is actually required:

- validate and persist it;
- make zero Gemini calls;
- use Gemini only when no style is supplied.

If the assessment does not require manual style input, do not add it.

6. Use exactly one normal Gemini text-generation call for AI STYLE.

Use structured JSON output with the strict Zod schema and the persisted file
URI.

Do not persist raw provider responses or interaction IDs.

7. Add tests for:

- valid STYLE → one Gemini call;
- non-ready book → zero Gemini calls;
- invalid structured output → no style persisted;
- STYLE persistence failure → pipeline FAILED and retryable;
- final pipeline completion loss after STYLE persisted → stale recovery + retry
  completes with zero additional Gemini calls;
- concurrent STYLE requests → one Gemini call;
- ownership;
- manual style path with zero Gemini calls only if the assessment requires it.

Do not modify files until you verify the optional manual-style requirement and
show the revised executor/retry design.

Do not commit or push.

---

## Review 2

I approve the revised Phase 7 design.

Implement it with these final details:

1. Manual STYLE validation must follow the notebook requirement, not an
   invented minimum length.

If the notebook only requires a non-empty user-supplied style, use a small
manual string schema such as:

```ts
z.string().trim().min(1).max(1500)
```

Keep the stricter structured AI output schema separately if useful.

Do not reject a valid short manual style like `"watercolor"` unless the source
requirement explicitly requires a longer description.

2. Keep the checkpoint retry rule exactly scoped.

A persisted STYLE may skip Gemini only when the pre-acquisition pipeline
snapshot represents an explicit retry/recovery of STYLE and the persisted
value validates.

Do not use a blanket:

```ts
style != null
```

means done rule.

3. Derive `isRetry` from the pre-acquisition PipelineService snapshot and pass
it through the executor context.

Do not let the executor infer retry state from unrelated database fields alone.

4. A style request body is valid only for the STYLE step.

Reject a style body on:

- `CHARACTERS`
- `PORTRAITS`
- `CHAPTERS`
- `ILLUSTRATIONS`

before execution.

5. Preserve the manual path:

```text
valid manual style
→ atomic STYLE acquisition
→ validate
→ persist
→ zero Gemini calls
→ pipeline completion
```

Blank/omitted manual style:

```text
→ AI path
```

6. Keep the runtime prompt at:

```text
apps/api/src/services/gemini/prompts/style.prompt.ts
```

Keep `docs/prompts/` for Codex/development workflow artifacts only.

7. Implement test-first and include:

- valid manual short style → zero Gemini calls;
- blank/omitted style → AI path;
- non-STYLE request carrying style body → 400;
- AI valid output → one Gemini call;
- persisted Gemini file URI is used;
- invalid AI output → no persistence;
- non-READY book → zero Gemini calls;
- provider failure → no auto retry;
- concurrent STYLE requests → one Gemini call;
- completed STYLE cannot rerun;
- explicit failed retry works;
- lost final completion + persisted STYLE checkpoint → retry completes with
  zero additional Gemini calls;
- ownership.

Do not add migrations unless implementation proves one is required.

Before finishing run:

- API typecheck
- API tests
- API build
- root npm test
- git diff --check

Do not commit or push.

---

## Outcome

Phase 7 STYLE generation was implemented without requiring a database
migration.

The implementation supports both STYLE paths required by the assessment.

### Manual STYLE

A user may provide an optional STYLE through the existing STYLE pipeline
request.

A valid non-empty manual STYLE:

```text
authenticated request
→ atomic STYLE acquisition
→ validate manual STYLE
→ conditionally persist projects.style
→ zero Gemini calls
→ complete STYLE
```

Short valid values such as:

```text
watercolor
```

are accepted.

A blank or omitted STYLE does not use the manual path and instead enters the
AI-generation path.

### AI-generated STYLE

When no non-empty manual STYLE is supplied:

```text
authenticated request
→ atomic STYLE acquisition
→ StyleStepExecutor
→ require geminiBookState = READY
→ require geminiBookFileUri
→ one Gemini text-generation call
→ structured JSON validation
→ conditional STYLE persistence
→ pipeline completion
```

The persisted Gemini Files API URI from Phase 6 is reused directly.

The STYLE executor does not:

- upload the book again;
- read and resend the full local book;
- initialize Gemini book context automatically;
- automatically retry Gemini;
- generate any images.

### Structured output

AI-generated STYLE uses a strict structured result:

```ts
{
  style: string
}
```

The generated value is validated before persistence.

Invalid JSON or schema-invalid Gemini output is not persisted.

Manual STYLE validation remains intentionally less restrictive than generated
STYLE validation so valid short user choices are not rejected.

### Runtime prompt

The production Gemini prompt is stored separately from development/Codex
prompt documentation:

```text
apps/api/src/services/gemini/prompts/style.prompt.ts
```

Development prompts remain under:

```text
docs/prompts/
```

### Concurrency

STYLE does not introduce another execution-state machine.

The Phase 4 pipeline state remains the single owner of execution:

- `completedStep`
- `runningStep`
- `stepState`
- `stepStartedAt`
- `stepError`

Only a request that successfully performs the existing atomic pipeline
acquisition may execute the STYLE executor.

Therefore concurrent requests, multiple tabs, double-clicks, and refreshes do
not independently invoke Gemini.

### STYLE persistence guard

STYLE persistence is conditional on the exact acquired execution.

The persistence mutation is scoped by:

- `projectId`;
- `userId`;
- `runningStep = STYLE`;
- `stepState = RUNNING`;
- matching acquisition timestamp.

This prevents a stale execution from persisting a STYLE result into a newer
pipeline execution.

### Durable STYLE checkpoint

A validated persisted STYLE acts as a durable checkpoint only in a narrowly
defined retry path.

The executor does not use a blanket:

```ts
projects.style != null
```

rule.

`PipelineService` derives retry state from the pre-acquisition project snapshot
and passes `isRetry` to the executor.

A persisted STYLE can skip Gemini only when the current execution is a valid
explicit retry of the failed STYLE step and the persisted STYLE itself
validates.

This handles the important paid-call failure window:

```text
Gemini succeeds
→ STYLE validates
→ STYLE persistence succeeds
→ final pipeline completion transition is lost
→ request returns persistence-transition error
→ pipeline remains RUNNING
→ explicit stale recovery
→ STYLE becomes FAILED
→ explicit retry
→ persisted STYLE checkpoint validates
→ zero additional Gemini calls
→ retry final pipeline completion
```

If Gemini succeeds but STYLE persistence itself fails, no durable STYLE
checkpoint exists.

The pipeline becomes failed and remains explicitly retryable. A later explicit
retry may therefore require another Gemini call because there is no safely
persisted result to reuse.

### Failure behavior

The implementation preserves the Phase 4 failure semantics.

Provider failures, invalid generated output, and STYLE persistence failures:

- do not advance `completedStep`;
- leave STYLE retryable;
- do not automatically retry Gemini;
- expose only safe application errors.

If STYLE persistence succeeds but the final pipeline completion transition is
lost, the service does not blindly overwrite the operation as FAILED.

The operation remains RUNNING so explicit stale recovery can resolve it.

### Cost-control behavior

The implemented STYLE step provides:

- zero Gemini calls for manual STYLE;
- one Gemini text-generation call for a normal AI STYLE execution;
- zero Gemini calls when atomic acquisition fails;
- zero Gemini calls when the Gemini book reference is not READY;
- zero automatic Gemini retries;
- zero Gemini calls in automated tests;
- zero additional Gemini calls when a valid persisted STYLE checkpoint is
  reused after explicit recovery;
- no normal regeneration of an already completed STYLE step.

### Changed files

Phase 7 added or modified:

- `apps/api/src/app.ts`
- `apps/api/src/modules/pipeline/pipeline.controller.ts`
- `apps/api/src/modules/pipeline/pipeline.service.ts`
- `apps/api/src/modules/pipeline/pipeline.controller.test.ts`
- `apps/api/src/modules/pipeline/style/style.schema.ts`
- `apps/api/src/modules/pipeline/style/style.repository.ts`
- `apps/api/src/modules/pipeline/style/style-step.executor.ts`
- `apps/api/src/modules/pipeline/style/style-step.executor.test.ts`
- `apps/api/src/modules/pipeline/style/style-pipeline.service.test.ts`
- `apps/api/src/services/gemini/gemini-style-adapter.ts`
- `apps/api/src/services/gemini/google-gemini-style-adapter.ts`
- `apps/api/src/services/gemini/prompts/style.prompt.ts`
- `docs/plan.md`

No database migration was required.

### Verification

The Phase 7 implementation passed:

```text
API typecheck
API tests: 10 files, 44 tests
API build
root npm test
git diff --check
```

Automated tests use fake Gemini adapters and consume zero Gemini quota.

The test coverage includes:

- manual STYLE;
- short manual STYLE;
- blank/omitted STYLE selecting the AI path;
- non-STYLE request carrying STYLE input rejection;
- valid AI structured output;
- exactly one Gemini call;
- persisted Gemini Files API URI use;
- invalid structured output;
- non-READY Gemini book reference;
- provider failure;
- STYLE persistence failure;
- concurrent STYLE requests;
- completed STYLE rejection;
- failed STYLE retry;
- ownership;
- lost final pipeline completion;
- stale recovery;
- persisted STYLE checkpoint reuse without another paid Gemini call.

No commit or push was performed by the implementation agent.