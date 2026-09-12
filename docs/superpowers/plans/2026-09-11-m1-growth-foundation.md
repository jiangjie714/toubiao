# M1 Growth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add self-service registration, email verification, keyword watches, daily push, and quota-controlled Excel export.

**Architecture:** Extend User with email verification state, add PushWatch/PushRecord models, centralize email delivery in a mailer module, reuse list filters for watch matching, and stream quota-controlled Excel exports from a Node runtime route.

**Tech Stack:** Next.js 16, Prisma 6, PostgreSQL, TypeScript, exceljs.

---

## Scope

In scope: self registration, verification tokens, email verification route, keyword watch CRUD, daily email push worker, push dedup, Excel export route, export quota.

Out of scope: WeChat/Alipay callbacks, email marketing templates, enterprise seats, API billing.

## Tasks

- [x] Task 1: Add growth schema and PostgreSQL migration.
- [x] Task 2: Add exceljs and mail delivery abstraction.
- [x] Task 3: Implement self registration and email verification.
- [x] Task 4: Implement keyword watch CRUD and plan-based limits.
- [x] Task 5: Implement daily push matching, dedup, and email sending.
- [x] Task 6: Implement quota-controlled Excel export.
- [x] Task 7: Run migration, seed, typecheck, lint, build, and focused checks.

## Verification

- `npx prisma validate`
- `npx tsc --noEmit`
- `npm run lint`
- `npx next build --webpack`
- Registration creates an unverified user and a verification link.
- Free users cannot create keyword watches; platinum can create up to 3.
- Push dedup prevents duplicate tender notifications.
- Export quota follows plan limits.
