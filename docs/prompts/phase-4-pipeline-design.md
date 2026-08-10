# Phase 4 — Pipeline Engine Design

## Initial prompt

Read this repository and do not modify any files yet.

Focus on:
- AGENTS.md
- DECISIONS.md
- docs/architecture.md
- docs/plan.md
- apps/api/src/db/schema.ts
- apps/api/src/modules/pipeline/
- existing tests and package scripts

We are starting Phase 4: the backend pipeline engine for the Gradion take-home assessment.

Required pipeline:
STYLE -> CHARACTERS -> PORTRAITS -> CHAPTERS -> ILLUSTRATIONS

Hard requirements:
- steps run only in order
- every step is user-triggered
- only one step may be RUNNING for a project
- double-clicks, second tabs, refreshes, and concurrent HTTP requests must not cause duplicate Gemini calls
- failed steps must be retryable without rerunning completed steps
- stale RUNNING steps must be recoverable
- maximum 2 adult characters
- maximum 1 chapter
- no automatic Gemini retry
- no real Gemini integration in this phase
- keep the reduced Clean Architecture already documented
- do not introduce Redis, queues, distributed locks, microservices, or unnecessary abstractions

First:
1. inspect the current repository,
2. explain the Phase 4 design you recommend,
3. identify the invariants that need tests,
4. list the exact files you expect to add or modify,
5. point out any risk or flaw in the existing data model.

Do not edit files until I approve the plan.

## Review correction

I reviewed the plan and approve the overall direction, with these corrections.

1. FAILED state must preserve which step failed.

The current schema has no failedStep column. Therefore, when execution fails,
do not clear runningStep. Use:

completedStep = previous completed step
runningStep = failed step
stepState = FAILED
stepStartedAt = null
stepError = safe error message

On successful completion only, clear runningStep and return to IDLE.

A stale RUNNING recovery should also transition to FAILED while preserving
runningStep so the user can retry exactly that step.

2. Keep business validation in PipelineService, but the final concurrency guard
must be an atomic conditional UPDATE in PipelineRepository. Only a request whose
UPDATE affects exactly one row may invoke the executor.

3. Do not add character/chapter CRUD APIs in Phase 4.

However, inspect whether small SQLite CHECK/UNIQUE constraints can safely enforce:
- character positions only 0 or 1;
- chapter position only 0;
- valid pipeline step/state values.

Do this only if the migration remains simple. Adult-character validation remains
a later service/Gemini concern.

4. Fix the repository verification issue:
the root npm test command must succeed even though frontend feature tests have not
been implemented yet. Use the smallest temporary test configuration necessary;
do not create fake meaningful frontend tests.

5. Update .env.example to:
GEMINI_TEXT_MODEL=gemini-3.6-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-lite-image

6. Update docs/plan.md so Phase 3 is completed and Phase 4 is current.

Now implement Phase 4 test-first.

No Gemini integration.
No Redis, queues, WebSockets, background workers, or attempt-history tables.

Before finishing:
- run API typecheck;
- run API tests;
- run API build;
- run root npm test;
- summarize every changed file;
- explain the atomic acquisition query;
- explain how FAILED and stale states work;
- identify any remaining risks.

Do not commit or push.

## Outcome

The initial design was mostly accepted.

One important correction was made:
a failed execution must preserve the failed step in `runningStep`,
otherwise the current schema cannot identify which step should be retried.

The database-backed atomic acquisition strategy was retained because it
directly satisfies the assessment's duplicate-call and concurrency requirements.

The implementation was then updated before coding continued.

## Second review

After the first implementation, I reviewed the pipeline behavior again and
identified three correctness gaps:

- successful executor completion could be reported even if the final database
  transition failed;
- executor failure could be reported without verifying that the FAILED state
  was actually persisted;
- concurrency was covered by an in-memory repository test but not by the real
  SQLite/Drizzle repository.

I asked Codex to correct these issues before accepting the implementation.

I also changed the synchronous run endpoint from `202 Started` to
`200 Completed`, because the request waits for the executor and persistence
transition to finish before returning.

## Final outcome

The final Phase 4 implementation:

- uses an atomic conditional database update for step acquisition;
- allows only one concurrent request to acquire a step;
- invokes the executor only after successful acquisition;
- preserves the failed step for explicit retry;
- supports explicit stale-run recovery;
- detects failed success/failure persistence transitions;
- keeps execution synchronous for this phase;
- does not introduce automatic retries, queues, Redis, workers, or Gemini
  integration.

Verification completed successfully:

- API typecheck;
- API tests;
- API build;
- root test command;
- `git diff --check`.

The final API test suite contained 9 passing tests across 3 test files.