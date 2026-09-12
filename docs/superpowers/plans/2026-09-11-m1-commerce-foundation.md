# M1 Commerce Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first M1 commercial loop: plans, subscriptions, orders, daily search quotas, pricing, and manual order activation.

**Architecture:** Store commercial entitlements in PostgreSQL, centralize quota checks in `src/lib/quota.ts`, and enforce search limits in the server-rendered list page. Users can submit a bank-transfer order from the pricing page; admins confirm payment to activate a subscription.

**Tech Stack:** Next.js 16 Server Components/Actions, Prisma 6, PostgreSQL, TypeScript.

---

## Scope

In scope: Plan/Subscription/Order/QuotaLedger models, free and paid plan seed data, quota middleware equivalent in server components, pricing page, order creation, admin order confirmation.

Out of scope for this pass: WeChat/Alipay callbacks, email delivery, keyword subscriptions, Excel export, API keys, invoices, enterprise seats.

## Tasks

- [x] Task 1: Add commerce schema and PostgreSQL migration.
- [x] Task 2: Seed free, gold, platinum, and enterprise-standard plans.
- [x] Task 3: Implement entitlement and atomic daily search quota service.
- [x] Task 4: Enforce search quota and render a paywall in `/list`.
- [x] Task 5: Add `/pricing` page and bank-transfer order submission.
- [x] Task 6: Add admin orders page and paid-order activation action.
- [x] Task 7: Run migration, seed, typecheck, lint, build, and quota checks.

## Verification

- `npx prisma validate`
- `npx tsc --noEmit`
- `npm run lint`
- `npx next build --webpack`
- A free user may perform 3 searches per day; the 4th shows the upgrade wall.
- Admin confirming a paid order activates the selected plan.
