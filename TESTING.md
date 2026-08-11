# Testing Strategy

The test suite focuses on the behavior that matters most for the assessment: pipeline correctness, resumability, failure handling, persisted state, incremental artifact visibility, and the frontend states exposed to the user.

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
- prevention of filesystem path exposure in public responses.

The backend tests use fake or mocked Gemini boundaries so failure and recovery paths can be exercised deterministically without paid API calls.

## Frontend

Frontend tests focus on the user-visible states and explicit actions that control the persisted backend workflow.

Covered areas include:

- session bootstrap and authentication state;
- project list and empty state;
- project creation from pasted text;
- project creation from `.txt` upload;
- mutually exclusive paste/upload sources;
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
- the quality of character or chapter prompts produced by Gemini;
- real Gemini availability, latency, or provider-side rate limits;
- subjective visual consistency between generated portraits and chapter illustrations;
- browser-level pixel-perfect responsive behavior;
- production deployment behavior.

These areas either depend on an external AI provider, require subjective visual review, or are outside the assessment scope.

Real generation and responsive UI behavior are therefore checked separately through manual UAT.

## Final Test Report

The following results were captured from a real local test run from the repository root.

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
Tests       115 passed (115)
Duration    5.05s

> web@0.0.0 test
> vitest run --passWithNoTests

Test Files  5 passed (5)
Tests       33 passed (33)
Duration    9.75s
```

### Result Summary

- Backend: **26 test files, 115/115 tests passed**
- Frontend: **5 test files, 33/33 tests passed**
- Total: **31 test files, 148/148 tests passed**
- Failed tests: **0**
- Real Gemini calls during automated tests: **0**

Compared with the earlier Phase 14 baseline, the suite now additionally covers:

- authenticated full source-book retrieval;
- project ownership protection for source-book access;
- safe source-book read failure behavior;
- lazy Book Text loading;
- Book Text cache reuse;
- focused PORTRAITS polling;
- prevention of polling for unrelated pipeline steps.

One backend negative-path test intentionally emits an error log while verifying that a non-JPEG portrait result is rejected without creating a durable checkpoint:

```text
Portrait generation failed. {
  projectId: 'project-1',
  characterId: 'one',
  error: 'Invalid portrait image.'
}
```

This is expected test behavior, not a failed test. The corresponding portrait executor test suite passes successfully.

## Additional Verification

The repository should also be verified beyond the automated test suite with:

```bash
npm run typecheck --workspace=apps/api
npm run build --workspace=apps/api

npm run typecheck --workspace=apps/web
npm run build --workspace=apps/web

npm run typecheck
git diff --check
```

The final submission should keep these checks passing alongside the root test suite.

Database migration behavior should continue to be verified against an isolated fresh database without modifying the developer database.

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