# Architecture

## Overview

The application uses a modular monolith with reduced Clean Architecture
principles.

The goal is to keep business logic separated and testable without adding
enterprise-level abstractions that are unnecessary for this assessment.

## System

React
  |
  | REST
  v
Express
  |
  v
Service layer
  |
  +--> Repository --> SQLite
  |
  +--> GeminiService --> Gemini API
  |
  +--> FileStorageService --> Local filesystem

## Backend Structure

apps/api/src/
├── config/
├── db/
├── modules/
│   ├── session/
│   ├── projects/
│   └── pipeline/
├── services/
│   └── gemini/
├── storage/
├── middleware/
├── shared/
├── app.ts
└── server.ts

Each feature may contain:

- routes
- controller
- service
- repository
- schema
- types

Files are added only when they have a real responsibility.

## Responsibility

Controller:
HTTP only.

Service:
Business logic and orchestration.

Repository:
Database operations and atomic state transitions.

GeminiService:
Gemini API integration.

FileStorageService:
Book and generated image persistence.

## Pipeline

STYLE
→ CHARACTERS
→ PORTRAITS
→ CHAPTERS
→ ILLUSTRATIONS

Progress state and execution state are separate:

- completedStep
- runningStep
- stepState
- stepStartedAt
- stepError

## Concurrency

The backend is the source of truth.

A step must be acquired atomically before Gemini is called.

Frontend button disabling alone is not considered concurrency protection.

## Persistence

SQLite:
- users
- projects
- characters
- chapters
- pipeline state

Local filesystem:
- book text
- portraits
- illustrations

## Gemini

Text:
gemini-3.6-flash

Image:
gemini-3.1-flash-lite-image

Cost controls:

- book context reused;
- 2 characters maximum;
- 1 chapter maximum;
- no automatic retries;
- incremental image persistence;
- automated tests mock Gemini.

## Why This Architecture

The architecture is intentionally smaller than full enterprise Clean
Architecture.

It provides separation of concerns and testability while remaining appropriate
for a time-bounded take-home assessment.