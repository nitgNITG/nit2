# Working in this repository

**nit2** is the NIT SaaS **control plane** — a Next.js (App Router) + TypeScript app
that manages academy tenants: sign-up/auth, licences (packages), subscriptions &
billing, and provisioning of each academy's Moodle site. It is the counterpart to the
per-academy Moodle codebase (`saas-demo` / `new-academy`), which enforces the licence
in-app; nit2 owns everything about *money and lifecycle*.

## Testing

Always follow the testing rules in `AGENT_TESTING.md`. Before finishing any task,
verify every applicable rule has been satisfied. If a rule cannot be satisfied,
say so explicitly instead of skipping it silently.

Test runner: Vitest — `npm test` (`tests/*.test.ts`, ~170 tests; route handlers and
libs are tested with the MySQL Prisma client mocked by model name). Every behaviour
change adds or updates a test there.

## Architecture

- **Two databases, two Prisma clients.**
  - **MongoDB** = the primary app DB. Default client: `import prisma from "@/lib/prisma"`.
  - **MySQL** = the tenant control plane only (Tenant, License, Subscription,
    Payment, PaymentMethod, TenantRevenue, Settlement, PlatformSetting). Client:
    `import prisma from "@/lib/prismaMysql"`. A **Tenant** is one provisioned product
    instance — `product = academy | store` — sharing lifecycle, billing and expiry;
    `tenantSlug` is the join key everywhere (`Payment`, `Subscription`, `TenantRevenue`).
    The public API paths still say `/api/academies/**` (mobile/dashboard contract) and
    `/api/revenue/ingest` still accepts `academySlug` from the academies' Moodle.
    Schema at `prisma/mysql/schema.prisma`; migrations in `prisma/mysql/migrations/`.
  - Pick the right client for the table — mixing them is the most common mistake here.
- **Auth.** JWT signed with `SECRET_JWT`, stored in the httpOnly cookie `token`.
  `getCurrentUser()` in `lib/auth.ts`; roles are `admin` | `client`. Owner-scoped
  routes check `academy.ownerId === user.id`; admin sees all. Every owner/role-gated
  endpoint must refuse the wrong user (see `AGENT_TESTING.md` backend specifics).
- **Billing.** Kashier via `POST /api/payments/kashier/create` (purposes:
  `new_academy` | `upgrade` | `renew` | `update_card`; upgrades are prorated,
  ownership-checked). The verified webhook (`app/api/payments/kashier/webhook`) applies
  the change once paid. Auto-renew is the `Subscription` model + the billing cron
  (`lib/billing.ts`). `Academy.subscribedAt` / `validUntil` hold the current term.
- **Provisioning.** `lib/provisionAcademy.ts` drives a provisioning server (server B)
  over HTTP (`PROVISION_URL` + `PROVISION_SECRET`). The shell/PHP scripts it calls live
  in `provisioning/` and are shipped to the box with
  `bash provisioning/deploy-provisioning.sh` — **editing a script here does nothing until
  it's deployed.** `provisioning/deploy-provisioning.sh` lists every file that gets copied;
  add new scripts to that list.
- **Store provisioning (commerce).** `provisioning-store/` is the store counterpart of
  `provisioning/`: a self-contained host agent (`provision-server.py` + bash scripts +
  `provision.env` + systemd, port 9098) that runs **one docker compose project per
  store** from the `saas-store-{api,site,dash}` images built in `saas-commerce`. Deploy
  with `bash provisioning-store/deploy.sh --local` (this box) or `deploy.sh` (remote);
  **editing a script here does nothing until it's deployed.** `compose.store.yml` there
  is a copy of `saas-commerce/deploy/compose.store.yml` — keep them identical. Jobs are
  queued (SQLite) and report every step to nit2 (`POST /api/tenants/<slug>/progress`,
  `x-worker-secret`). Day-2 ops go through the store's own CLI
  (`docker compose -p store_<slug> exec api node dist/cli.js …`), never SQL.
- **Licence definition.** `lib/licenseDefinition.ts` (`toLicenseDefinition`) converts a
  MySQL `License` row into the JSON pushed to each academy's `local_license` plugin. Note
  the academy reads `expirydate` / `subscribedat` / `storagegb` from **their own cfg keys**,
  which `create.sh` / `apply-license.sh` extract out of that JSON — not from the JSON
  directly. Keep those two scripts in sync when adding a pushed field.
- **Integrations.** Shared NIT accounts (Kashier / VDOCipher / Vimeo) live once in
  `PlatformSetting` (encrypted via `lib/secretBox.ts`, key `CREDENTIAL_SECRET`) and are
  pushed per-academy based on its licence — `lib/integrations.ts`.

## Commands

- `npm run dev` — local dev server.
- `npm run build` — generates both Prisma clients then `next build`.
- `npm run lint` — `next lint`. Finish at zero issues (`AGENT_TESTING.md` §5).
- `npx tsc --noEmit` — typecheck; must be clean before a task is done.
- MySQL schema changes: edit `prisma/mysql/schema.prisma`, then
  `npm run mysql:migrate` (dev) / `npm run mysql:deploy` (prod). MongoDB uses
  `npm run mongo:push`.

## Gotchas

- **`.env` `$` escaping.** A literal `$` in a nit2 `.env` value is truncated unless
  written `\$` (dotenv-expand runs variable expansion). Bit us on secrets/keys.
- **Two email paths.** Academy Moodle mail sends welcome / expiry / receipts; the
  site-account SMTP path (`MAIL_*`, nodemailer) sends verify / forgot-password **and
  the store expiry / suspension mails** (`lib/tenants/storeExpiryEmail.ts`, from the
  daily cron — stores have no platform mail path of their own). Don't conflate them.
- **Never store plaintext secrets.** `saveIntegrationSettings` refuses to save when
  `CREDENTIAL_SECRET` is unset rather than persisting an empty/plaintext secret — keep
  that guard.
- **Deploy after DB/schema/provisioning changes:** `git pull && npm run build && <restart>`,
  and `bash provisioning/deploy-provisioning.sh` when any `provisioning/` file changed.
