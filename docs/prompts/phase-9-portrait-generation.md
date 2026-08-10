# Phase 9 — PORTRAITS Generation

## Initial prompt

Read the current repository and do not modify files yet.

We are starting Phase 9: PORTRAITS generation.

Current pipeline:

```text
STYLE
→ CHARACTERS
→ PORTRAITS
→ CHAPTERS
→ ILLUSTRATIONS
```

Current Gemini models:

```text
text:
gemini-3.6-flash

image:
gemini-3.1-flash-lite-image
```

Phase 9 is the first real image-generation phase.

Use the official Google GenAI SDK already installed in the repository.

Automated tests must never make real Gemini calls.

Do not modify files until the design is reviewed and approved.

Do not commit or push.

---

## Reference material

Before designing Phase 9, inspect the Gradion-provided product reference:

```text
docs/reference/app-demo.html
```

Treat it as a product behavior and UI-flow reference, not production source
code.

Do not copy:

- localStorage persistence;
- setTimeout generation;
- fake portraitReady fields;
- placeholder CSS images;
- client-side pipeline state;
- demo-only stale recovery.

Extract only the expected PORTRAITS behavior.

Specifically inspect how the reference implements:

```text
CHARACTERS
→ PORTRAITS
→ CHAPTERS
```

Determine:

1. how many portraits are generated;
2. whether portraits are generated one at a time;
3. whether each portrait becomes visible independently;
4. what character data is shown with a portrait;
5. how later steps depend on generated portraits;
6. whether manual portrait editing/regeneration exists;
7. which demo-only behavior should not be copied.

---

## Existing implementation to inspect

Read:

```text
AGENTS.md
DECISIONS.md
docs/architecture.md
docs/plan.md

apps/api/src/db/schema.ts

apps/api/src/modules/pipeline/
apps/api/src/modules/pipeline/style/
apps/api/src/modules/pipeline/characters/

apps/api/src/modules/projects/

apps/api/src/services/gemini/
apps/api/src/services/gemini/prompts/

existing Phase 4–8 tests
```

Also inspect:

```text
docs/prompts/phase-7-style-generation.md
docs/prompts/phase-8-character-generation.md
```

to understand the established paid-call checkpoint and retry rules.

---

## Current Phase 8 character model

Phase 8 persists one or two characters with deterministic positions:

```text
position 0
position 1
```

Relevant persisted character fields include:

```text
id
projectId
name
prompt
position
imagePath
generationStatus
generationError
```

New characters start with:

```text
generationStatus = PENDING
imagePath = null
generationError = null
```

Verify the actual schema before relying on these fields.

Do not introduce a second portrait table unless the existing character model
is genuinely insufficient.

---

## Phase 9 scope

Implement only:

```text
PORTRAITS
```

The expected high-level flow is:

```text
authenticated request
→ PipelineService validates order/ownership
→ atomic PORTRAITS acquisition
→ PortraitsStepExecutor
→ load persisted characters + STYLE
→ generate required portrait images
→ persist each successful image immediately
→ complete PORTRAITS only when every required portrait is durable
```

Do not implement:

```text
CHAPTERS
ILLUSTRATIONS
manual image editing
automatic provider retry
background jobs
queues
Redis
workers
WebSockets
generic provider abstraction frameworks
```

---

## Image model

Use:

```text
gemini-3.1-flash-lite-image
```

for portrait generation.

Do not use the text model to produce portrait images.

Keep model selection configuration-driven.

Do not hard-code a different model in the executor or adapter.

The current Google documentation describes Gemini 3.1 Flash Lite Image as a
cost-efficient image-generation model. Keep Phase 9 intentionally
cost-conscious.

---

## Important cost-control difference from Phase 8

PORTRAITS is a multi-paid-call step.

If there are two characters, normal execution may require:

```text
portrait character 0
→ one paid image call

portrait character 1
→ one paid image call
```

Therefore Phase 9 must support partial durable progress.

Do not treat the two portraits as an all-or-nothing generation transaction.

Unlike the CHARACTERS text result, each successfully generated image should be
persisted immediately.

Expected behavior:

```text
character 0 image generated
→ persist image immediately
→ mark character 0 DONE

character 1 image generation fails
→ preserve character 0 DONE
→ mark/recover character 1 appropriately
→ PORTRAITS pipeline step fails
```

On explicit retry:

```text
character 0 DONE
→ skip
→ zero Gemini calls

character 1 not DONE
→ generate only character 1
```

Never regenerate a successfully persisted portrait merely because another
portrait failed later.

---

## PORTRAITS prerequisites

Before any image call, require:

```text
completedStep === CHARACTERS
valid persisted STYLE
valid complete character set
```

The persisted character set must satisfy the Phase 8 invariants:

```text
1–2 characters
positions contiguous from 0
valid name
valid portrait prompt
```

Determine whether `geminiBookState` / `geminiBookFileUri` is actually needed
for PORTRAITS.

Do not require the Gemini book file reference unless the image-generation API
or product requirement truly needs it.

The portrait prompt should primarily derive from:

```text
persisted STYLE
+
persisted character prompt
```

Do not resend the full book without a demonstrated requirement.

A failed prerequisite must result in:

```text
zero image-generation calls
```

---

## Portrait input

For each character, the image-generation adapter should receive the minimum
required input.

Likely:

```ts
{
  characterName: string,
  characterPrompt: string,
  style: string
}
```

but inspect the assessment notebook/reference before finalizing the adapter
contract.

Do not send persistence internals to Gemini.

Do not send:

```text
database IDs
filesystem paths
generation status
errors
```

unless required.

---

## Runtime prompt

Add a versioned runtime portrait prompt in source code, not docs/prompts/.

Prefer:

```text
apps/api/src/services/gemini/prompts/portrait.prompt.ts
```

The production prompt should instruct the image model to:

- generate a portrait of exactly one character;
- follow the persisted visual STYLE;
- follow the character's persisted visual prompt;
- maintain storybook consistency;
- avoid including unrelated extra characters;
- produce output suitable for display as the character portrait.

Do not put development/Codex instructions in this runtime prompt.

---

## Image output handling

Inspect the current Google GenAI SDK response format for
`gemini-3.1-flash-lite-image`.

Determine exactly how image bytes/content are returned.

Do not assume the response shape.

Use the current official SDK behavior as the implementation source of truth.

The Gemini adapter should return a small provider-independent result such as:

```ts
{
  bytes: Uint8Array
  mimeType: string
}
```

or the smallest equivalent supported by the actual SDK.

Do not expose raw provider responses outside the adapter.

---

## Local image persistence

Generated portraits must survive backend restart.

Persist image files to local storage.

Prefer a deterministic server-generated path such as:

```text
data/images/
  <userId>/
    <projectId>/
      characters/
        <characterId>.<ext>
```

or an equivalent existing storage convention.

Do not use client filenames.

Do not use character names directly as filesystem paths.

Do not store base64 image bodies in SQLite.

SQLite should store only the durable image path/status metadata.

Before implementation, inspect the current `FileStorageService` and determine
whether to extend it or create a narrowly scoped image-storage service.

Do not create unnecessary generic cloud-storage abstractions.

---

## Safe image write ordering

The desired per-character success path is:

```text
Gemini image generation succeeds
→ validate returned image/mime type
→ write image to local filesystem
→ persist character imagePath + DONE status
```

Do not mark the character `DONE` before the image file is durable.

If filesystem persistence fails:

```text
do not mark DONE
```

If the image file is written but the database checkpoint update fails:

```text
do not report the portrait as completed
```

Analyze whether the newly written image should be deleted best-effort or left
for deterministic overwrite/recovery.

Choose the simplest safe approach and explain the trade-off.

---

## Per-character generation status

Inspect the existing allowed `generationStatus` values.

Do not invent new values unless necessary.

Phase 9 needs to distinguish at minimum:

```text
not yet generated
successfully generated
failed/retryable if persisted
```

If the existing model already supports:

```text
PENDING
DONE
FAILED
```

reuse it.

Do not add another portrait execution-state machine if the existing character
generation fields are sufficient.

The project-level PipelineService still owns the PORTRAITS step state.

Character-level status only records durable per-image progress.

---

## Per-character paid-call checkpoint

A portrait qualifies as completed only when its image checkpoint is durable.

A valid completed portrait should require something like:

```text
generationStatus = DONE
imagePath is non-null
image file exists
```

Determine the exact invariant before implementing.

On retry, skip only portraits that satisfy the complete durable checkpoint.

Do not use:

```text
imagePath != null
```

alone if other state may contradict it.

Do not use:

```text
generationStatus = DONE
```

alone if the file may be missing.

---

## Partial-success behavior

Example with two characters:

```text
Character 0
PENDING
→ Gemini call
→ image persisted
→ DB checkpoint DONE

Character 1
PENDING
→ Gemini call
→ provider failure
```

Expected result:

```text
Character 0 remains DONE
Character 1 remains retryable
PORTRAITS pipeline becomes FAILED
```

On explicit retry:

```text
Character 0
→ checkpoint valid
→ skip
→ zero image calls

Character 1
→ generate once
→ persist
→ DONE

all portraits DONE
→ PipelineService completes PORTRAITS
```

This behavior is a core Phase 9 requirement.

---

## Sequential vs parallel image calls

Do not parallelize portrait Gemini calls by default.

The reference demo processes portraits one at a time, and sequential execution
has several advantages for this assessment:

```text
lower cost surprise
simpler persistence
clear partial progress
easier retry reasoning
less provider concurrency
```

Prefer:

```text
for characters ordered by position:
  if checkpoint complete:
    skip
  else:
    generate
    persist immediately
```

Before implementation, confirm that sequential generation is sufficient for the
assessment.

Do not add `Promise.all()` merely for speed.

---

## Pipeline retry semantics

PipelineService remains responsible for:

```text
RUNNING
FAILED
IDLE
completedStep
runningStep
stepStartedAt
stepError
```

PORTRAITS executor should be naturally resumable from persisted character image
checkpoints.

A failed PORTRAITS retry should not need a separate project-level checkpoint
flag.

Its checkpoint state already exists at the character level.

Normal retry:

```text
Pipeline FAILED at PORTRAITS
→ explicit run PORTRAITS
→ atomic acquire
→ executor loads characters
→ skips valid DONE portraits
→ generates only missing/failed portraits
```

This is different from STYLE/CHARACTERS, where a complete logical result could
be reused only in a narrower lost-final-completion retry case.

PORTRAITS should be intentionally resumable item by item because each item has
its own paid generation call.

---

## Stale execution risk

Analyze this race carefully:

```text
portrait Gemini call is running
→ project PORTRAITS execution becomes stale
→ user explicitly recovers pipeline RUNNING → FAILED
→ old Gemini request returns an image
```

The stale request must not be allowed to persist a portrait after losing
ownership of the acquired PORTRAITS run.

Each portrait checkpoint database mutation should therefore be conditional on:

```text
projectId
userId
runningStep = PORTRAITS
stepState = RUNNING
exact stepStartedAt
characterId
```

The state guard and character checkpoint update should be atomic where
practical.

If the execution no longer owns the run:

```text
do not update portrait checkpoint
```

Analyze what should happen to any image file already written by the stale
request.

Prefer deterministic cleanup or overwrite behavior rather than complex locking.

---

## Failure semantics

### Provider failure before image result

```text
no new image checkpoint
→ PORTRAITS pipeline fails
→ no automatic retry
```

Already completed portraits remain untouched.

### Invalid provider image result

```text
reject image
→ do not mark character DONE
→ PORTRAITS fails
```

### Filesystem failure

```text
do not mark character DONE
→ PORTRAITS fails
```

### Character checkpoint database failure

```text
do not report character success
→ PORTRAITS fails
```

Already completed earlier portraits remain durable.

### Final PipelineService completion failure

If every required portrait is already durably `DONE` but the final project-level
PORTRAITS `completeStep()` fails:

```text
pipeline remains RUNNING
→ explicit stale recovery
→ explicit PORTRAITS retry
→ executor validates all portrait checkpoints
→ zero Gemini calls
→ retry project-level completion
```

This should fall out naturally from per-character checkpoints.

---

## Image regeneration

Inspect the assessment/reference carefully for explicit portrait regeneration.

Do not add a regenerate endpoint merely because image products often support
one.

If the reference does not require manual portrait regeneration:

```text
completed portrait
→ immutable through normal PORTRAITS flow
```

If regeneration is explicitly required by the source material, explain how it
fits the pipeline and cost-control requirements before implementing it.

Do not assume regeneration.

---

## Project detail DTO

Phase 8 already exposes character cards through owned project detail.

Phase 9 should expose enough state for the frontend to display portrait
progress.

Likely client-relevant fields include:

```text
id
name
prompt
position
generationStatus
image availability / image URL endpoint
```

Do not expose raw local filesystem paths directly if the client should instead
retrieve images through an authenticated API route.

Before implementation, determine the intended image-serving mechanism.

Prefer authenticated image access scoped by project ownership rather than
returning server filesystem internals.

---

## Image retrieval API

Inspect whether the project currently has a safe static-file mechanism.

If not, propose the minimum authenticated image endpoint required by the
reference UI.

For example:

```text
GET /api/projects/:projectId/characters/:characterId/portrait
```

with:

```text
require session
→ ownership check
→ validate character belongs to project
→ read server-owned image path
→ return correct Content-Type
```

Do not create full character CRUD.

Do not expose arbitrary filesystem paths.

If another existing safe mechanism already solves this, reuse it.

---

## Concurrency and double-click protection

The existing atomic project-level pipeline acquisition remains the primary
duplicate-request guard.

Expected behavior:

```text
Request A
→ acquires PORTRAITS
→ begins image generation

Request B
→ acquire fails
→ zero Gemini image calls
```

Additionally, per-character checkpoint writes must reject results from a stale
execution that has lost project-level ownership.

---

## Cost control

Phase 9 must be especially cost-conscious because image calls are paid and
more expensive than normal local operations.

Required behavior:

```text
maximum one image call per character needing a portrait
```

For one character:

```text
maximum 1 normal image call
```

For two characters:

```text
maximum 2 normal image calls
```

Retry:

```text
already durable portrait
→ 0 calls

missing portrait
→ 1 call
```

Never:

```text
retry entire portrait set automatically
```

Automated tests:

```text
0 real Gemini calls
```

Do not generate sample images during automated verification.

Real image generation must be a separate intentional manual test.

---

## Tests to propose

Before implementation, propose at minimum:

1. PORTRAITS cannot run before CHARACTERS completion.
2. One character causes one fake image-generation call.
3. Two characters cause two sequential fake image-generation calls.
4. Adapter receives persisted STYLE.
5. Adapter receives each persisted character prompt.
6. Portraits execute in deterministic character-position order.
7. Successful image bytes are persisted to local storage.
8. Character checkpoint becomes DONE only after durable file persistence.
9. First portrait succeeds and second fails:
   - first remains DONE;
   - second remains retryable;
   - pipeline fails.
10. Retry skips first DONE portrait and calls Gemini only for second.
11. Two completed portraits cause zero image calls on qualified retry.
12. Invalid provider image result does not mark DONE.
13. Filesystem write failure does not mark DONE.
14. Database checkpoint failure does not report portrait success.
15. Stale old execution cannot persist a returned portrait after recovery.
16. Concurrent PORTRAITS pipeline requests result in only one active generation
    sequence.
17. Completed PORTRAITS cannot be rerun through the normal pipeline.
18. User B cannot generate or fetch User A's portraits.
19. Project detail exposes portrait progress without exposing filesystem paths.
20. Authenticated portrait retrieval returns the stored image with correct MIME
    type if an image endpoint is required.
21. Automated tests use fake image adapters and consume zero Gemini quota.

Keep all previous Phase 4–8 tests.

---

## app-demo.html comparison required

Before implementation, report explicitly:

### Reference portrait behavior

How does:

```text
docs/reference/app-demo.html
```

represent and reveal portraits?

### Number and ordering

Does it generate portraits sequentially and in character order?

### User interaction

Does the reference provide portrait regeneration/editing, or only one normal
generation flow?

### Current backend fit

Can the existing character fields support the required portrait state without
a migration?

### Image serving

What minimum backend mechanism is necessary for the real React frontend to
display persisted portrait images safely?

---

## Provider API verification required

Before implementing the real adapter, verify current official Google Gemini
documentation for:

```text
gemini-3.1-flash-lite-image
```

and the current `@google/genai` JavaScript SDK.

Do not rely on remembered or old API response shapes.

Confirm:

1. the exact image-generation call;
2. the exact response format;
3. how image bytes are returned;
4. available MIME metadata;
5. whether the configured model requires any special response-format option;
6. whether the default output size is sufficient for the assessment.

Prefer the lowest-cost/default output appropriate for portrait cards.

Do not increase output resolution unless the product/reference requires it.

---

## Potential DECISIONS.md impact

Do not update `DECISIONS.md` yet.

Phase 9 may produce a strong candidate decision:

```text
Persist each paid image result immediately and resume multi-image steps from
per-item durable checkpoints rather than rerunning the whole step.
```

This may eventually replace a weaker existing decision.

Record it only during the final decisions review after the implementation and
tests prove the behavior.

Do not add Decision 7 now.

---

## First task — design only

Before modifying any file:

1. inspect `docs/reference/app-demo.html`;
2. explain the reference PORTRAITS behavior;
3. inspect the current character persistence model;
4. inspect the Phase 8 CHARACTERS implementation;
5. inspect PipelineService retry/stale semantics;
6. inspect existing local file-storage infrastructure;
7. verify the current official Gemini image-generation API and SDK behavior;
8. propose the minimal `GeminiPortraitAdapter` contract;
9. define the runtime portrait prompt;
10. define the image filesystem layout;
11. define the safe image-serving mechanism;
12. define the exact per-character portrait checkpoint invariant;
13. explain sequential generation and partial-success persistence;
14. explain retry behavior after partial success;
15. analyze stale execution returning an image after pipeline recovery;
16. analyze filesystem-success / DB-failure behavior;
17. analyze all paid-image-call failure windows;
18. identify whether any schema migration is necessary;
19. list exact files expected to be added or modified;
20. list all tests to implement;
21. identify assumptions not directly supported by the assessment/reference.

Do not modify files yet.

Return the Phase 9 design for review first.

Do not commit or push.

---

## Review correction

I approve the Phase 9 design with these final corrections.

### 1. Per-character RUNNING must not become a second lock

Project-level PipelineService acquisition remains the authoritative execution
ownership mechanism.

A character-level `generationStatus = RUNNING` may remain after a project-level
PORTRAITS execution becomes stale and is explicitly recovered.

Do not allow that stale per-character RUNNING status to block future explicit
PORTRAITS retry forever.

For checkpoint purposes:

```text
DONE + non-null imagePath + durable image file exists
→ complete portrait checkpoint

anything else
→ incomplete portrait
```

During a newly acquired PORTRAITS retry, an incomplete portrait may be
generated again even if its previous character-level status is RUNNING.

Do not add a second per-character lock/state machine, attempt-history table, or
portraitStartedAt field solely for this.

All per-character mutations must remain guarded by the current project-level
acquisition:

- projectId;
- userId;
- runningStep = PORTRAITS;
- project stepState = RUNNING;
- exact project stepStartedAt;
- characterId.

Add a focused test for:

```text
old PORTRAITS run
→ character becomes RUNNING
→ project stale recovery
→ explicit PORTRAITS retry
→ stale character RUNNING does not block generation
```

### 2. Use Windows-safe run-scoped image filenames

Keep run-scoped portrait paths, but do not use `Date.toISOString()` directly as
a filename.

Use a Windows-safe server-generated component such as:

```text
stepStartedAt.getTime()
```

Preferred layout:

```text
data/images/
  <userId>/
    <projectId>/
      characters/
        <characterId>/
          <stepStartedAtEpochMs>.png
```

Never derive filesystem paths from character names or client input.

### 3. DONE with missing file is not a durable checkpoint

A portrait may be skipped only when:

```text
generationStatus = DONE
imagePath is non-null
the referenced image file actually exists
```

If the database says DONE but the file is missing, treat the portrait as
incomplete during an explicit PORTRAITS execution and regenerate it.

Do not silently treat contradictory DB/filesystem state as complete.

Add a focused retry test for this behavior.

### 4. Preserve run-scoped cleanup behavior

After Gemini succeeds:

```text
write run-scoped file
→ attempt conditional DB checkpoint
```

If the checkpoint fails:

```text
best-effort delete that new run-scoped file
→ do not report portrait success
```

If cleanup itself fails, an inaccessible orphan file is acceptable for this
assessment because no durable database checkpoint references it.

Do not add cleanup workers or queues.

### 5. Keep authenticated image serving

Project DTOs must not expose `imagePath`.

Expose a nullable client-safe portrait URL only for a durable DONE portrait.

Portrait retrieval must:

```text
require session
→ verify project ownership
→ verify character belongs to project
→ require a durable DONE checkpoint
→ read the server-owned file
→ return image/png
```

Do not add character CRUD or public static filesystem exposure.

### 6. Keep sequential paid image generation

Generate portraits sequentially in deterministic character-position order.

Do not use `Promise.all()` for paid portrait calls.

Persist each successful portrait immediately before moving to the next
character.

### 7. DECISIONS.md

Do not update DECISIONS.md during Phase 9.

We will compare all candidate decisions after the remaining pipeline phases and
keep only the strongest final set.

Now implement Phase 9 test-first.

Before finishing run:

- API typecheck;
- API tests;
- API build;
- root npm test;
- git diff --check.

Summarize:

- changed files;
- adapter behavior;
- image-storage layout;
- authenticated image serving;
- per-character checkpoint rules;
- partial-success/retry behavior;
- stale-run handling;
- tests and final counts.

Do not perform a real Gemini image call during automated verification.

Do not commit or push.

---

## Review 2 correction

Phase 9 implementation review is approved overall.

Do not change production behavior or architecture.

Before final acceptance, add these focused tests only.

### 1. Lost portrait begin/checkpoint ownership

In PortraitsStepExecutor tests:

- repository.beginPortrait returns false;
- executor rejects with the existing execution-no-longer-current error;
- Gemini adapter is never called;
- FileStorageService.writePortrait is never called;
- completePortrait/failPortrait are not called.

This test should prove that a request which has lost the current PORTRAITS
acquisition cannot make a paid Gemini image call.

### 2. Missing durable portrait file retrieval

In PortraitService tests:

- repository.findCompletedForUser returns a stored image path;
- storage.portraitExists returns false;
- service returns the existing 404 Portrait not found error;
- storage.readPortrait is never called.

This proves that DONE database metadata alone is not sufficient to serve a
portrait when the durable local file is missing.

### 3. Repository stale guards

Add focused real SQLite/Drizzle repository tests for:

- beginPortrait rejects a stale acquisition timestamp;
- beginPortrait rejects the wrong user;
- failPortrait rejects a stale acquisition timestamp.

Keep these tests small. Do not exhaustively test every ownership permutation.

Do not add a migration.
Do not change the Gemini adapter.
Do not change filesystem layout.
Do not change retry/checkpoint behavior.
Do not add automatic Gemini retries.

After adding the tests run:

- API typecheck
- API tests
- API build
- root npm test
- git diff --check

Report the final test count.

Do not commit or push.

---

## Final review

The Phase 9 implementation was reviewed after the initial verification.

The final review focused on proving cost-control and stale-ownership behavior
rather than changing production architecture.

Additional focused tests were requested to verify:

- a lost `beginPortrait` acquisition makes zero Gemini calls;
- a lost `beginPortrait` acquisition makes zero filesystem writes;
- missing durable portrait files return `404` without attempting to read them;
- stale acquisition timestamps cannot begin a portrait;
- another user cannot begin a portrait for the owned project;
- stale acquisitions cannot persist a portrait failure checkpoint.

No production behavior or architecture changed during this final review.

## Final outcome

Phase 9 implements sequential PORTRAITS generation through the existing
resumable pipeline.

The normal flow is:

```text
CHARACTERS complete
→ atomic PORTRAITS acquisition
→ load valid STYLE and persisted characters
→ character 0
   → validate durable checkpoint
   → generate only if incomplete
   → write run-scoped PNG
   → conditional DONE checkpoint
→ character 1
   → same flow
→ complete PORTRAITS
```

Portrait generation uses:

```text
gemini-3.1-flash-lite-image
```

through the existing Google GenAI integration boundary.

Portraits are generated sequentially in deterministic character-position order.

Each portrait is an independent paid-call checkpoint.

A valid durable checkpoint requires:

```text
generationStatus = DONE
imagePath is non-null
referenced portrait file exists
```

Only portraits satisfying all three conditions are skipped during retry.

Any other state is considered incomplete, including:

```text
PENDING
FAILED
stale RUNNING
DONE with missing file
```

A newly acquired explicit PORTRAITS retry may regenerate only those incomplete
portraits.

This allows partial progress such as:

```text
character 0 DONE
character 1 FAILED
```

to resume as:

```text
character 0 → skip → zero Gemini calls
character 1 → generate once
```

without regenerating already durable paid results.

Generated portrait files use server-generated run-scoped paths based on the
current pipeline acquisition timestamp.

The filesystem layout is:

```text
data/images/
  <userId>/
    <projectId>/
      characters/
        <characterId>/
          <stepStartedAtEpochMs>.png
```

The filename is Windows-safe and does not use client-controlled or character
name input.

A portrait is written to the filesystem before its database status is marked
DONE.

If the database checkpoint fails after the file write, the newly written
run-scoped file is deleted best-effort.

A cleanup failure may leave an inaccessible orphan file, but no database
checkpoint references it and no background cleanup infrastructure is added.

All portrait mutations are conditional on the exact current project-level
PORTRAITS acquisition:

```text
projectId
userId
runningStep = PORTRAITS
stepState = RUNNING
exact stepStartedAt
characterId
```

A stale Gemini request returning after explicit pipeline recovery therefore
cannot gain a durable portrait checkpoint.

Project detail never exposes internal filesystem paths.

Instead, a durable portrait exposes a client-safe URL:

```text
/api/projects/<projectId>/characters/<characterId>/portrait
```

Portrait retrieval requires an authenticated session, verifies project and
character ownership, requires a DONE portrait checkpoint and durable local
file, and returns `image/png`.

No portrait CRUD, manual regeneration, automatic Gemini retry, queues, workers,
Redis, WebSockets, or additional pipeline state machine was introduced.

Final verification passed:

```text
API typecheck        PASS
API tests            PASS — 72 tests across 16 files
API build            PASS
root npm test        PASS
git diff --check     PASS
```

Automated tests make zero real Gemini calls.

No commit or push was performed by the implementation agent.