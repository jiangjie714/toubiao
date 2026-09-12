# M1 Operations Audit Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add export behavior auditing and payment event monitoring for M1 operations and account reconciliation.

**Architecture:** Persist each successful Excel export with user, filters, matched/exported row counts, client IP, and user agent. Payment events are retained by the callback pipeline and exposed in a read-only admin page. Both pages stay server-rendered and scoped to admins.

**Tech Stack:** Next.js 16, Prisma 6, PostgreSQL.

---

## Scope

In scope: ExportAudit schema/migration, successful export audit records, export audit admin page, payment event admin page, admin navigation, validation.

Out of scope: refunds, invoice workflow, API billing, push unsubscribe metrics, data quality feedback.

## Tasks

- [x] Task 1: Add ExportAudit schema and migration.
- [x] Task 2: Record successful Excel exports with filters, row counts, IP, and user agent.
- [x] Task 3: Add export audit admin page.
- [x] Task 4: Add payment event admin page.
- [x] Task 5: Update admin navigation and operations documentation.
- [x] Task 6: Run migration, schema, TypeScript, lint, build, and focused audit checks.

## Verification

- `npx prisma validate`
- `npx tsc --noEmit`
- `npm run lint`
- `npx next build --webpack`
- Successful export creates one ExportAudit row.
- Export audit page shows user, filters, matched/exported rows, IP, and user agent.
- Payment event page shows provider, event ID, order, status, timestamps, and error.
- Non-admin users cannot access either page.
