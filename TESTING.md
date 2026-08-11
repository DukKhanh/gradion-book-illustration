# Testing Strategy

## Backend

Focus on:
- pipeline ordering;
- concurrency;
- retry;
- stale recovery;
- server-side limits;
- incremental persistence.

## Frontend

Focus on:
- empty state;
- running state;
- error state;
- stale state;
- completed state.

## Gemini

Automated tests mock Gemini.

Real Gemini is used only for controlled manual UAT.

## Final Test Report

Phase 14 verification is run from the root workspace using the documented API,
web, root, migration, and diff commands. Automated tests use fake or mocked
Gemini boundaries and consume no Gemini quota.

The final command outcomes are recorded in the Phase 14 prompt document.
