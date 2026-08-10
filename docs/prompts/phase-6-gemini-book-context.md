# Phase 6 — Gemini Book Context

## Initial prompt

Read the current repository and do not modify files yet.

We are starting Phase 6: Gemini Book Context.

Current Gemini models:

- text: `gemini-3.6-flash`
- image: `gemini-3.1-flash-lite-image`

Phase 6 scope:

- introduce a small Gemini integration boundary;
- initialize Gemini context for a project's persisted book;
- send/upload/reference the book only once;
- persist the Gemini reference/context identifiers needed to reuse it;
- make the integration mockable for tests;
- survive backend restart;
- do not generate STYLE, CHARACTERS, PORTRAITS, CHAPTERS, or ILLUSTRATIONS yet;
- do not automatically retry Gemini calls;
- do not add queues, workers, Redis, WebSockets, or unnecessary abstractions.

Existing architecture:

```text
Route
→ Controller
→ Service
→ Repository / GeminiService / FileStorageService
```

Requirements:

- project ownership must remain enforced by `userId`;
- internal Gemini identifiers must not leak in normal project DTOs;
- automated tests must not call real Gemini;
- real Gemini should only be exercised manually and intentionally;
- keep API cost low.

First:

1. inspect the current repository;
2. propose the minimal Phase 6 design;
3. identify exactly what Gemini data must be persisted;
4. explain how book content is loaded from local storage;
5. explain how duplicate initialization is prevented;
6. identify concurrency/cost risks;
7. list exact files to add or modify;
8. propose tests using a fake Gemini adapter.

Do not edit files until I approve the plan.

Do not commit or push.

---

## Review correction

I approve the Phase 6 direction with one important API-design correction.

Do not assume that Phase 6 must create a separate Gemini
interaction/cache/context object just because the existing schema has
`geminiBookInteractionId`.

Current Gemini API behavior must drive the implementation.

For Phase 6, keep the scope to preparing a reusable Gemini book reference:

```text
Local persisted book
→ explicit user initialization
→ atomic DB acquisition
→ Gemini Files API upload/reference
→ persist geminiBookFileUri
→ mark the book reference READY
```

Do not invent a second provider call unless the concrete Gemini API we choose
actually requires and returns a reusable identifier.

Keep `geminiBookInteractionId` nullable and unused for now if necessary.

Use explicit persisted execution state:

- `IDLE`
- `RUNNING`
- `FAILED`
- `READY`

Prefer names tied to this responsibility:

- `geminiBookState`
- `geminiBookStartedAt`
- `geminiBookError`

Requirements:

- validate `GEMINI_API_KEY` before acquiring work;
- user/project ownership must be enforced;
- acquisition must be an atomic conditional DB update;
- only the successful acquirer may call Gemini;
- persist `geminiBookFileUri` after successful upload;
- repeated initialization in `READY` makes zero Gemini calls;
- failure becomes `FAILED` with a safe error;
- stale `RUNNING` recovery is explicit and does not retry automatically;
- retry from `FAILED` is explicit;
- normal project DTOs must not expose Gemini IDs;
- tests must use a fake adapter;
- no real Gemini usage in automated tests;
- no style, character, or image generation yet;
- no Redis, queues, workers, WebSockets, or generic provider abstraction
  framework.

Also document that Gemini Files API references are provider-retained resources,
not permanent application storage.

Local book text remains the durable source of truth.

An expired remote reference must require explicit reinitialization rather than a
silent automatic re-upload.

Before implementation:

1. revise the Phase 6 design;
2. list the exact schema changes;
3. show the atomic acquire/complete/fail/recover transitions;
4. list the tests;
5. identify whether `geminiBookInteractionId` is actually needed in this phase.

Do not modify files until I approve the revised plan.

---

## Review 2 correction

I approve the revised Files-API-only Phase 6 design with these final
simplifications.

### 1. Persisted state machine

Keep:

```text
IDLE
RUNNING
FAILED
READY
```

`READY` means that a Gemini file URI was successfully prepared and persisted.

It does not guarantee that the provider still retains the file indefinitely.

### 2. One provider operation only

Phase 6 has only one provider operation:

```text
Gemini Files API upload
```

Therefore, do not add an extra "persist URI while remaining RUNNING" transition
unless implementation evidence shows it is necessary.

Preferred success flow:

```text
atomic acquire
→ read local book
→ upload once
→ one conditional terminal update
→ persist geminiBookFileUri
→ set READY
```

All terminal mutations must still match:

- `projectId`
- `userId`
- `RUNNING` state
- acquisition timestamp

A zero-row terminal update is a persistence-transition error.

### 3. Avoid speculative states

Do not implement special `FAILED + existing URI` behavior unless the Phase 6
implementation can actually create that state.

Do not add speculative branches for impossible states.

### 4. Provider reference expiration

Gemini Files API references are temporary provider resources.

Local `book.txt` remains the durable source of truth.

Do not automatically check, refresh, or re-upload `READY` references in Phase 6.

Provider-expiration handling belongs to a later text-generation phase when the
URI is actually consumed.

### 5. Existing interaction field

`geminiBookInteractionId` remains nullable and unused.

Do not remove or repurpose it.

### 6. Concurrency testing

Tests must include a focused real SQLite/Drizzle repository concurrency test
proving that two callers cannot both acquire initialization.

Implement Phase 6 test-first.

Do not add:

- style generation;
- character generation;
- image generation;
- automatic Gemini retry;
- queues;
- Redis;
- workers;
- WebSockets;
- a generic provider framework.

Use the official Google GenAI JavaScript SDK for the concrete adapter.

Automated tests must inject a fake adapter and consume zero Gemini quota.

Before finishing, run:

- API typecheck;
- API tests;
- API build;
- root `npm test`;
- `git diff --check`.

Summarize:

- changed files;
- migration;
- state transitions;
- tests;
- remaining provider-expiration risk.

Do not commit or push.

---

## Review 3 correction

Phase 6 is approved overall.

Before final acceptance, add two focused service tests without changing
production behavior.

### 1. Missing or unreadable local book

Verify:

- `storage.readBook()` fails;
- Gemini adapter is never called;
- the acquired operation becomes `FAILED`;
- the safe application error is persisted and returned.

### 2. Lost terminal READY transition

Verify:

- upload succeeds;
- `repository.complete()` returns `false`;
- initialization returns the expected `500` persistence-transition error;
- the service does not blindly overwrite the state with `FAILED`;
- the operation remains `RUNNING`;
- its acquisition timestamp remains available for explicit stale recovery.

If straightforward, also add a non-stale `RUNNING` recovery rejection test.

Do not change the architecture or Gemini adapter.

Afterward run:

- API typecheck;
- API tests;
- API build;
- root `npm test`;
- `git diff --check`.

Do not commit or push.

---

## Final review

The final Phase 6 review focused on failure handling, concurrency, ownership,
and cost control.

The following behaviors were explicitly verified:

- missing Gemini configuration causes no state mutation and no provider call;
- the first initialization uploads the local book once and reaches `READY`;
- repeated initialization from `READY` performs zero Gemini calls;
- concurrent initialization attempts result in only one successful database
  acquisition;
- upload failure moves the operation to `FAILED` without automatic retry;
- retry from `FAILED` requires another explicit initialization request;
- stale `RUNNING` work is explicitly recoverable;
- non-stale `RUNNING` work cannot be recovered;
- a missing or unreadable local book fails before any Gemini call;
- a lost terminal `READY` persistence transition returns a persistence error
  without blindly overwriting the state;
- another user cannot initialize or recover the Gemini book reference for a
  project they do not own;
- normal project DTOs continue to hide Gemini provider identifiers.

No production behavior or architecture was changed during the final review.

---

## Final outcome

Phase 6 implements a small, user-triggered Gemini book preparation boundary.

It deliberately prepares only a reusable Gemini Files API reference and does
not generate any pipeline output.

The state machine is:

```text
IDLE / FAILED
→ explicit initialization
→ RUNNING
→ READY
```

Failure:

```text
RUNNING
→ upload/read failure
→ FAILED
```

Recovery:

```text
stale RUNNING
→ explicit recovery
→ FAILED
```

A later retry requires another explicit initialization request.

### Gemini preparation flow

The successful path is:

```text
authenticated request
→ validate Gemini configuration
→ owned project lookup
→ atomic database acquisition
→ read durable local book
→ one Gemini Files API upload
→ conditional terminal persistence
→ READY + geminiBookFileUri
```

Only the request that successfully acquires the operation may call the Gemini
adapter.

All repository mutations are scoped by:

```text
projectId
+
userId
```

and terminal transitions additionally verify:

```text
RUNNING state
+
exact acquisition timestamp
```

A zero-row terminal transition is treated as a persistence/state-transition
error rather than being reported as success.

### Persisted data

The project schema adds:

```text
geminiBookState
geminiBookStartedAt
geminiBookError
```

The existing field:

```text
geminiBookFileUri
```

stores the opaque provider file reference returned by the Gemini Files API.

The existing:

```text
geminiBookInteractionId
```

remains nullable and unused.

No provider interaction/cache identifier is invented solely to populate that
field.

### Durable source of truth

The local persisted book remains the durable application source of truth:

```text
data/books/<userId>/<projectId>/book.txt
```

The Gemini file URI is a provider-retained reference rather than permanent
application storage.

`READY` therefore means:

> A Gemini file reference was successfully prepared and persisted.

It does not mean:

> The provider guarantees that the remote file will remain valid forever.

Phase 6 intentionally does not:

- check provider retention on every request;
- silently refresh the remote reference;
- silently re-upload an expired reference;
- automatically retry Gemini calls.

Provider-expiration handling is deferred until a later generation phase where
the URI is actually consumed.

### Cost-control behavior

Phase 6 limits Gemini usage by design:

- project creation makes no Gemini call;
- application startup makes no Gemini call;
- list/detail requests make no Gemini call;
- initialization is explicitly user-triggered;
- only one concurrent initializer can acquire the operation;
- a successfully prepared `READY` reference results in zero repeat uploads;
- automated tests always use fake adapters;
- failures are never automatically retried.

### Concrete Gemini adapter

The production adapter uses the official Google GenAI JavaScript SDK.

Its responsibility is intentionally small:

```text
book text
→ Gemini Files API upload
→ opaque file URI
```

It does not implement style generation, character generation, image generation,
provider-independent abstractions, retries, queues, or background processing.

### Testing

Tests use fake adapters and isolated SQLite/libSQL databases.

The final suite verifies:

- first upload and `READY` persistence;
- idempotent `READY` initialization;
- missing API key protection;
- upload failure;
- explicit retry;
- stale recovery;
- non-stale recovery rejection;
- missing local book behavior;
- lost terminal persistence ownership;
- real database concurrency;
- database ownership enforcement;
- cross-user HTTP protection.

Automated tests consume zero Gemini quota.

### Final verification

The final Phase 6 verification completed successfully:

```text
API typecheck   PASS
API tests       30 / 30 PASS
API build       PASS
Root npm test   PASS
git diff --check PASS
```

No commit or push was performed during the implementation or review process.