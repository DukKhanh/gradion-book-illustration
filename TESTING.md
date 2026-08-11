# Testing Strategy

The test suite focuses on the behavior that matters most for the assessment: pipeline correctness, resumability, failure handling, persisted state, and the frontend states exposed to the user.

Automated tests do not make real Gemini API calls or consume Gemini quota.

## Backend

Backend tests focus on the state transitions and persistence rules that protect the generation workflow.

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
- HTTP/controller behavior around pipeline operations.

The backend tests use fake or mocked Gemini boundaries so failure and recovery paths can be exercised deterministically without paid API calls.

## Frontend

Frontend tests focus on the user-visible states and actions that control the persisted backend workflow.

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
- session-expiration handling.

Workspace rendering itself does not trigger generation calls.

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
- browser-level end-to-end visual behavior;
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
> gradion-book-illustration@1.0.0 test
> npm run test --workspace=apps/api && npm run test --workspace=apps/web

> @gradion/api@1.0.0 test
> vitest run --exclude dist/**

Test Files  26 passed (26)
Tests       109 passed (109)
Duration    4.22s

> web@0.0.0 test
> vitest run --passWithNoTests

Test Files  3 passed (3)
Tests       29 passed (29)
Duration    7.02s
```

### Result Summary

- Backend: **26 test files, 109/109 tests passed**
- Frontend: **3 test files, 29/29 tests passed**
- Total: **29 test files, 138/138 tests passed**
- Failed tests: **0**
- Real Gemini calls during automated tests: **0**

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

Phase 14 also verified the repository beyond the automated test suite with:

```bash
npm run typecheck
npm run build --workspace=apps/api
npm run build --workspace=apps/web
git diff --check
```

The API and web typechecks, production builds, root test suite, and Git diff checks completed successfully.

Database migration behavior was additionally verified against an isolated fresh database without modifying the developer database.

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
- portraits appear from persisted backend URLs;
- chapter illustrations appear from persisted backend URLs;
- no pipeline step automatically chains into the next step;
- no automatic Gemini retry is performed.

Responsive behavior is reviewed manually at representative mobile, tablet, and desktop viewport widths.