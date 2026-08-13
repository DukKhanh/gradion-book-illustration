# Architecture

## Overview

The backend is a modular monolith using reduced Clean Architecture principles. Business modules define the small capabilities they require through ports/contracts, while Google Gemini and filesystem storage are implemented in the infrastructure layer. The composition root connects both sides with constructor injection.

## Dependency flow

```text
HTTP
 ↓
Route
 ↓
Controller
 ↓
Service / Pipeline Executor
 ↓
Port
 ↑
Infrastructure Adapter
 ↓
External System
```

For generation:

```text
Pipeline Executor → Generation Port ← Google Gemini Adapter → Google Gemini API
                                                      ├─ Files API: reusable book reference
                                                      └─ generateContent: stateless generation
```

For durable files:

```text
Project / Artifact Service → Storage Port ← FileStorageService → Filesystem
```

## Backend structure

```text
apps/api/src/
├── composition/
│   └── create-application-modules.ts
├── config/
├── db/
├── infrastructure/
│   ├── gemini/
│   └── storage/
├── modules/
│   ├── gemini-book/
│   ├── pipeline/
│   ├── projects/
│   └── session/
├── shared/
├── app.ts
└── server.ts
```

Each module contains only the responsibilities it needs, such as routes, controllers, services, repositories, schemas, ports, and tests. Ports live beside their consumers so the application, rather than an external provider, defines the required capability.

`create-application-modules.ts` is the composition root. It creates repositories and infrastructure adapters, then injects them into controllers, services, and pipeline executors. `app.ts` only configures Express, middleware, routes, and error handling.

## Pipeline

```text
STYLE → CHARACTERS → PORTRAITS → CHAPTERS → ILLUSTRATIONS
```

Pipeline progress and execution state are persisted separately through `completedStep`, `runningStep`, `stepState`, `stepStartedAt`, and `stepError`. The backend atomically acquires a step before calling Gemini; failed and stale work remains explicitly recoverable and retryable.

## Persistence and integrations

- Repositories use Drizzle and SQLite for users, projects, pipeline state, characters, and chapters.
- `FileStorageService` persists book text, portraits, and illustrations using the existing local path layout.
- Google Gemini adapters implement the book-reference and generation ports with `gemini-3.6-flash` for text and `gemini-3.1-flash-lite-image` for images.
- The application owns workflow state. Gemini Files API provides only a reusable temporary book reference; STYLE, CHARACTERS, PORTRAITS, CHAPTERS, and ILLUSTRATIONS generation use stateless `models.generateContent()` requests reconstructed from persisted application data.
- No pipeline step depends on `previous_interaction_id` or provider-retained conversation history.
- Automated tests mock ports for business behavior and test filesystem/Gemini implementations independently where appropriate.

This is intentionally not full Clean Architecture, DDD, or a DI framework. The structure keeps concrete external details outside business modules without adding unnecessary layers.


## State ownership

```text
Application
├── SQLite
│   ├── pipeline checkpoints
│   ├── style
│   ├── characters
│   └── chapters
└── Filesystem
    ├── book.txt
    ├── portraits
    └── illustrations

Gemini
└── temporary Files API book reference + stateless generateContent calls
```

A downstream step depends on durable application-owned results, not on Gemini retaining the interaction that produced them.
