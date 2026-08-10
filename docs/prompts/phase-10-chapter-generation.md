# Phase 10 — Chapter Generation

## Objective

Implement the `CHAPTERS` pipeline step.

Phase 10 generates exactly one chapter/opening-scene definition from the
persisted book reference, STYLE, and persisted characters.

The generated chapter is a durable checkpoint for the later illustration
phase.

Phase 10 does not generate an illustration.

---

## Scope

Phase 10 must:

- execute through the existing pipeline endpoint;
- preserve the existing sequential pipeline state machine;
- require authenticated project ownership;
- require `PORTRAITS` to be completed before `CHAPTERS`;
- reuse the persisted Gemini Files API book URI;
- reuse the persisted STYLE;
- reuse the persisted character definitions in deterministic position order;
- generate exactly one chapter/opening-scene definition;
- persist the generated chapter transactionally;
- associate the chapter with the current persisted characters;
- expose safe chapter information through project detail;
- support explicit retry;
- prevent duplicate Gemini calls from concurrent pipeline requests;
- support durable checkpoint reuse if chapter persistence succeeded but the
  final pipeline completion transition was lost;
- use fake Gemini adapters in automated tests.

Phase 10 must not:

- generate chapter illustrations;
- generate new characters;
- regenerate portraits;
- upload the book again;
- read portrait image bytes for chapter generation;
- expose filesystem paths;
- expose `characterIdsJson`;
- expose Gemini identifiers;
- automatically retry Gemini;
- automatically reinitialize expired Gemini file references;
- add queues;
- add workers;
- add Redis;
- add WebSockets;
- add a generic provider framework;
- add chapter CRUD endpoints;
- commit or push automatically.

---

# Existing Architecture

Continue using the reduced modular architecture:

```text
Route
→ Controller
→ PipelineService
→ PipelineStepExecutor
→ ChaptersStepExecutor
→ ChaptersRepository / GeminiChapterAdapter
```

The existing pipeline endpoint remains the public entry point.

No new chapter-specific route or controller is required.

Expected request:

```text
POST /api/projects/:projectId/pipeline/CHAPTERS
```

The existing authenticated pipeline flow remains responsible for:

- session validation;
- project ownership;
- pipeline ordering;
- atomic step acquisition;
- failure handling;
- final step completion;
- stale recovery.

`PipelineService` remains the sole owner of pipeline execution state.

---

# Reference Behavior

The application reference produces one chapter/opening-scene card after the
portrait stage.

The card contains:

- a displayed chapter/scene title;
- an illustration prompt;
- an illustration placeholder that will be filled in Phase 11.

The reference does not justify adding separate chapter prose, body text,
summary, editable content, or additional chapter metadata.

Therefore Phase 10 should keep the generated contract minimal.

---

# Structured Chapter Contract

Use one strict logical chapter object:

```ts
{
  chapter: {
    name: string
    prompt: string
  }
}
```

The schema should be equivalent to:

```ts
z.object({
  chapter: z.object({
    name: z.string().trim().min(1).max(200),
    prompt: z.string().trim().min(1).max(5000),
  }).strict(),
}).strict()
```

Do not use an array merely to enforce a maximum of one chapter.

If Gemini returns:

- an array;
- multiple chapter objects;
- malformed JSON;
- missing fields;
- empty values;
- unexpected fields;
- values outside the configured bounds;

the complete result must be rejected before persistence.

No partial chapter data may be persisted.

---

# Persisted Chapter Model

Use the existing `chapters` table.

The persisted chapter uses:

```text
id
projectId
name
prompt
characterIdsJson
imagePath
generationStatus
generationError
position
createdAt
updatedAt
```

For Phase 10, the generated chapter must be initialized as:

```text
position = 0

imagePath = null
generationStatus = PENDING
generationError = null
```

The illustration fields are intentionally initialized but not generated.

They are reserved for Phase 11.

---

# Exactly One Chapter Per Project

The existing:

```text
UNIQUE(project_id, position)
```

does not by itself limit a project to one chapter because different positions
could still be inserted.

Phase 10 therefore adds a database invariant:

```sql
CHECK(position = 0)
```

Together:

```text
CHECK(position = 0)

+

UNIQUE(project_id, position)
```

enforce at most one chapter per project.

---

# Migration Requirements

Generate one Drizzle migration that safely rebuilds `chapters` with the new
position constraint.

The migration must preserve all existing chapter fields and behavior,
including:

```text
id
project_id
name
prompt
character_ids_json
image_path
generation_status
generation_error
position
created_at
updated_at
```

It must also preserve the project foreign key:

```text
project_id
→ projects(id)
→ ON DELETE CASCADE
```

and recreate the existing indexes:

```text
chapters_project_id_idx

chapters_project_position_unique
```

The second index must remain unique.

Do not remove or alter the illustration-related fields required by Phase 11.

---

# Migration Verification

Add focused real SQLite verification.

The tests must prove:

```text
existing valid position-0 chapter
→ survives migration

position = 0
→ accepted

position = 1
→ rejected

second position-0 chapter for the same project
→ rejected
```

Also inspect SQLite metadata after migration.

Verify:

```text
PRAGMA foreign_key_list(chapters)
```

proves:

```text
project_id
→ projects(id)
→ ON DELETE CASCADE
```

Verify:

```text
PRAGMA index_list(chapters)
```

proves both indexes exist:

```text
chapters_project_id_idx

chapters_project_position_unique
```

and that:

```text
chapters_project_position_unique
```

remains a unique index.

---

# CHAPTERS Prerequisites

Before making a Gemini generation call, the executor must verify the persisted
owned project state.

The pipeline must already satisfy:

```text
completedStep === PORTRAITS
```

The executor must additionally require:

## STYLE

A valid persisted STYLE must exist.

The STYLE must pass the existing STYLE validation rules.

---

## Characters

There must be one or two valid persisted characters.

Characters must be loaded in deterministic position order.

Valid positions are:

```text
[0]
```

or:

```text
[0, 1]
```

Missing, duplicate, invalid, or non-contiguous character positions must reject
generation.

---

## Gemini Book Reference

The project must have:

```text
geminiBookState === READY
```

and:

```text
geminiBookFileUri !== null
```

If the book reference is missing or not READY:

- do not call Gemini;
- fail the acquired `CHAPTERS` step safely.

Phase 10 must not:

- read and upload `book.txt` again;
- silently repair the Gemini reference;
- silently reinitialize an expired reference.

The local book remains durable application data.

Gemini Files API references remain temporary provider resources.

Provider-expiration handling requires explicit reinitialization through the
existing Phase 6 behavior.

---

# Gemini Input

The chapter adapter receives only the minimum context justified by this phase.

Use an interface equivalent to:

```ts
export interface GeminiChapterAdapter {
  generateChapter(input: {
    bookFileUri: string
    style: string
    characters: Array<{
      name: string
      prompt: string
    }>
  }): Promise<unknown>
}
```

Do not provide:

```text
character database IDs
portrait image bytes
portrait image paths
local book path
raw local book text
Gemini API key
project filesystem paths
```

Character database IDs remain server-owned persistence information.

---

# Character Ordering

Characters must be supplied to Gemini in deterministic persisted position
order.

For example:

```text
position 0
position 1
```

must become:

```ts
[
  {
    name: character0.name,
    prompt: character0.prompt,
  },
  {
    name: character1.name,
    prompt: character1.prompt,
  },
]
```

Do not rely on unspecified database ordering.

---

# characterIdsJson

Gemini must not generate database IDs.

After successful structured-output validation, the server derives the
character IDs from the current owned persisted characters.

For example:

```ts
const characterIds = characters.map((character) => character.id)
```

Then persist:

```ts
characterIdsJson = JSON.stringify(characterIds)
```

The order must match character position order.

For:

```text
character A → position 0 → id A
character B → position 1 → id B
```

persist:

```json
["id-A", "id-B"]
```

not:

```json
["id-B", "id-A"]
```

---

# Runtime Gemini Prompt

The production prompt belongs at:

```text
apps/api/src/services/gemini/prompts/chapter.prompt.ts
```

Do not place the production runtime prompt under:

```text
docs/prompts/
```

because that directory contains development/Codex workflow prompts.

The runtime prompt should instruct Gemini to:

- use the attached book;
- respect the persisted STYLE;
- use the supplied character descriptions;
- generate exactly one opening scene;
- produce a concise scene/chapter title;
- produce an illustration-ready prompt;
- preserve character consistency;
- avoid inventing database identifiers;
- return only the required structured result.

The runtime prompt must not ask for:

- multiple chapters;
- database IDs;
- image generation;
- portrait generation;
- chapter CRUD metadata.

---

# Gemini Adapter

Add a small task-specific adapter:

```text
apps/api/src/services/gemini/gemini-chapter-adapter.ts
```

and the concrete Google implementation:

```text
apps/api/src/services/gemini/google-gemini-chapter-adapter.ts
```

Use the configured text model:

```text
gemini-3.6-flash
```

Follow the existing Gemini text-generation integration pattern already used by
the project.

Use the reusable Files API URI as a `text/plain` document input.

Use structured JSON response formatting.

Parse and validate the returned output before persistence.

Do not introduce:

- another Gemini client abstraction hierarchy;
- a generic LLM provider framework;
- automatic retry;
- fallback models.

Automated tests must inject a fake adapter.

No automated test may consume Gemini quota.

---

# Normal Execution Flow

The normal successful flow is:

```text
authenticated pipeline request
        ↓
PipelineService verifies ownership
        ↓
verify CHAPTERS is the next valid step
        ↓
atomic CHAPTERS acquisition
        ↓
PipelineStepExecutor dispatches CHAPTERS
        ↓
ChaptersStepExecutor loads owned persisted state
        ↓
validate STYLE
        ↓
validate characters
        ↓
validate READY Gemini book URI
        ↓
one Gemini text call
        ↓
parse structured JSON
        ↓
validate strict chapter schema
        ↓
derive ordered character IDs server-side
        ↓
transactionally replace chapter
        ↓
executor returns
        ↓
PipelineService completeStep()
        ↓
CHAPTERS completed
```

---

# Pipeline Concurrency

Do not introduce a separate in-memory lock.

The existing pipeline acquisition remains the primary concurrency guard.

Two concurrent requests must not both call Gemini.

Conceptually:

```text
Request A ─┐
           ├─ atomic pipeline acquisition
Request B ─┘
              ↓
        exactly one winner
              ↓
        exactly one Gemini call
```

The losing request must not invoke the chapter adapter.

Retain the existing Phase 4 conditional-acquisition behavior and tests.

---

# Transactional Chapter Persistence

Chapter persistence must protect against a stale Gemini result.

The chapter replacement operation must execute in one SQLite transaction.

Inside that transaction:

```text
verify exact owned acquired CHAPTERS run
        ↓
delete current chapter set
        ↓
insert validated chapter at position 0
        ↓
commit
```

The acquired-run guard must match:

```text
projectId
userId
runningStep = CHAPTERS
stepState = RUNNING
stepStartedAt = exact acquisition timestamp
```

Only after that guard succeeds may existing chapter rows be replaced.

A stale Gemini response must never be able to persist after:

- stale recovery;
- another pipeline state transition;
- ownership mismatch;
- acquisition replacement.

---

# Atomic Replacement

The chapter repository operation should conceptually behave like:

```text
BEGIN

verify acquired run

if guard fails:
    ROLLBACK
    return false

delete existing project chapters

insert one validated position-0 chapter

COMMIT
```

If deletion or insertion fails:

```text
ROLLBACK
```

The old valid chapter set must not be partially destroyed.

---

# Normal Failure Behavior

The following failures occur after pipeline acquisition:

- invalid STYLE;
- missing characters;
- invalid character ordering;
- missing READY book reference;
- provider error;
- invalid Gemini JSON;
- invalid structured output;
- chapter persistence failure.

These must use the existing pipeline failure behavior.

The pipeline remains retryable:

```text
completedStep = PORTRAITS
runningStep = CHAPTERS
stepState = FAILED
stepStartedAt = null
stepError = safe error
```

No automatic retry occurs.

The user must explicitly retry.

---

# Gemini Success Followed by Chapter Persistence Failure

If:

```text
Gemini succeeds
```

but:

```text
chapter persistence fails
```

there is no durable generated-result checkpoint.

Therefore:

```text
CHAPTERS → FAILED
```

An explicit retry may require another paid Gemini call.

This is acceptable because no validated durable result exists that can safely
be reused.

Do not invent temporary provider-response persistence merely to avoid this
case.

---

# Lost Final Pipeline Completion

A different failure exists when:

```text
Gemini succeeds
        ↓
chapter persists successfully
        ↓
PipelineService.completeStep() fails
```

The validated generated result already exists durably.

The service must not:

- delete the chapter;
- report successful completion;
- blindly overwrite the pipeline as FAILED.

The request returns the existing persistence-transition `500`.

The pipeline remains:

```text
runningStep = CHAPTERS
stepState = RUNNING
stepStartedAt = original acquisition timestamp
```

This allows explicit stale recovery.

---

# Explicit Stale Recovery

The existing stale recovery mechanism remains responsible for recovering the
lost terminal transition.

After the configured stale threshold:

```text
RUNNING CHAPTERS
→ explicit stale recovery
→ FAILED CHAPTERS
```

No Gemini call occurs during recovery.

A later explicit retry may qualify the persisted chapter as a durable
checkpoint.

---

# Durable Chapter Retry Checkpoint

A persisted chapter must not automatically imply that `CHAPTERS` is complete.

Checkpoint reuse is allowed only during a qualified explicit retry.

The retry context supplied by `PipelineService` must prove that the
pre-acquisition state represented a failed `CHAPTERS` execution.

At minimum require:

```text
isRetry === true
previous completedStep === PORTRAITS
retrying step === CHAPTERS
```

Then validate the persisted result.

Exactly one chapter must exist.

It must satisfy:

```text
position === 0

valid name

valid prompt

generationStatus === PENDING

generationError === null

imagePath === null
```

Its `characterIdsJson` must also match the current valid character set exactly.

Only then may Gemini be skipped.

---

# characterIdsJson Checkpoint Validation

Do not compare arbitrary raw JSON strings.

Parse:

```ts
JSON.parse(chapter.characterIdsJson)
```

and validate the parsed result.

It must be:

```text
an array
```

containing only:

```text
string IDs
```

The number of IDs must exactly equal the current valid persisted character
count.

The IDs must exactly match the current characters in deterministic position
order.

For current characters:

```text
[
  { id: "character-a", position: 0 },
  { id: "character-b", position: 1 }
]
```

the only valid checkpoint association is:

```json
["character-a", "character-b"]
```

These are invalid:

```json
["character-b", "character-a"]
```

```json
["character-a"]
```

```json
["character-a", "character-b", "character-c"]
```

```json
["character-a", "character-a"]
```

Malformed JSON is also invalid.

Any invalid association means the persisted chapter is not a reusable
checkpoint.

---

# Qualified Checkpoint Retry Flow

For the lost-final-completion case:

```text
original CHAPTERS run
        ↓
Gemini succeeds
        ↓
chapter persists
        ↓
completeStep() lost/fails
        ↓
pipeline remains RUNNING
        ↓
explicit stale recovery
        ↓
pipeline becomes FAILED
        ↓
explicit CHAPTERS retry
        ↓
PipelineService passes retry context
        ↓
executor validates persisted chapter
        ↓
character IDs exactly match current characters
        ↓
zero Gemini calls
        ↓
executor returns successfully
        ↓
PipelineService retries completeStep()
        ↓
CHAPTERS completed
```

This behavior prevents unnecessary duplicate paid model calls.

---

# Invalid Checkpoint

The following must not qualify as reusable checkpoints:

- no chapter;
- multiple chapters;
- position other than zero;
- invalid name;
- invalid prompt;
- malformed `characterIdsJson`;
- non-string IDs;
- wrong number of character IDs;
- duplicate IDs;
- reordered IDs;
- stale character IDs;
- `generationStatus` other than `PENDING`;
- non-null `generationError`;
- non-null `imagePath`;
- normal non-retry execution;
- retry context for another pipeline step.

When checkpoint validation fails, normal explicit retry behavior applies.

If all generation prerequisites are valid, the retry may make one new Gemini
call.

---

# Project Detail DTO

Extend owned project detail with safe chapter information.

The response may expose:

```ts
{
  chapters: [
    {
      id: string
      name: string
      prompt: string
      generationStatus: string
      generationError: string | null
      position: number
    }
  ]
}
```

Do not expose:

```text
characterIdsJson
imagePath
bookFilePath
geminiBookFileUri
geminiBookInteractionId
Gemini provider metadata
```

Do not expose an illustration URL yet.

Phase 10 cannot produce a chapter illustration, so an illustration URL should
be introduced only when Phase 11 creates durable chapter images.

---

# Ownership

All project and chapter operations remain user-scoped.

A known project ID must never allow another user to:

- generate its chapter;
- replace its chapter;
- inspect internal chapter data;
- reuse its Gemini book URI;
- mutate its pipeline state.

The pipeline service continues to return:

```text
404
```

for a non-owned project rather than revealing its existence.

The chapter transactional persistence guard must also independently include
`userId`.

Do not rely solely on the earlier HTTP ownership check.

---

# Expected Files

## Add

```text
apps/api/src/modules/pipeline/chapters/chapters.schema.ts

apps/api/src/modules/pipeline/chapters/chapters.repository.ts

apps/api/src/modules/pipeline/chapters/chapters-step.executor.ts

apps/api/src/modules/pipeline/chapters/chapters.repository.test.ts

apps/api/src/modules/pipeline/chapters/chapters-step.executor.test.ts

apps/api/src/services/gemini/gemini-chapter-adapter.ts

apps/api/src/services/gemini/google-gemini-chapter-adapter.ts

apps/api/src/services/gemini/prompts/chapter.prompt.ts
```

Add one generated Drizzle migration for:

```text
CHECK(chapters.position = 0)
```

including the associated Drizzle migration metadata/snapshot files when
generated by the existing migration workflow.

---

## Modify

Expected modifications include:

```text
apps/api/src/db/schema.ts

apps/api/src/modules/pipeline/pipeline-step.executor.ts

apps/api/src/app.ts

apps/api/src/modules/projects/project.repository.ts

apps/api/src/modules/projects/project.service.ts

relevant project tests

relevant pipeline tests

docs/plan.md
```

Modify other existing files only when concretely required by the implementation.

---

# No New Route

Do not create:

```text
chapter.routes.ts
chapter.controller.ts
```

Phase 10 is a pipeline step.

Use the existing pipeline endpoint.

---

# Test Plan

Implement Phase 10 test-first.

All Gemini behavior in automated tests must use fake adapters.

---

## 1. Normal Generation

Verify:

```text
valid PORTRAITS predecessor
+ valid STYLE
+ valid characters
+ READY book reference
→ one Gemini call
→ one chapter persisted
→ CHAPTERS completes
```

---

## 2. Structured Input to Gemini

Verify the fake adapter receives:

```text
persisted Gemini book URI
persisted STYLE
persisted character names/prompts
```

in deterministic position order.

Verify it does not receive:

```text
portrait bytes
portrait paths
character database IDs
local book path
```

---

## 3. Exactly One Gemini Call

One normal successful `CHAPTERS` execution must call the fake adapter exactly
once.

---

## 4. Strict Structured Output

Reject:

```text
malformed JSON
array output
multiple chapter structures
missing chapter
missing name
missing prompt
empty values
unexpected fields
out-of-bound values
```

No invalid output may persist chapter data.

---

## 5. Missing STYLE

A missing or invalid STYLE must:

```text
make zero Gemini calls
persist no new chapter
fail CHAPTERS safely
```

---

## 6. Missing Characters

Zero valid characters must:

```text
make zero Gemini calls
persist no chapter
```

---

## 7. Invalid Character Set

Reject invalid persisted character state such as:

```text
position 1 without position 0
duplicate/invalid position state
more than two valid characters where possible
```

before Gemini.

---

## 8. Missing Gemini Book Reference

If:

```text
geminiBookState !== READY
```

or:

```text
geminiBookFileUri === null
```

then:

```text
zero Gemini calls
```

and the acquired step fails safely.

---

## 9. Server-Derived Character IDs

Verify Gemini never supplies database IDs.

After generation, verify persisted:

```text
characterIdsJson
```

contains the exact current character IDs in position order.

---

## 10. Transactional Replacement

Using real SQLite/Drizzle, verify:

```text
old valid chapter exists
        ↓
new acquired CHAPTERS run
        ↓
replacement succeeds
        ↓
exactly one new chapter remains
```

Verify:

```text
position === 0
generationStatus === PENDING
generationError === null
imagePath === null
```

---

## 11. Transaction Rollback

Force insertion/replacement failure.

Verify:

```text
transaction rolls back
```

and existing chapter data is not partially deleted/replaced.

---

## 12. Stale Acquired-Run Guard

Attempt chapter persistence with:

```text
wrong userId
wrong projectId
wrong runningStep
wrong stepState
wrong acquisition timestamp
```

where applicable.

Verify:

```text
replacement rejected
existing chapter unchanged
```

---

## 13. Concurrency

Issue two concurrent `CHAPTERS` requests from the same valid project snapshot.

Verify:

```text
exactly one pipeline acquisition succeeds
exactly one Gemini call occurs
```

---

## 14. Completed CHAPTERS

A project that already completed `CHAPTERS` must not execute it again.

Verify:

```text
zero Gemini calls
```

---

## 15. Explicit Failed Retry

A valid failed `CHAPTERS` step may be explicitly retried.

It must not rerun previous pipeline steps.

---

## 16. Lost Final Completion

Simulate:

```text
Gemini succeeds
chapter persists
PipelineService.completeStep() returns false
```

Verify:

```text
request returns expected 500
chapter remains persisted
pipeline remains RUNNING
original acquisition timestamp remains available
```

Do not blindly transition it to `FAILED`.

---

## 17. Qualified Checkpoint Retry

After explicit stale recovery of the lost-final-completion state:

```text
retry CHAPTERS
```

with the valid persisted chapter.

Verify:

```text
zero additional Gemini calls
chapter reused
PipelineService retries final completion
CHAPTERS completes
```

---

## 18. Invalid Checkpoint JSON

Test malformed:

```text
characterIdsJson
```

Verify it does not qualify for checkpoint reuse.

---

## 19. Reordered Character IDs

For characters:

```json
["character-a", "character-b"]
```

a checkpoint containing:

```json
["character-b", "character-a"]
```

must be rejected.

Do not compare the association as an unordered set.

---

## 20. Stale Character IDs

If the persisted chapter references IDs that no longer match the current
characters, the checkpoint must be rejected.

---

## 21. Incomplete Illustration State

A chapter with:

```text
generationStatus != PENDING
```

or:

```text
generationError != null
```

or:

```text
imagePath != null
```

must not qualify as the Phase 10 lost-completion checkpoint.

---

## 22. Project Detail Safety

Verify project detail exposes:

```text
id
name
prompt
position
generationStatus
generationError
```

for chapters.

Verify it does not expose:

```text
characterIdsJson
imagePath
Gemini IDs
filesystem paths
```

---

## 23. Migration Constraint

Using real SQLite, verify:

```text
position 0 accepted
position 1 rejected
second position-0 chapter for same project rejected
```

---

## 24. Migration Data Preservation

Verify a valid existing position-0 chapter survives the migration.

---

## 25. Migration Foreign Key Preservation

Use:

```sql
PRAGMA foreign_key_list(chapters);
```

Verify:

```text
project_id
→ projects(id)
→ ON DELETE CASCADE
```

is retained.

---

## 26. Migration Index Preservation

Use:

```sql
PRAGMA index_list(chapters);
```

Verify:

```text
chapters_project_id_idx
```

exists.

Verify:

```text
chapters_project_position_unique
```

exists and remains unique.

---

## 27. Ownership

Retain or extend authenticated pipeline coverage proving:

```text
User B
→ cannot run CHAPTERS for User A project
→ receives 404
→ makes zero Gemini calls
→ causes zero chapter mutations
```

---

# Cost-Control Requirements

Phase 10 must preserve the project's Gemini cost-control strategy.

Normal successful execution:

```text
1 CHAPTERS step
=
at most 1 Gemini text-generation call
```

Concurrent duplicate requests:

```text
→ one acquisition winner
→ one paid call
```

Completed step:

```text
→ zero calls
```

Qualified checkpoint retry:

```text
→ zero calls
```

Missing prerequisite:

```text
→ zero calls
```

Invalid local persisted state:

```text
→ zero calls where detectable before Gemini
```

No automatic retry.

---

# Error Safety

Do not persist raw Gemini/provider error responses in:

```text
stepError
generationError
```

Use safe application-controlled error messages.

Provider exceptions should not expose:

- API keys;
- provider request bodies;
- internal filesystem paths;
- SDK internals;
- raw provider diagnostics.

Detailed provider errors may be logged locally where appropriate, but client
responses and persisted errors should remain safe.

---

# DECISIONS.md

Do not add a new decision merely because Phase 10 exists.

The durable-generation-checkpoint strategy is already part of the established
pipeline design.

Only update `DECISIONS.md` if implementation uncovers a genuinely new
architecture/correctness trade-off that is more important than an existing
decision.

The document should remain focused rather than growing one decision per phase.

---

# Implementation Order

Implement test-first in approximately this order:

```text
1. chapter structured schema

2. chapter repository contract/tests

3. position=0 schema invariant and migration

4. migration preservation/metadata tests

5. Gemini chapter adapter contract

6. fake-adapter executor tests

7. ChaptersStepExecutor

8. transactional acquired-run replacement

9. durable checkpoint validation

10. pipeline dispatcher integration

11. concrete Google Gemini adapter

12. runtime chapter prompt

13. project-detail chapter DTO

14. ownership/concurrency integration coverage

15. documentation update
```

Do not perform real Gemini calls while implementing automated tests.

---

# Verification

Before Phase 10 is considered complete, run:

```bash
npm run typecheck --workspace=apps/api
```

```bash
npm run test --workspace=apps/api
```

```bash
npm run build --workspace=apps/api
```

```bash
npm test
```

```bash
git diff --check
```

All commands must pass.

Warnings about Windows LF/CRLF conversion are not failures unless
`git diff --check` reports actual whitespace errors.

---

# Completion Summary

After implementation, report:

## Changed Files

List:

- files added;
- files modified;
- generated migration files.

## Migration

Explain:

```text
CHECK(position = 0)
+
UNIQUE(project_id, position)
```

and confirm preservation of:

```text
data
foreign key
indexes
illustration fields
```

## Structured Contract

Confirm the generated result is:

```json
{
  "chapter": {
    "name": "...",
    "prompt": "..."
  }
}
```

and no chapter body or database IDs were invented.

## Character Association

Explain that:

```text
characterIdsJson
```

is generated server-side from persisted characters in deterministic position
order.

## Transactional Persistence

Confirm the acquired-run guard and chapter replacement execute in the same
SQLite transaction.

## Retry Checkpoint

Explain the difference between:

```text
Gemini success
→ chapter persistence failure
→ no checkpoint
→ explicit retry may call Gemini again
```

and:

```text
Gemini success
→ chapter persisted
→ final pipeline completion lost
→ durable checkpoint
→ stale recovery
→ explicit retry
→ zero additional Gemini calls
```

## Project Detail

Confirm chapter DTOs expose only client-safe fields.

## Tests

Report:

```text
test files
test count
```

and the major Phase 10 cases covered.

## Verification

Report the result of:

```text
API typecheck
API tests
API build
root npm test
git diff --check
```

---

# Final Acceptance Criteria

Phase 10 is complete only when all of the following are true:

- `CHAPTERS` runs through the existing authenticated pipeline endpoint;
- ownership remains enforced server-side;
- `PORTRAITS` is the required predecessor;
- STYLE is reused;
- Gemini Files API book URI is reused;
- persisted characters are supplied in deterministic order;
- portrait image bytes/paths are not sent to Gemini;
- exactly one strict chapter object is generated;
- character database IDs are server-derived;
- chapter persistence is transactionally guarded by the exact acquired run;
- stale Gemini results cannot persist;
- database enforces `position = 0`;
- database therefore permits at most one chapter per project;
- migration preserves chapter data, FK, indexes, and Phase 11 image fields;
- chapter detail DTO does not expose persistence internals;
- concurrent requests cannot produce duplicate paid Gemini calls;
- completed CHAPTERS cannot rerun;
- failed CHAPTERS requires explicit retry;
- qualified lost-final-completion checkpoint retry makes zero additional Gemini
  calls;
- malformed/reordered/stale `characterIdsJson` cannot qualify as a checkpoint;
- automated tests use fake Gemini adapters;
- automated tests consume zero Gemini quota;
- no illustration is generated;
- no automatic Gemini retry exists;
- no queues, Redis, workers, or WebSockets are introduced;
- all verification commands pass;
- no commit or push is performed automatically.