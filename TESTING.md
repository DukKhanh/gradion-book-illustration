# Testing Strategy

The test suite focuses on the behavior that matters most for the assessment: pipeline correctness, resumability, failure handling, persisted state, incremental artifact visibility, portrait-reference reuse, ownership, and the frontend states exposed to the user.

Automated tests do not make real Gemini API calls or consume Gemini quota.

## Backend

Backend tests focus on the state transitions, ownership rules, storage behavior, and persistence guarantees that protect the generation workflow.

Covered areas include:

- pipeline step ordering;
- prevention of duplicate or concurrent step execution;
- retry behavior after failures;
- stale-running-step recovery;
- server-side character and chapter limits;
- incremental persistence of generated results;
- Gemini book preparation and recovery;
- STYLE generation and manual style handling;
- structured character and chapter generation;
- portrait generation and image validation;
- chapter illustration generation;
- durable checkpoints for completed image work;
- project ownership and authenticated project access;
- HTTP/controller behavior around pipeline operations;
- safe project-detail DTO exposure;
- full source-book retrieval through an authenticated owner-only endpoint;
- source book storage-read failure handling;
- prevention of filesystem path exposure in public responses;
- persisted portrait lookup for final illustration generation;
- validation that final illustrations reuse durable portrait image references;
- failure before Gemini execution when required portrait references are unavailable;
- preservation of existing durable illustration checkpoints during retry/recovery paths.

The backend tests use fake or mocked Gemini boundaries so failure and recovery paths can be exercised deterministically without paid API calls.

## Frontend

Frontend tests focus on the user-visible states and explicit actions that control the persisted backend workflow.

Covered areas include:

- session bootstrap and authentication state;
- project list and empty state;
- project creation from pasted text;
- project creation from `.txt` upload;
- mutually exclusive paste/upload sources;
- project library created-date rendering;
- workspace loading;
- persisted pipeline progress;
- five-step pipeline stepper state;
- explicit Gemini book preparation;
- explicit pipeline generation actions;
- optional manual STYLE submission;
- AI STYLE behavior when no manual style is supplied;
- running state;
- failure and retry state;
- stale-step recovery;
- next-step derivation from persisted pipeline state;
- prevention of duplicate actions while a mutation is pending;
- rendering persisted character portraits and chapter illustrations;
- session-expiration handling;
- lazy loading of the full source-book text only after explicit user interaction;
- reuse of cached source-book text after closing and reopening the disclosure;
- focused project-detail polling while PORTRAITS generation is pending;
- prevention of portrait polling for unrelated pipeline steps.

Workspace rendering itself does not trigger generation calls.

## Incremental Portrait Progress

Portrait generation is checkpointed character by character on the backend.

During an explicit PORTRAITS generation request, the frontend performs focused polling of the active project-detail query so newly persisted portrait state can become visible before the entire PORTRAITS step finishes.

The polling behavior is intentionally limited:

- it starts only after the user explicitly starts PORTRAITS;
- it refreshes only the active project-detail query;
- it does not poll the project library;
- it does not make Gemini calls;
- it does not fabricate progress percentages;
- it stops when the PORTRAITS mutation settles or the component is unmounted.

This allows the UI to surface persisted per-character states such as:

```text
PENDING
RUNNING
DONE
FAILED
```

and show a completed portrait as soon as its durable backend checkpoint is available.

## Portrait Reuse in Final Illustrations

The ILLUSTRATIONS step reuses the durable portrait JPEGs generated earlier in the pipeline.

Before the Gemini image call, the backend:

- loads the persisted characters for the project;
- verifies that required portrait generation completed successfully;
- verifies that durable portrait paths are available;
- reads the portrait JPEGs from local storage;
- supplies those images as multimodal references to the Gemini image adapter;
- combines the chapter prompt and persisted style with the portrait references.

This preserves the intended character identity across portrait and chapter illustration generation without relying only on text prompts or ephemeral client state.

Tests verify that:

- valid persisted portrait references are passed into the illustration adapter;
- portrait references are included in the generated Gemini request;
- missing or invalid portrait prerequisites prevent the Gemini call;
- no illustration checkpoint is created from invalid provider output;
- durable completed work remains reusable during retry/recovery paths.

## Full Book Text

The original source book remains stored privately on the backend.

The frontend loads it through an authenticated project-owned endpoint only after the user explicitly opens the Book Text disclosure.

The full text is not embedded in the normal project-detail response. This avoids repeatedly transferring the manuscript during portrait-progress polling.

The Book Text UI preserves the complete source text and allows it to be read through a scrollable disclosure without truncating the underlying content.

## Gemini

Automated tests mock or fake Gemini integrations.

No automated test performs a real Gemini text or image generation request.

Real Gemini calls are reserved for controlled manual UAT so that:

- API quota is not consumed by repeated automated runs;
- failure paths can be tested deterministically;
- tests remain fast and repeatable;
- paid generation calls remain explicitly user-driven.

## Deliberately Not Tested

The automated suite does not attempt to validate:

- the artistic quality of Gemini-generated images;
- the semantic quality of generated art direction;
- the subjective visual consistency of characters across generated images;
- the quality of character or chapter prompts produced by Gemini;
- real Gemini availability, latency, or provider-side rate limits;
- browser-level pixel-perfect responsive behavior;
- production deployment behavior.

These areas either depend on an external AI provider, require subjective visual review, or are outside the assessment scope.

Real generation and responsive UI behavior are therefore checked separately through manual UAT.

## Final Test Report

The following results were captured from a real local verification run from the repository root.

### Automated Tests

Command:

```bash
npm test
```

Actual result:

```text
> gradion-book-illustration@1.0.1 test
> npm run test --workspace=apps/api && npm run test --workspace=apps/web

> @gradion/api@1.0.0 test
> vitest run --exclude dist/**

Test Files  26 passed (26)
Tests       120 passed (120)
Duration    3.81s

> web@0.0.0 test
> vitest run --passWithNoTests

Test Files  5 passed (5)
Tests       34 passed (34)
Duration    8.28s
```

### Result Summary

- Backend: **26 test files, 120/120 tests passed**
- Frontend: **5 test files, 34/34 tests passed**
- Total: **31 test files, 154/154 tests passed**
- Failed tests: **0**
- Real Gemini calls during automated tests: **0**

Compared with the earlier verification baseline, the suite now additionally covers:

- authenticated full source-book retrieval;
- project ownership protection for source-book access;
- safe source-book read failure behavior;
- lazy Book Text loading;
- Book Text cache reuse;
- focused PORTRAITS polling;
- prevention of polling for unrelated pipeline steps;
- project library created-date rendering;
- persisted portrait-reference lookup for ILLUSTRATIONS;
- portrait-reference propagation into the Gemini image request;
- illustration execution guards when portrait prerequisites are incomplete.

One backend negative-path test intentionally emits an error log while verifying that a non-JPEG portrait result is rejected without creating a durable checkpoint:

```text
Portrait generation failed. {
  projectId: 'project-1',
  characterId: 'one',
  error: 'Invalid portrait image.'
}
```

This is expected test behavior, not a failed test. The corresponding portrait executor test suite passes successfully.

## Typecheck Verification

Command:

```bash
npm run typecheck
```

Actual result:

```text
> gradion-book-illustration@1.0.1 typecheck
> npm run typecheck --workspace=apps/api && npm run typecheck --workspace=apps/web

> @gradion/api@1.0.0 typecheck
> tsc --noEmit

> web@0.0.0 typecheck
> tsc -b
```

Result:

- API typecheck: **passed**
- Web typecheck: **passed**

## Production Build Verification

Command:

```bash
npm run build
```

Actual result:

```text
> gradion-book-illustration@1.0.1 build
> npm run build --workspace=apps/api && npm run build --workspace=apps/web

> @gradion/api@1.0.0 build
> tsc

> web@0.0.0 build
> tsc -b && vite build

vite v8.2.1 building client environment for production...
✓ 86 modules transformed.
computing gzip size...
dist/index.html                   0.45 kB │ gzip:  0.28 kB
dist/assets/index-D7s7wPce.css   14.75 kB │ gzip:  3.60 kB
dist/assets/index-R0eTlG-d.js   287.62 kB │ gzip: 89.11 kB

✓ built in 219ms
```

Result:

- API production build: **passed**
- Web production build: **passed**

## Git Diff Verification

Command:

```bash
git diff --check
```

Result:

```text
No output.
```

An empty result from `git diff --check` means no whitespace errors were detected in the current diff.

## Final Verification Summary

The latest local verification completed successfully:

```text
Automated tests     154 / 154 passed
Backend test files   26 / 26 passed
Frontend test files   5 / 5 passed
Typecheck                  passed
API build                   passed
Web build                   passed
git diff --check            passed
Real Gemini test calls           0
```

## Manual UAT

Real Gemini integration is validated separately through controlled manual testing of the user-driven pipeline:

```text
Prepare book
→ STYLE
→ CHARACTERS
→ PORTRAITS
→ CHAPTERS
→ ILLUSTRATIONS
```

Manual UAT checks that:

- each generation step requires an explicit user action;
- completed work remains persisted after refresh;
- only the next eligible step can run;
- running steps expose their specific state;
- failures remain retryable;
- stale runs have an explicit recovery path;
- the original source book remains readable in full from the workspace;
- opening and closing Book Text does not trigger generation;
- portrait generation shows per-character persisted progress;
- the first completed portrait can appear before the full PORTRAITS request finishes;
- already durable portraits remain available during retry;
- final illustration generation uses the persisted portrait references;
- character appearance remains reasonably consistent between portrait and final illustration during real Gemini UAT;
- portraits appear from backend-provided authenticated URLs;
- chapter illustrations appear from backend-provided authenticated URLs;
- no pipeline step automatically chains into the next step;
- no automatic Gemini retry is performed;
- refreshing the workspace does not start generation;
- artifact rendering does not start generation.

Responsive behavior is reviewed manually at representative viewport widths such as:

```text
390px
768px
1366px
1440px
1920px
```

The responsive review focuses on:

- project library layout;
- workspace heading and progress;
- generation action panel;
- Book Text disclosure;
- character cards and portrait states;
- prompt disclosures;
- chapter card collapsed and expanded states;
- prevention of horizontal overflow.