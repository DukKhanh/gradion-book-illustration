# Phase 11 — ILLUSTRATIONS Generation

## Initial prompt

Read the current repository and do not modify files yet.

We are starting Phase 11: ILLUSTRATIONS generation.

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

Phase 11 is the final backend generation step.

Use the existing Google GenAI SDK, pipeline engine, repository patterns, and
local filesystem storage.

Automated tests must never make real Gemini calls.

Do not commit or push.

---

### Reference

Inspect:

```text
docs/reference/app-demo.html
```

and the existing Phase 8–10 implementations.

Determine:

1. how many illustrations the reference generates;
2. what data is used to generate them;
3. whether portrait images are actual Gemini inputs or only a sequencing
   prerequisite;
4. whether the original Gemini book reference is still needed;
5. the expected illustration aspect ratio;
6. whether manual illustration regeneration exists;
7. how the frontend should retrieve the final persisted image.

Treat `app-demo.html` as product/reference behavior only.

Do not copy its fake persistence, timers, placeholder images, or client-side
pipeline state.

---

### Phase 11 scope

Implement only:

```text
ILLUSTRATIONS
```

Expected flow:

```text
authenticated pipeline request
→ atomic ILLUSTRATIONS acquisition
→ validate persisted chapter/context
→ generate final chapter image
→ persist image locally
→ checkpoint chapter image as DONE
→ complete ILLUSTRATIONS
```

Do not add:

```text
automatic Gemini retry
manual illustration CRUD/regeneration
queues
workers
Redis
WebSockets
cloud storage
generic provider abstractions
```

---

### Existing chapter model

Reuse the current chapter fields:

```text
imagePath
generationStatus
generationError
```

Do not add a schema migration unless the current model is genuinely
insufficient.

The normal Phase 10 chapter starts with:

```text
position = 0
generationStatus = PENDING
generationError = null
imagePath = null
```

Phase 11 should turn that persisted chapter into the final durable illustration
checkpoint.

---

### Provider input

Determine the minimum required Gemini input from the reference.

Prefer:

```text
chapter name
chapter prompt
persisted STYLE
```

Do not send:

```text
database IDs
filesystem paths
Gemini IDs
book URI
local book text
portrait bytes
```

unless the reference or actual provider requirements prove they are necessary.

---

### Character association

The chapter's:

```text
characterIdsJson
```

must still match the current persisted characters.

Before any paid call, validate:

```text
valid JSON
array of string IDs
no duplicates
same number of IDs as current characters
exact deterministic character-position order
```

Malformed, reordered, missing, duplicate, or stale IDs must cause:

```text
zero Gemini calls
```

---

### Gemini adapter

Use a small task-specific adapter such as:

```ts
interface GeminiIllustrationAdapter {
  generateIllustration(input: {
    chapterName: string
    chapterPrompt: string
    style: string
  }): Promise<{
    bytes: Uint8Array
    mimeType: string
  }>
}
```

Use:

```text
gemini-3.1-flash-lite-image
```

through configured model settings.

Validate the current Google GenAI SDK request/response shape before
implementation.

No real provider call may occur in automated tests.

---

### Local image storage

Persist the final PNG to a run-scoped server-generated path such as:

```text
data/images/
  <userId>/
    <projectId>/
      chapters/
        <chapterId>/
          <stepStartedAtEpochMs>.png
```

Do not derive paths from chapter names or client input.

Do not store base64 image data in SQLite.

---

### Durable checkpoint

An illustration is durable only when:

```text
current chapter is valid
characterIdsJson matches current characters
generationStatus = DONE
imagePath is non-null
physical file exists
```

Anything else is incomplete, including:

```text
PENDING
FAILED
stale RUNNING
DONE with missing file
```

A newly acquired explicit ILLUSTRATIONS retry may regenerate only incomplete
work.

---

### Stale safety

Every chapter mutation must be conditional on the exact project-level
ILLUSTRATIONS acquisition:

```text
projectId
userId
chapterId
runningStep = ILLUSTRATIONS
stepState = RUNNING
exact stepStartedAt
```

The project-level pipeline acquisition remains authoritative.

Do not create a second chapter/illustration lock.

A stale Gemini response must not be able to persist after its run loses
ownership.

---

### Write ordering

Successful generation must use:

```text
Gemini returns valid PNG
→ write run-scoped file
→ conditional chapter DONE checkpoint
```

Do not mark the chapter DONE before the file is durable.

If the file is written but the DB checkpoint cannot be persisted, clean up the
new file best-effort.

---

### Lost final pipeline completion

If:

```text
Gemini succeeds
→ PNG persists
→ chapter DONE checkpoint persists
→ PipelineService.completeStep() fails
```

the illustration is already a durable paid result.

Keep it.

Expected recovery:

```text
RUNNING ILLUSTRATIONS
→ explicit stale recovery
→ FAILED ILLUSTRATIONS
→ explicit retry
→ durable checkpoint detected
→ zero Gemini calls
→ retry terminal pipeline completion
```

---

### Retrieval

Add authenticated retrieval:

```text
GET /api/projects/:projectId/chapters/:chapterId/illustration
```

Require:

```text
session
owned project
chapter belongs to project
generationStatus = DONE
imagePath exists
physical file exists
```

Return:

```text
image/png
```

Return `404` for unavailable or non-owned resources.

Never expose local filesystem paths.

Project detail should expose:

```text
illustrationUrl: string | null
```

rather than `imagePath`.

---

### Tests

At minimum cover:

- CHAPTERS is required before ILLUSTRATIONS;
- normal execution makes exactly one fake Gemini image call;
- Gemini receives only chapter name, prompt, and STYLE;
- invalid `characterIdsJson` makes zero Gemini calls;
- lost `beginIllustration()` ownership makes zero Gemini/filesystem calls;
- provider failure does not auto-retry;
- filesystem failure does not mark DONE;
- stale mutations are rejected;
- stale row-level RUNNING can be retried under a new project acquisition;
- DONE + existing file skips Gemini;
- DONE + missing file regenerates;
- DB checkpoint failure cleans the newly written file;
- concurrent requests produce one paid call;
- lost final completion can recover with zero additional Gemini calls;
- cross-user generation/retrieval is rejected;
- illustration retrieval requires a durable file;
- project detail exposes `illustrationUrl` without `imagePath`;
- automated tests use fake Gemini adapters only.

Before finishing run:

```text
API typecheck
API tests
API build
root npm test
git diff --check
```

Do not modify files until the design is reviewed and approved.

Do not commit or push.

---

## Design outcome

The Phase 11 design was approved with the following conclusions:

- Phase 10 guarantees one chapter, so normal Phase 11 requires at most one paid
  image call.
- The reference uses a wide illustration card.
- `3:2` is used as a provider-supported wide approximation of the reference
  layout, not as a product requirement.
- The final Gemini request uses only:
  - chapter name;
  - persisted chapter prompt;
  - persisted STYLE.
- Portrait bytes and Gemini book references are not required.
- The existing chapter persistence fields are sufficient; no migration is
  needed.
- Project-level pipeline acquisition remains the execution owner.
- Chapter `generationStatus` is only item-level progress metadata.
- The final image is stored locally and served through an authenticated API.

---

## Review correction

The design was approved with several correctness requirements.

### Durable checkpoint

Do not consider a chapter complete merely because its DB status is DONE.

Require:

```text
valid position-0 chapter
valid name and prompt
valid current characterIdsJson mapping
generationStatus = DONE
imagePath is non-null
physical file exists
```

### Row-level RUNNING

A stale chapter:

```text
generationStatus = RUNNING
```

must not become a second lock after project-level stale recovery.

A newly acquired explicit ILLUSTRATIONS retry may regenerate any non-durable
chapter state.

### Guard before Gemini

Before making the paid call:

```text
beginIllustration()
```

must prove the exact current project acquisition.

If it returns false:

```text
Gemini calls = 0
filesystem writes = 0
completeIllustration calls = 0
failIllustration calls = 0
```

### Stale responses

All begin/complete/fail mutations must guard:

```text
projectId
userId
chapterId
ILLUSTRATIONS
RUNNING
exact stepStartedAt
```

A provider response from an old recovered run must not checkpoint into a newer
run.

### Filesystem compensation

Use a Windows-safe run-scoped PNG path.

If:

```text
file write succeeds
→ DONE checkpoint fails
```

delete only the newly written file best-effort.

Do not add background cleanup infrastructure.

### Missing files

A DB state of:

```text
DONE + imagePath
```

with a missing physical file is incomplete.

It may be regenerated only through an explicit ILLUSTRATIONS execution.

### Retrieval

Use:

```text
GET /api/projects/:projectId/chapters/:chapterId/illustration
```

with authenticated ownership and durable-file validation.

Project detail exposes `illustrationUrl`, not `imagePath`.

No schema or DECISIONS.md changes were required.

---

## Implementation outcome

Phase 11 ILLUSTRATIONS was implemented through the existing pipeline.

The concrete Gemini adapter:

- uses the configured `gemini-3.1-flash-lite-image`;
- requests PNG output;
- uses provider-supported `3:2` for the wide chapter illustration;
- uses the default/lowest 1K behavior;
- validates non-empty PNG output;
- receives only chapter name, chapter prompt, and STYLE.

No book URI, portrait bytes, local paths, database IDs, or Gemini IDs are sent
to the image model.

Generated files use the server-controlled layout:

```text
data/images/
  <userId>/
    <projectId>/
      chapters/
        <chapterId>/
          <stepStartedAtEpochMs>.png
```

The image is written before its chapter checkpoint becomes DONE.

The chapter checkpoint is protected by the exact current ILLUSTRATIONS
acquisition.

Authenticated retrieval was added at:

```text
GET /api/projects/:projectId/chapters/:chapterId/illustration
```

Project detail now exposes:

```text
illustrationUrl
```

while keeping internal filesystem paths and character association JSON private.

No schema migration was added.

---

## Final review correction

The implementation review found one focused failure-path issue.

Initially:

```text
Gemini succeeds
→ file write succeeds
→ completeIllustration() returns false
→ generic catch
→ file cleanup
→ failIllustration()
```

A failed `completeIllustration()` means the run can no longer persist the exact
terminal checkpoint.

This is a persistence-transition/lost-ownership failure, not an illustration
generation failure.

The behavior was corrected to:

```text
completeIllustration() = false
→ best-effort delete only the newly written run-scoped file
→ do not call failIllustration()
→ throw 500 "Illustration checkpoint could not be persisted."
```

Actual provider, invalid-image, and filesystem failures continue through the
guarded `failIllustration()` path.

A focused regression test now verifies this behavior.

No architecture, schema, route, or Gemini-adapter changes were required for
this correction.

---

## Final outcome

Phase 11 completes the backend generation pipeline:

```text
STYLE
→ CHARACTERS
→ PORTRAITS
→ CHAPTERS
→ ILLUSTRATIONS
```

Normal flow:

```text
CHAPTERS complete
→ atomic ILLUSTRATIONS acquisition
→ validate STYLE/chapter/character association
→ validate durable checkpoint
→ guarded beginIllustration
→ one Gemini image call
→ validate PNG
→ write run-scoped image
→ guarded DONE checkpoint
→ complete ILLUSTRATIONS
```

Retry behavior:

```text
durable DONE image
→ zero Gemini calls
```

```text
PENDING / FAILED / stale RUNNING / DONE with missing file
→ generate only during explicit retry
```

Stale provider responses cannot gain durable checkpoints after losing their
project-level acquisition.

If the final project pipeline transition is lost after the illustration is
already durable:

```text
explicit stale recovery
→ explicit retry
→ durable checkpoint reused
→ zero additional Gemini calls
→ retry pipeline completion
```

Final verification:

```text
API typecheck                         PASS
API tests — 23 files / 101 tests     PASS
API build                             PASS
root npm test                         PASS
git diff --check                      PASS
```

Automated tests consumed zero real Gemini quota.

No schema migration was required.

No commit or push was performed by the implementation agent.