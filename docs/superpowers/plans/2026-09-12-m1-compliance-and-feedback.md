# M1 Compliance and Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide legal terms of service, privacy policy, registration agreement validation, and an end-to-end tender data feedback and correction loop.

**Architecture:** Create public `/terms` and `/privacy` routes outside the auth wall, enforce agreement confirmation on user registration, and persist correction requests to `TenderFeedback`. Add feedback modal on tender details and review actions in admin console.

**Tech Stack:** Next.js 16, Prisma 6, PostgreSQL, Tailwind CSS v4, TypeScript.

---

## Tasks

- [x] Task 1: Add `TenderFeedback` model to Prisma schema with migration `20260911171646_m1_tender_feedback`.
- [x] Task 2: Create public `/terms` and `/privacy` legal pages and update middleware public prefixes.
- [x] Task 3: Enforce terms and privacy agreement checkbox in `/register` client form and server action.
- [x] Task 4: Add 《用户服务协议》 and 《隐私保护政策》 links to global site footer.
- [x] Task 5: Implement `submitFeedbackAction` server action and `<TenderFeedbackButton />` modal on `/tender/[id]`.
- [x] Task 6: Build `/admin/feedbacks` management page and status update actions.
- [x] Task 7: Update admin navigation menu with 数据反馈.
- [x] Task 8: Run typecheck, lint, migration verification, and build.

## Verification

- `npx prisma validate`
- `npx tsc --noEmit`
- `npm run lint`
- `npx next build --webpack`
- Public access to `/terms` and `/privacy` without authentication.
- Unchecked registration attempts are rejected.
- Feedback submission appears in `/admin/feedbacks`.
- Admin can review, resolve, and reject feedbacks.
