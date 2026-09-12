# Payment Prepay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create WeChat/Alipay pending orders and pay by QR code before the existing callback automatically activates subscriptions.

**Architecture:** Persist provider prepay codes and expiry on each order, isolate provider request signing in `src/lib/payment-prepay.ts`, render local QR codes on a user-owned payment page, and poll the server-rendered order status until the callback activates it.

**Tech Stack:** Next.js 16 server actions, Prisma 6, PostgreSQL, Node fetch/crypto, qrcode.

---

## Scope

In scope: online order creation, WeChat Native prepay, Alipay precreate, QR payment page, prepay refresh, production environment documentation, focused validation.

Out of scope: refunds, invoices, auto-renewal, provider response signature verification, bank-transfer UI redesign.

## Tasks

- [x] Task 1: Add prepay code/expiry schema and migration.
- [x] Task 2: Implement WeChat Native and Alipay prepay request clients.
- [x] Task 3: Add online order creation and prepay refresh actions.
- [x] Task 4: Add QR payment page with local QR rendering and status polling.
- [x] Task 5: Update pricing-page purchase actions and payment configuration docs.
- [x] Task 6: Run migration, schema, TypeScript, lint, build, and focused payment-page checks.

## Verification

- `npx prisma validate`
- `npx tsc --noEmit`
- `npm run lint`
- `npx next build --webpack`
- Pricing page offers WeChat/Alipay monthly and yearly purchase actions.
- Payment page is user-scoped and does not expose other users' orders.
- Invalid order number returns not found.
- Prepay refresh rejects paid/canceled orders.
- QR code is generated locally from the stored prepay code.
