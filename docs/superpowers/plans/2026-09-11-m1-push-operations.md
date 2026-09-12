# M1 Push Operations Plan

**Goal:** Make daily push production-ready with a containerized worker, SMTP guidance, and admin observability.

**Scope:** Docker Compose push worker, environment template/README SMTP instructions, admin push monitoring, validation.

**Out of scope:** payment callbacks, marketing email templates, enterprise seats, API billing.

## Tasks

- [x] Task 1: Add a dedicated `push-worker` Compose service with SMTP and cron environment.
- [x] Task 2: Document production SMTP, APP_URL, and PUSH_CRON configuration.
- [x] Task 3: Add an admin push monitoring page for subscriptions and delivery records.
- [x] Task 4: Run schema, TypeScript, lint, build, and focused push checks.

## Verification

- `npx prisma validate`
- `npx tsc --noEmit`
- `npm run lint`
- `npx next build --webpack`
- `docker compose config` includes `push-worker`.
- Admin push page renders watch status and recent delivery records.
