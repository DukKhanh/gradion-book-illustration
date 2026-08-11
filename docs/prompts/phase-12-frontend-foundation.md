# Phase 12 — Frontend Foundation & Project Flow

## Initial Prompt

Read the current repository and do not modify files yet.

We are starting Phase 12: Frontend Foundation & Project Flow.

The backend generation pipeline is complete:

```text
STYLE
→ CHARACTERS
→ PORTRAITS
→ CHAPTERS
→ ILLUSTRATIONS
```

Phase 12 starts the production frontend implementation.

The main UI/product reference is:

```text
docs/reference/app-demo.html
```

Treat `app-demo.html` as a visual and product-behavior reference only.

Do not copy:

- fake timers;
- fake users or projects;
- localStorage persistence;
- simulated generation;
- client-side pipeline transitions;
- fake images;
- demo stale-recovery behavior.

The production frontend must use real backend APIs and persisted server state.

Do not modify files until the Phase 12 design is reviewed and approved.

Do not commit or push.

---

## Scope

Phase 12 covers:

- application shell;
- session identity;
- session restoration;
- sign out;
- project library;
- project creation;
- pasted book text;
- `.txt` upload;
- project workspace foundation;
- persisted pipeline progress display;
- persisted artifact rendering;
- loading, error, and empty states;
- responsive foundation;
- real backend API integration.

Phase 12 does not implement generation controls.

The interactive generation workflow belongs to Phase 13:

```text
STYLE
→ CHARACTERS
→ PORTRAITS
→ CHAPTERS
→ ILLUSTRATIONS
```

Do not add:

- Gemini-book initialization controls;
- manual STYLE submission;
- pipeline run buttons;
- retry controls;
- stale recovery controls;
- automatic generation.

---

## Repository Inspection

Before proposing implementation, inspect:

- the current monorepo/workspace structure;
- `apps/web`;
- frontend package configuration and dependencies;
- frontend routing, styling, and test setup;
- backend session routes and DTOs;
- project routes and DTOs;
- project-detail DTO;
- persisted pipeline fields;
- portrait and illustration retrieval behavior;
- `docs/reference/app-demo.html`;
- `docs/plan.md`;
- `DECISIONS.md`.

Do not assume the frontend framework, dependencies, API endpoints, or backend
development port without checking the repository.

Reuse existing dependencies and conventions where practical.

Do not add a UI framework, state-management library, form library, data library,
or second test framework unless a concrete requirement requires one.

---

## Reference Behavior

Inspect `docs/reference/app-demo.html` and identify the relevant product behavior
and visual language, including:

- sticky application header;
- product branding;
- Projects navigation;
- authenticated user identity;
- sign out;
- welcome/identity state;
- project library;
- project creation;
- project workspace;
- project cards;
- five-step pipeline progress;
- status pills;
- typography;
- spacing;
- colors;
- borders;
- radii;
- forms and buttons;
- character cards;
- chapter cards;
- responsive behavior.

The reference is a product/UI reference, not an architecture reference.

Production state must come from the backend.

---

## Expected Routes

Use the smallest route structure supported by the existing frontend.

Expected routes are:

```text
/
→ identity / welcome

/projects
→ project library

/projects/new
→ create project

/projects/:projectId
→ project workspace
```

Protected routes must wait for session bootstrap before deciding whether to
redirect.

Required deep-link behavior:

```text
direct load /projects/:projectId
→ check server session
→ authenticated
→ load workspace
```

or:

```text
→ unauthenticated
→ redirect /
```

Do not redirect while the initial session request is still pending.

An already authenticated user visiting `/` should be redirected to `/projects`.

---

## Session Identity

Use the existing Phase 5 server-side session implementation.

Do not introduce:

- JWT storage;
- refresh tokens;
- passwords;
- OAuth;
- localStorage authentication tokens;
- client-generated authentication state.

Authentication remains cookie/session based.

Frontend requests must support the existing session cookie.

Use the session API as the source of truth.

The session lifecycle should represent:

```text
checking
authenticated
unauthenticated
```

Do not maintain a second independent copy of the authenticated user in local
React state.

If TanStack Query is already available, server-owned session state should remain
authoritative there.

---

## Identity Flow

Use the existing backend identity endpoint.

Expected behavior:

```text
name + email
→ POST session
→ server creates/reuses identity
→ session established
→ navigate to project library
```

The backend remains authoritative for validation and existing-email behavior.

Prevent duplicate submissions while pending.

Display safe backend validation errors.

---

## Sign Out

Sign out must call the backend session endpoint.

Expected behavior:

```text
Sign out
→ server destroys session
→ clear protected frontend server state
→ unauthenticated
→ /
```

Do not merely clear local frontend state while leaving the backend session
active.

---

## HTTP/API Boundary

Create or reuse a small frontend API boundary.

Prefer approximately:

```text
API client
├── session API
└── projects API
```

Do not scatter raw HTTP handling throughout page components.

Requests should use the existing relative backend contract:

```text
/api/...
```

and include session credentials where required.

Normalize unsuccessful HTTP responses into a small frontend error contract
containing at least:

```ts
{
  status: number
  message: string
}
```

Do not build a large interceptor framework.

---

## Authenticated 401 Handling

Session expiration during an authenticated project operation must not leave the
frontend believing the old user is still authenticated.

Required behavior:

```text
authenticated project request
→ 401
→ authoritative session state becomes unauthenticated
→ protected server queries are cleared/invalidated
→ protected routing returns to /
```

Do not repeat page-level:

```text
if status === 401
```

logic throughout the application.

Use one small centralized mechanism around the API/query boundary.

---

## Development API Proxy

Inspect the actual backend development port before configuring Vite.

Frontend requests should remain:

```text
/api/...
```

For local development, configure the Vite proxy using the repository's actual
API target.

If the target is environment-configurable, load:

```text
VITE_API_PROXY_TARGET
```

using the appropriate Vite configuration mechanism.

Do not store Markdown-formatted URLs or assume an unverified backend port.

---

## Project Library

Use the existing authenticated project-list endpoint.

The frontend must display only projects returned by the backend.

Do not implement client-side ownership filtering.

Project cards should show useful persisted information such as:

- title;
- relevant date/subtitle if available;
- five-step progress;
- Draft / In progress / Done state.

Do not use fake projects in the production path.

---

## Pipeline Progress

Define the canonical pipeline order once:

```text
STYLE
CHARACTERS
PORTRAITS
CHAPTERS
ILLUSTRATIONS
```

Use a pure helper to derive display progress from the persisted pipeline DTO.

Expected examples:

```text
completedStep = null
→ 0 / 5

completedStep = STYLE
→ 1 / 5

completedStep = CHARACTERS
→ 2 / 5

completedStep = PORTRAITS
→ 3 / 5

completedStep = CHAPTERS
→ 4 / 5

completedStep = ILLUSTRATIONS
→ 5 / 5
```

A currently `RUNNING` or `FAILED` step must not count as completed until
`completedStep` advances.

Do not derive completion from artifact presence.

For example, do not use:

```text
characters.length > 0
→ CHARACTERS completed
```

or:

```text
chapters.length > 0
→ CHAPTERS completed
```

The backend pipeline state remains authoritative.

---

## Create Project

Use the existing project creation API.

The user must provide a title and exactly one book source:

```text
Paste text
```

or:

```text
Upload .txt
```

The two source modes must be mutually exclusive.

Switching modes must clear the inactive source.

The submitted request must contain exactly one of:

```text
bookText
bookFile
```

Never submit both.

Do not silently merge them.

---

## Pasted Book Text

Provide a usable text area consistent with the reference.

Whitespace-only input must not be submitted as valid content.

Frontend validation is for UX only.

Backend validation remains authoritative.

Do not invent arbitrary book-length restrictions unless the backend already
defines them.

---

## TXT Upload

Accept `.txt` only.

The browser filename is display metadata only.

Do not:

- derive server paths from the filename;
- upload directly to Gemini;
- process the book for AI in the browser;
- persist the book in frontend storage.

Submit the file through the existing project API.

The backend remains responsible for durable local storage and validation.

---

## Project Creation Success

After successful creation:

```text
create project
→ update/invalidate project library
→ navigate to created project workspace
```

Prevent accidental duplicate submissions while the request is pending.

---

## Project Workspace

Build the real workspace shell based on `app-demo.html`.

The workspace should load persisted project detail from the backend and may
render existing:

- project title;
- pipeline progress;
- STYLE;
- character cards;
- portrait URLs;
- chapter metadata;
- illustration URLs.

A project may already contain results from previous backend/manual testing.

Opening the project must render what actually exists.

Do not reconstruct generated data from local frontend state.

Do not erase existing persisted results.

---

## Generated Images

Use only safe backend-provided URLs:

```text
portraitUrl
illustrationUrl
```

Do not expose or derive images from:

- `imagePath`;
- local filesystem paths;
- `data/images`;
- Gemini identifiers.

With the relative `/api` contract, use the authenticated backend URLs directly
where supported.

Do not introduce Blob URL lifecycle management unless it is actually required.

---

## Workspace Read-Only Boundary

Phase 12 workspace is read-only with respect to generation.

Opening or refreshing the workspace must make zero pipeline/Gemini mutations.

Do not automatically:

- initialize the Gemini book reference;
- run STYLE;
- run CHARACTERS;
- run PORTRAITS;
- run CHAPTERS;
- run ILLUSTRATIONS;
- retry failed work;
- recover stale work.

Those actions belong to Phase 13.

---

## Frontend State Ownership

Keep server state server-authoritative.

Examples:

```text
session
projects
pipeline state
STYLE
characters
chapters
portrait availability
illustration availability
```

Local component state should be limited primarily to UI concerns such as:

- form input;
- selected book-source mode;
- temporary dialog/panel state;
- local navigation presentation.

Do not recreate the backend pipeline as a frontend state machine.

Do not add Redux, Zustand, or another global state system without a concrete
requirement.

---

## Styling

Replace the untouched Vite starter presentation with a small styling system
guided by `app-demo.html`.

Reuse visual concepts such as:

- paper background;
- white surfaces;
- dark ink text;
- Gradion orange accent;
- restrained borders;
- rounded cards;
- compact controls;
- progress segments;
- status pills.

Prefer a small set of reusable CSS tokens for recurring values.

Do not introduce a large design system.

Do not copy the demo's inline implementation directly into production React.

---

## Responsive Foundation

Phase 12 must establish responsive behavior.

At minimum consider:

```text
desktop
tablet
mobile
```

Avoid:

- horizontal overflow;
- off-screen actions;
- fixed layouts that break on smaller screens;
- overlapping cards;
- broken forms;
- unreadable text;
- unusable file controls.

The workspace should move toward a single-column presentation on narrow
screens, consistent with the reference.

Final visual polish remains Phase 14.

---

## Accessibility Baseline

Use semantic controls.

At minimum:

- buttons are real buttons;
- fields have labels;
- keyboard interaction works;
- loading/disabled states are understandable;
- form errors are associated with the relevant form;
- generated images use useful alt text where appropriate;
- focus-visible behavior remains usable.

Do not reproduce inaccessible demo patterns simply because they exist in the
reference.

---

## Testing

Use the frontend's existing test stack.

Do not add a second framework.

Tests should use mocked HTTP behavior and must make zero real Gemini calls.

Cover at least:

- session bootstrap pending state;
- authenticated bootstrap;
- unauthenticated bootstrap;
- identity success;
- identity validation/backend failure;
- sign out;
- authenticated `/` redirecting to `/projects`;
- protected deep-link waiting for session bootstrap;
- project library;
- empty project state;
- pipeline progress derivation;
- pasted-text project creation;
- `.txt` project creation;
- Upload → Paste does not submit stale `bookFile`;
- Paste → Upload does not submit stale `bookText`;
- project creation failure;
- workspace loading;
- rendering persisted STYLE/characters/chapters;
- rendering backend-provided portrait and illustration URLs;
- authenticated project request returning 401 makes the session unauthenticated;
- workspace mount performs no pipeline/Gemini mutation.

Prefer behavior-oriented tests over large snapshots.

---

## Cost Safety

Phase 12 must consume zero Gemini quota during normal implementation and
automated testing.

These actions must not initialize or call Gemini:

```text
session bootstrap
identity
project list
create project
open project
refresh project
render portrait
render illustration
```

Generation remains explicit and belongs to Phase 13.

---

## Backend Boundary

Do not modify backend production behavior merely for frontend convenience.

The backend already provides:

- session identity;
- project ownership;
- project creation;
- project detail;
- Gemini book initialization;
- pipeline execution;
- STYLE;
- CHARACTERS;
- PORTRAITS;
- CHAPTERS;
- ILLUSTRATIONS;
- authenticated generated-image retrieval.

If an actual API contract gap is discovered:

1. identify it;
2. explain why the current API cannot support the required frontend behavior;
3. propose the smallest backend change;
4. wait for review before implementing it.

---

## First Response Required

Before modifying files, return a Phase 12 design containing:

### Current frontend state

Explain:

- framework;
- build tooling;
- routing;
- styling;
- test setup;
- useful existing dependencies.

### Reference analysis

Summarize the relevant `app-demo.html` structure.

Separate real product behavior from demo-only behavior.

### API mapping

Map the UI to exact existing endpoints for:

- session bootstrap;
- identity;
- sign out;
- project list;
- project creation;
- project detail;
- generated image retrieval.

Do not guess endpoint names.

### Proposed architecture

Show the minimal frontend page/component/API organization.

### Session strategy

Explain:

- bootstrap;
- authenticated state;
- unauthenticated state;
- credentials;
- 401 handling;
- protected routes;
- sign out.

### Project flow

Explain:

- list;
- create from text;
- create from `.txt`;
- source exclusivity;
- open workspace;
- persisted-state reload;
- progress display.

### Styling strategy

Explain how `app-demo.html` will guide production styling without copying demo
architecture.

### Exact files

List files to:

- add;
- modify;
- delete, if any.

### Tests

List focused Phase 12 tests.

### Deferred scope

Explicitly identify Phase 13 work.

Do not edit files in this first response.

---

## Approval Gate

Wait for approval after presenting the design.

Do not implement Phase 12 until approved.

If repository evidence contradicts the approved plan during implementation,
report the issue instead of silently expanding scope.

Do not commit or push.

---

# Review Correction

The Phase 12 design was approved with the following corrections.

## Session Source of Truth

TanStack Query must remain the sole authoritative session source.

Do not maintain a second independent user copy in React state.

Protected routes must wait for session bootstrap before redirecting.

---

## Centralized 401 Handling

A `401` from an authenticated project operation must transition the
authoritative session query to unauthenticated.

Expected flow:

```text
project request
→ 401
→ session query becomes null
→ protected queries cleared
→ protected route redirects /
```

Do not add page-specific authentication handling.

---

## Vite Proxy

Use relative:

```text
/api
```

requests.

Load `VITE_API_PROXY_TARGET` through Vite configuration and use the verified
backend development target as the fallback.

Do not place Markdown-formatted URLs in configuration.

---

## Progress Correctness

Pipeline progress must use the canonical order and count only
`completedStep`.

`RUNNING` and `FAILED` work must not advance the completed count.

Add focused tests for this behavior.

---

## Project Source Exclusivity

Keep Paste and Upload mutually exclusive.

Explicitly test:

```text
Upload → Paste
→ no stale bookFile submitted

Paste → Upload
→ no stale bookText submitted
```

---

## Workspace Boundary

The workspace may display existing persisted generation results.

It must remain read-only for Phase 12.

Mounting the workspace must make zero pipeline/Gemini mutation requests.

---

# Implementation Outcome

Phase 12 frontend foundation and project flow were implemented.

The frontend now uses the existing React 19 + TypeScript + Vite application with
the dependencies already present in the repository.

No new UI framework or global client state library was introduced.

---

## Routes

Implemented:

```text
/
→ identity / welcome

/projects
→ project library

/projects/new
→ create project

/projects/:projectId
→ project workspace
```

Protected routes wait for the initial session query before deciding whether to
redirect.

An authenticated user visiting `/` is redirected to `/projects`.

Direct protected deep links survive refresh by waiting for server session
bootstrap.

---

## Session Behavior

TanStack Query remains the authoritative session source.

Session bootstrap uses the existing backend session endpoint.

Authenticated requests use cookie credentials.

Centralized `401` handling now:

```text
authenticated request
→ 401
→ session query becomes null
→ protected queries cleared
→ protected routing returns to /
```

No page-specific session-expiration handling is required.

Sign out destroys the backend session and clears protected frontend server
state.

---

## API Integration

The frontend uses a small API boundary for:

```text
session
projects
```

Requests remain relative:

```text
/api/...
```

HTTP failures are normalized into a small frontend error representation.

Vite uses `loadEnv()` for:

```text
VITE_API_PROXY_TARGET
```

with the verified local backend fallback.

No backend production behavior was changed.

---

## Project Library

The project library loads real authenticated projects from the backend.

Project progress is derived through a pure helper using:

```text
STYLE
CHARACTERS
PORTRAITS
CHAPTERS
ILLUSTRATIONS
```

Only `completedStep` advances the completed count.

The UI derives:

```text
Draft
In progress
Done
```

from persisted pipeline state rather than local interaction state.

---

## Project Creation

Project creation supports exactly one source:

```text
Paste text
```

or:

```text
Upload .txt
```

Switching source mode clears the inactive source.

Submitted `FormData` therefore contains exactly one of:

```text
bookText
bookFile
```

Successful creation updates the project data and opens the created workspace.

No Gemini initialization occurs during project creation.

---

## Project Workspace

The workspace loads real persisted project detail.

It can render existing:

- STYLE;
- character cards;
- portraits;
- chapter metadata;
- illustrations;
- pipeline progress.

Generated images use only backend-provided:

```text
portraitUrl
illustrationUrl
```

Internal filesystem paths and Gemini identifiers remain hidden.

Opening the workspace does not initialize Gemini or execute any pipeline step.

---

## Styling

The untouched Vite starter presentation was replaced with a responsive frontend
foundation guided by:

```text
docs/reference/app-demo.html
```

The implementation follows the reference's:

- paper/white/ink/orange visual direction;
- restrained cards and borders;
- project-library presentation;
- progress indicators;
- form layout;
- workspace structure;
- responsive single-column behavior.

The demo's fake state and simulated generation behavior were not copied.

---

## Tests

Frontend tests cover the Phase 12 behavior, including:

- session bootstrap;
- authentication states;
- identity;
- protected routing;
- project library;
- empty state;
- project creation;
- source exclusivity;
- progress derivation;
- project workspace;
- persisted artifact rendering;
- authenticated image URLs;
- session expiration;
- zero pipeline mutation on workspace mount.

Final frontend result:

```text
2 test files
11 tests passed
```

Backend regression suite:

```text
23 test files
101 tests passed
```

Automated tests make zero real Gemini calls.

---

## Verification

Passed:

```text
npm run typecheck --workspace=apps/web
npm run test --workspace=apps/web
npm run build --workspace=apps/web
npm test
npm run typecheck
git diff --check
```

Final automated verification:

```text
API
23 files
101 tests passed

Web
2 files
11 tests passed
```

No backend production behavior was changed.

No commit or push was performed.

---

## Manual Visual Verification

Automated implementation attempted to use the available browser-control
environment for the requested visual comparison.

No browser surface was available in that environment, so desktop/mobile visual
inspection against:

```text
docs/reference/app-demo.html
```

could not be honestly marked as completed.

This remains a manual pre-merge verification step.

Recommended checks:

```text
/
 /projects
 /projects/new
 /projects/:projectId
```

at representative:

```text
mobile
tablet
desktop
```

widths.

---

