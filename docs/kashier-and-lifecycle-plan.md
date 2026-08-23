# Plan — self-delete, Kashier payments, subscription dates

Control plane = nit2 (Next.js + MySQL). Academy runtime = Moodle on server B.

## ✅ Feature 1 — client deletes their own academy  (DONE)
- `DELETE /api/academies/[slug]`: allow **admin OR `ownerId === user.id`** (was admin-only).
- Client `AcademyCard` now shows the delete button (reuses `DeletePlatformButton` + confirm dialog).
- Existing teardown unchanged: deprovision (server B) + GitHub branch delete + DB row delete.

## 🔜 Feature 2 — Kashier payment for paid licenses
Today paid tiers are **not** gated — a client can pick one free. Add a payment step.

**New model `Payment` (MySQL):**
`id, userId, licenseKey, amount, currency, status(pending|paid|failed), purpose(new_academy|upgrade|renew), academySlug?, payloadJson?, kashierOrderId, providerRef, createdAt, paidAt`

**Flow (new paid academy):**
1. Client picks a **paid** tier → `POST /api/payments/kashier/create` makes `Payment(pending)` + returns a signed **Kashier Hosted Payment Page** URL.
2. Client pays → Kashier calls `POST /api/payments/kashier/webhook`.
3. We **verify the HMAC signature** → mark `paid` → run existing provision (new) or `PATCH {tier}` (upgrade/renew).
4. Redirect back to `/account` with a success/failure state.

**New code:** `lib/kashier.ts` (build signed URL + verify webhook), 2 API routes above, a callback page.
**Env:** `KASHIER_MERCHANT_ID`, `KASHIER_API_KEY`, `KASHIER_MODE(test|live)`, `APP_BASE_URL`.

## 🗓 Subscription dates (per academy) — required
Each paid academy is a **term subscription** (e.g. 1 year), tracked and enforced.

**Model:** add to `Academy` → `validUntil DateTime?`, `subscribedAt DateTime?`
- On paid provision / upgrade / renew: `validUntil = now + License.durationDays` (`durationDays = 0` → `null` = never expires).
- Pass `validUntil` into the Moodle licence definition so `local_license` enforces `expirydate` (+ its `gracedays`).

**Enforcement (worker/cron):**
- Daily job flags academies past `validUntil` (+ grace) → **suspend** (existing `PATCH {suspend}`), notify owner.
- **Renew** = a Kashier `renew` payment → resets `validUntil = now + durationDays` → resume + re-apply licence.
- Account UI: show each academy's plan + **expiry date** + a **Renew** button when near/after expiry.

## Decisions still open
1. Kashier **test** credentials (getting keys).
2. **Currency**: `License.price` is USD (display). Kashier charges **EGP** → add an EGP amount to `License`, or convert.
3. v1 scope: gate **new paid academies** first; **upgrade/renew** next.

## Order of work
1. ✅ Feature 1 (delete).
2. `Payment` model + `Academy.validUntil` migration.
3. `lib/kashier.ts` + create/webhook routes → new-academy payment.
4. Expiry worker + Renew + account UI dates.
5. Upgrade-existing payment.
