# M0 Architecture Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the M0 foundation from `docs/技术架构方案.md` and `docs/商业化计划书.md`.

**Architecture:** Move the crawler from a monolithic file-based runner to PostgreSQL-backed configuration, queue, scheduling, enrichment, persistence, health, and storage modules. The Next.js app remains the admin and public interface.

**Tech Stack:** Next.js 16, Prisma 6, PostgreSQL 16, Cheerio, YAML, Zod, TypeScript.

---

## Scope

In scope: PostgreSQL schema v2, skill schema validation, DB-first configuration, extra-field extraction, detail extraction, dry-run, field-level persistence, project/attachment models, local storage abstraction, scheduler, DB task queue, worker process, health score.

Out of scope for this pass: payment, subscriptions, quotas, email push, open API, Meilisearch, cloud storage, proxy pool, Docker deployment, 6-source expansion, legal/operations work.

## Tasks

- [x] Task 1: Upgrade Prisma to PostgreSQL and add M0 models.
- [x] Task 2: Add Zod skill configuration schema and DB-first config loader.
- [x] Task 3: Add field extraction and normalization pipeline.
- [x] Task 4: Split field-level persistence, project aggregation, and attachment persistence.
- [x] Task 5: Add local storage abstraction.
- [x] Task 6: Add DB-backed scheduler, task queue, and worker process.
- [x] Task 7: Add health score and crawl metrics.
- [x] Task 8: Add dry-run mode without database writes.
- [x] Task 9: Run typecheck, lint, build, and focused integration checks.
- [x] Task 10: Migrate historical SQLite data into PostgreSQL.

## Verification

- `npx prisma validate`
- `npx tsc --noEmit`
- `npm run lint`
- `npx next build --webpack`
- Dry-run command against a skill must parse without creating or updating `Tender` rows.
