# Payment Callbacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add idempotent, signature-verified WeChat Pay and Alipay callbacks that automatically activate matching paid orders.

**Architecture:** Persist every provider notification as a `PaymentEvent`, verify the provider signature before parsing business data, compare the provider amount and order amount, then reuse the existing subscription activation transaction. Provider response formats stay isolated in `src/lib/payments.ts`.

**Tech Stack:** Next.js 16 route handlers, Prisma 6, PostgreSQL, Node.js crypto, WeChat Pay API v3, Alipay RSA2 async notification.

---

## Scope

In scope: PaymentEvent schema and migration, Alipay/WeChat signature verification, callback routes, transaction-number persistence, idempotent activation, environment and deployment documentation, focused callback tests.

Out of scope: creating prepay orders/QR codes, refunds, auto-renewal, invoices, enterprise seats.

## Tasks

- [x] Task 1: Add PaymentEvent and Order transaction number schema with migration.
- [x] Task 2: Implement provider config and signature verification utilities.
- [x] Task 3: Implement idempotent payment event processing and order activation.
- [x] Task 4: Add WeChat Pay and Alipay callback routes.
- [x] Task 5: Document payment callback environment and reverse-proxy requirements.
- [x] Task 6: Run migration, schema, TypeScript, lint, build, and focused callback checks.

## Verification

- `npx prisma validate`
- `npx tsc --noEmit`
- `npm run lint`
- `npx next build --webpack`
- Valid Alipay notification with matching amount activates a pending order once.
- Duplicate Alipay event returns success without activating again.
- Wrong Alipay signature is rejected before order lookup.
- WeChat callback with invalid signature is rejected.
- WeChat amount mismatch does not activate the order.
