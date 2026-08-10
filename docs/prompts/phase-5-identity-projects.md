# Phase 5 — Identity and Projects

## Initial prompt

Read the current repository and do not modify files yet.

We are starting Phase 5: Identity and Projects.

Requirements:

### Identity

- user enters name and email
- if email exists, load that user
- otherwise create the user
- no password
- no OAuth
- session-based identity is acceptable
- sign out must be supported

### Projects

- authenticated user can list only their own projects
- create a project with title and either pasted book text or uploaded `.txt`
- persist book text to the local filesystem
- persist project metadata to SQLite
- project detail must be retrievable
- ownership must be enforced server-side

Architecture:

```text
Route
→ Controller
→ Service
→ Repository / FileStorageService
```

Constraints:

- do not add JWT, OAuth, refresh tokens, cloud storage, or unnecessary abstractions
- do not integrate Gemini yet
- keep the implementation local and minimal
- write meaningful tests
- do not commit or push

First:

1. inspect the current repository,
2. propose the Phase 5 design,
3. identify validation and ownership invariants,
4. list exact files to add or modify,
5. identify data-model risks,
6. explain how session handling should work in tests.

Do not edit files until I approve the plan.

---

## Review correction

I approve the Phase 5 direction with these corrections.

### 1. Book storage path

Use a server-generated path:

```text
data/books/<userId>/<projectId>/book.txt
```

Generate `projectId` before writing the file.

Never derive storage paths from the uploaded client filename.

### 2. Pipeline ownership

Phase 5 must secure the existing pipeline endpoints.

Do not only check ownership before acquisition.

The final repository mutations used for acquire, complete, fail, and stale
recovery must also be scoped by both `projectId` and `userId` so another user's
project can never be mutated through a known ID.

Return `404` for non-owned projects rather than revealing their existence.

### 3. Session middleware

Keep `requireSession` small.

It should only require:

```text
req.session.userId
```

Do not query users or projects from middleware.

Ownership remains a service/repository responsibility.

### 4. Project creation

`POST /api/projects` accepts exactly one source:

- non-empty pasted `bookText`, or
- one `.txt` upload.

Use Multer memory storage with a reasonable file-size limit.

Decode the upload as UTF-8 and persist it only through
`FileStorageService`.

Whitespace-only pasted text is invalid.

Do not use Multer disk storage.

### 5. Project DTOs

Do not expose internal persistence fields such as:

- `bookFilePath`
- Gemini reference IDs

Project list/detail responses should expose only fields needed by the client.

The list DTO should already include enough persisted pipeline information to
derive/display:

- Draft / In progress / Done
- five-step progress

without exposing storage internals.

### 6. Existing user login

Normalize email with:

```ts
trim().toLowerCase()
```

If the email already exists, load that user and do not overwrite the stored
name from the newly supplied login name.

Regenerate the Express session before assigning `userId`.

### 7. Persistence ordering

Use this sequence:

```text
Generate projectId
→ write the book file
→ insert the project row
```

If the database insert fails, perform best-effort deletion of the newly written
book file.

Do not add background cleanup infrastructure.

### 8. Testing

Use isolated temporary SQLite databases and temporary storage directories.

Use Supertest `request.agent()` for real cookie/session tests.

At minimum test:

- new email creates identity
- existing email reuses identity
- sign out invalidates authenticated access
- pasted text creation
- `.txt` upload creation
- neither source rejected
- both sources rejected
- user A lists/fetches only their projects
- user B cannot fetch user A project
- unauthenticated pipeline request returns `401`
- user B cannot run/recover user A pipeline

No Gemini integration.

No JWT, OAuth, Redis, or cloud storage.

Implement test-first.

Before finishing run:

- API typecheck
- API tests
- API build
- root `npm test`
- `git diff --check`

Summarize changed files, tests, and any real engineering decision that may
belong in `DECISIONS.md`.

Do not commit or push.

---

## Review 2 correction

The Phase 5 implementation review is approved overall.

Add one focused `ProjectService` test for the filesystem compensation path:

- `FileStorageService.writeBook()` succeeds;
- `ProjectRepository.create()` fails;
- `FileStorageService.deleteBook()` is called with the newly created book path;
- `ProjectService.create()` returns or throws the expected `500` application
  error.

Use test doubles.

This does not need another HTTP integration test.

Do not change the architecture or production behavior.

After adding the test run:

- API typecheck
- API tests
- API build
- root `npm test`
- `git diff --check`

Do not commit or push.

---

## Outcome

The Phase 5 implementation was accepted after two review rounds.

The final implementation provides passwordless name/email identity using
server-side sessions.

Existing users are resolved through normalized email lookup, while new users
are created when no matching email exists.

Sign-in regenerates the Express session before storing the authenticated
`userId`, and sign-out destroys the session without deleting the user or
projects.

Project endpoints are authenticated and scoped by the current session user.

The implementation supports:

- listing only the authenticated user's projects;
- creating a project from pasted book text;
- creating a project from one `.txt` upload;
- retrieving an owned project;
- rejecting access to projects owned by another user.

Book content is persisted using server-generated storage paths:

```text
data/books/<userId>/<projectId>/book.txt
```

Client filenames are never used to construct persistent filesystem paths.

Project creation follows this persistence order:

```text
Generate projectId
→ persist book file
→ persist project metadata
```

If project persistence fails after the book has been written, the service
performs best-effort deletion of the newly written book file.

Project DTOs intentionally hide persistence internals such as:

- `bookFilePath`
- Gemini reference identifiers

while still exposing pipeline state needed by the frontend.

The existing pipeline endpoints were also secured during this phase.

Pipeline project lookup and final database mutations are scoped by both:

```text
projectId
+
userId
```

This applies to:

- acquisition;
- completion;
- failure persistence;
- stale recovery.

Non-owned projects return `404`.

The session middleware remains intentionally small and only verifies that an
authenticated `userId` exists in the session.

Project and pipeline ownership checks remain in the service/repository layers.

Testing uses:

- in-memory libSQL databases;
- temporary filesystem directories;
- Supertest persistent agents for cookie/session behavior;
- test doubles for focused service failure paths.

The tests cover:

- new identity creation;
- normalized existing-user reuse;
- stored user name preservation;
- sign-out;
- pasted book creation;
- `.txt` upload creation;
- empty source rejection;
- whitespace-only text rejection;
- multiple source rejection;
- local filesystem persistence;
- user-scoped project listing;
- cross-user project access rejection;
- unauthenticated pipeline rejection;
- cross-user pipeline run rejection;
- cross-user stale recovery rejection;
- filesystem cleanup when project database persistence fails.

No Gemini integration, JWT, OAuth, Redis, cloud storage, or background cleanup
infrastructure was introduced.

Final verification:

- API typecheck passed;
- API tests passed: 18 tests across 5 files;
- API build passed;
- root `npm test` passed;
- `git diff --check` passed.