# Auto-Renew Subscriptions (Kashier Pay-with-Token) — Implementation Plan

Status: **PROPOSAL** — no code written yet. This document is the spec to build against.

Goal: charge academy owners **automatically** on a recurring cycle (monthly / annual)
using a **saved card token**, instead of the current one-off "renew now" hosted
checkout. Support annual plans priced at a discount and promo/intro offers.

---

## 1. Where we are today (baseline)

Everything below already exists and keeps working unchanged — auto-renew is layered
**on top** of it, not a rewrite.

- **One-off checkout**: `POST /api/payments/kashier/create` → creates a pending
  `Payment` row holding the create/renew payload → `lib/kashier.ts:createSession()`
  calls `POST /v3/payment/sessions` (hosted checkout) → returns a `sessionUrl` the
  client is redirected to.
- **Confirmation**: `POST /api/payments/kashier/webhook` verifies the HMAC signature
  (`verifyWebhook`), and on a paid event either provisions a new academy or moves an
  existing one to the paid tier and resets `validUntil`.
- **Expiry lifecycle** (daily cron `POST /api/cron/expiry`): pre-expiry reminder
  emails (7/3/1/0 days, via each academy's own Moodle mail), auto-suspend past grace,
  optional auto-delete, and validUntil→`local_license/expirydate` sync.
- **Data**: `Payment` (one row per transaction) and `Academy`
  (`tier`, `subscribedAt`, `validUntil`, `expiryRemindersSent`) in MySQL
  (`prisma/mysql/schema.prisma`, client `@/lib/prismaMysql`).
- **Money is EGP** via Kashier; `License.priceEgp` is the charge, `License.durationDays`
  is the term (0 = never expires).

**The gap:** renewal is 100% manual — the owner must click "renew" and re-enter the
card every term. Auto-renew closes that gap.

---

## 2. What Kashier gives us (from the Pay-with-Token / direct API docs)

- **Direct order API**: `POST https://<fep-host>/v3/orders/` (test:
  `https://test-fep.kashier.io/v3/orders/`, live host TBD — see §9 open questions).
  This is a **different host/path** from the hosted `api.kashier.io/v3/payment/sessions`
  we use today.
- **Pay with a saved token** — request body (JSON):
  ```jsonc
  {
    "apiOperation": "PAY",
    "merchantId": "MID-xxxx",
    "order":    { "reference": "<our orderId>", "amount": "199", "currency": "EGP" },
    "customer": { "reference": "<our stable customer ref>" },   // MANDATORY for token pay
    "paymentMethod": {
      "type": "CARD",
      "card": { "cardToken": "<saved token>", "securityCode": "<CVV, ECOMMERCE only>" },
      "enable3DS": false
    },
    "interactionSource": "Recurring",   // merchant-initiated → no OTP/3DS
    "timestamp": "<iso>",
    "reconciliation": { "webhookUrl": "<our webhook>", "redirect": false }
  }
  ```
  Header: `Kashier-Hash: <order hash>` (+ `Content-Type: application/json`).
- **Interaction sources**: `ECOMMERCE` (customer present, 3DS/OTP), `MOTO`, and
  **`Recurring`** (merchant-initiated, MIT). For `Recurring`/`MOTO` a successful
  response is `response.result="SUCCESS"`, `response.status="CAPTURED"`,
  `response.authenticationStatus="AUTHENTICATION_NOT_IN_EFFECT"` — **no OTP needed**,
  which is exactly what a background renewal requires.
- **Success/failure**: top-level `status="SUCCESS"` **and** `response.result="SUCCESS"`
  and `response.transactionResponseCode="00"`. Anything else = decline/failure
  (`response.transactionResponseMessage` is bilingual EN/AR — good for dunning UI).
- **Token is returned on a payment** as `response.paymentMethod.card.cardToken`, with
  `storedOnFile: "TO_BE_STORED"` marking a card saved for reuse, plus a masked PAN
  (`response.paymentMethod.card.number`, e.g. `512345****2346`) we can show the owner.
- **3DS only on the first (customer-present) charge.** The recurring charge runs with
  `interactionSource:"Recurring"` + `enable3DS:false` — no customer interaction.

### 2.1 The order hash (`Kashier-Hash`)
Documented recipe (hosted path, HMAC-SHA256 with the **API key** as secret):
```
message = "/?payment=" + merchantId + "." + orderId + "." + amount + "." + currency [ + "." + customerReference ]
hash    = HMAC_SHA256(message, apiKey)   // hex
```
`lib/kashier.ts` already implements `rawurlencode` + HMAC-SHA256 for webhooks, so this
is a small addition. **⚠ Must confirm** the v3/orders header uses the same recipe (the
hashing page documents the hosted-checkout hash explicitly; the direct-API variant is
implied but not spelled out — verify against a live test order, see §9).

---

## 3. How we get a reusable token (the hard part)

We never see card numbers (good — keeps us out of PCI scope). The token must come from
Kashier during a **first, customer-present** payment. Two candidate mechanisms — we
confirm which the account supports and pick one:

- **Option A — "save card" flag on the hosted session (preferred).** Add a
  card-on-file / save-card flag to the `createSession` body so the hosted checkout
  shows a "save this card for automatic renewal" consent, and Kashier returns the
  `cardToken` (in the webhook payload and/or order-details) after the first success.
  We store it and never send the customer back to checkout for renewals.
  *Action:* confirm the exact session field name with Kashier (candidates seen in the
  wild: `enableSavingCard`, `savePaymentMethod`, `storeCard`) — **do not guess in code;
  verify first.**
- **Option B — first charge via the direct v3/orders `ECOMMERCE` + 3DS flow.** We drive
  the first payment ourselves (collect card on a Kashier-hosted field/iframe), complete
  3DS, and read `cardToken` from the response. More surface area; only if A is not
  available.

**Recommendation:** ship on **Option A**. It reuses today's hosted-checkout path almost
verbatim — the only change is the save-card flag + capturing the returned token in the
webhook.

### 3.1 Consent & mandate (compliance, not optional)
Recurring/MIT requires the cardholder to agree, at first payment, to future automatic
charges. The first checkout must present a clear **auto-renew mandate** (amount, cycle,
that it renews until cancelled, how to cancel). Store `consentAt`, the plan, and the
cycle with the saved token. Card-scheme rules (Visa/Mastercard) require this.

---

## 4. Data model changes (`prisma/mysql/schema.prisma`)

Add a **`Subscription`** row per academy (one active at a time) and a saved
**payment method**. Keeping this separate from `Academy` keeps the billing state
self-contained and auditable.

```prisma
model Subscription {
  id             String    @id @default(uuid())
  academySlug    String    @unique          // 1 active subscription per academy
  userId         String                      // owner (billing contact)
  licenseKey     String                      // License.key being billed
  status         String    @default("active") // active | past_due | canceled | paused
  autoRenew      Boolean   @default(true)
  intervalDays   Int                          // 30 monthly / 365 annual (from License)
  amountEgp      Int                          // charge per cycle (snapshot)
  currency       String    @default("EGP")
  currentPeriodEnd DateTime                   // == Academy.validUntil (source of truth stays validUntil)
  nextAttemptAt  DateTime?                    // when the billing cron should try next
  attemptCount   Int       @default(0)        // retries within the current cycle
  lastError      String?   @db.Text
  canceledAt     DateTime?
  consentAt      DateTime?                     // when the owner authorized auto-renew
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  @@index([status])
  @@index([nextAttemptAt])
}

model PaymentMethod {
  id                String   @id @default(uuid())
  userId            String                     // owner
  customerReference String                     // stable ref we send Kashier (== userId)
  cardTokenEnc      String   @db.Text          // AES-256-GCM (lib/secretBox), NEVER plaintext
  brand             String?                    // visa | mastercard | meeza …
  last4             String?                    // display only, from masked PAN
  expMonth          Int?
  expYear           Int?
  isDefault         Boolean  @default(true)
  createdAt         DateTime @default(now())
  @@index([userId])
}
```

Also extend `Payment` with a cycle marker so retries are idempotent and history is
queryable:
```prisma
// on model Payment:
subscriptionId String?   // links a charge to its subscription
billingCycle   String?   // e.g. "2026-10" — unique attempt window per subscription
```
Migration: new dir `prisma/mysql/migrations/10_subscriptions/migration.sql`
(reuse the numbered pattern; `npm run mysql:generate` then `npm run mysql:deploy`).

**Token storage:** encrypt with the existing `lib/secretBox` (`encryptSecret` /
AES-256-GCM, keyed by `CREDENTIAL_SECRET`) exactly like `adminPasswordEnc`. The token
is a reference, not card data, but we still never store it in the clear.

---

## 5. Plans: monthly, annual, and offers

Reuse the existing dynamic `License` table — a "plan" is a `License` row. To express
monthly vs annual for the same tier, choose one:

- **Recommended — one License row per (tier × interval).** e.g.
  `professional-monthly` (durationDays=30, priceEgp=299) and `professional-annual`
  (durationDays=365, priceEgp=2990 ≈ 2 months free). Simple, already supported by the
  UI and provisioning; the annual "discount" is just its price. `durationDays` already
  drives both `validUntil` and the renewal `intervalDays`.
- Alternative: add `billingInterval` + `priceEgpAnnual` columns to a single License row.
  More schema churn and UI work; not worth it for v1.

**Offers / promos (phase 2):**
- **Annual discount** = pricing (annual priced below 12× monthly). No code.
- **Intro / first-cycle discount** = a `Coupon`/promo applied to the *first* charge
  only; the subscription snapshots the *recurring* amount separately from the intro
  amount. There is already a coupon subsystem (`local_nit_flex` + coupons) — v2 wires a
  promo code into `Subscription.amountEgp` (recurring) vs the first `Payment.amount`
  (intro). Keep out of v1.

---

## 6. Flows

### 6.1 First payment → capture token + open subscription
1. Owner picks a paid plan with **"Auto-renew"** checked (default on) at checkout.
2. `POST /api/payments/kashier/create` — unchanged, plus: pass a **save-card flag**
   (Option A) to `createSession`, and record on the `Payment` that this starts a
   subscription (`purpose`, plan, interval, `autoRenew=true`, `consentAt`).
3. Webhook confirms paid → in addition to today's provisioning:
   - read `cardToken` + masked PAN + brand from the payload → upsert `PaymentMethod`
     (token encrypted).
   - create/activate `Subscription` (status `active`, `currentPeriodEnd=validUntil`,
     `nextAttemptAt = validUntil − RENEW_LEAD_DAYS`).
   - Telegram: `🔁 Auto-renew enabled — <slug> (<plan>, every <interval>d)`.

### 6.2 Recurring charge (background, no customer)
A billing step (extend the existing daily cron, or a new `POST /api/cron/billing`):
1. Select `Subscription` where `status IN (active, past_due)`, `autoRenew=true`,
   `nextAttemptAt <= now`.
2. Idempotency: compute `billingCycle` (e.g. `YYYY-MM` of `currentPeriodEnd`); skip if a
   **paid** `Payment` already exists for `(subscriptionId, billingCycle)`.
3. Create a pending `Payment` (`orderId = "sub_" + uuid`), then call **`v3/orders/` PAY**
   with the decrypted `cardToken`, `customer.reference`, `interactionSource:"Recurring"`,
   `enable3DS:false`, and the `Kashier-Hash` header.
4. On **SUCCESS** (`status=SUCCESS` && `response.result=SUCCESS` && code `00`):
   - mark `Payment` paid; extend `Academy.validUntil` by `intervalDays`
     (from `currentPeriodEnd`, not `now`, so cycles don't drift);
     set `Subscription.currentPeriodEnd`, reset `attemptCount=0`,
     `status=active`, `nextAttemptAt = newPeriodEnd − RENEW_LEAD_DAYS`.
   - clear `expiryRemindersSent`; if the academy was suspended, resume it.
   - Telegram: `💳 Auto-renewed <slug> → <plan> (paid, next <date>)`.
5. On **failure/decline** → §6.3.

> The renewal webhook (`reconciliation.webhookUrl`) is the source of truth when Kashier
> also posts one; the synchronous `v3/orders` response is used to react immediately.
> Both paths converge on the same "mark paid + extend" code (make it idempotent).

### 6.3 Dunning (failed renewal)
- Increment `attemptCount`, store `lastError` (Kashier's bilingual message),
  set `status=past_due`, schedule `nextAttemptAt` on a **retry ladder**
  (e.g. +1d, +3d, +5d — configurable `BILLING_RETRY_DAYS`).
- Email the owner via the existing Moodle-mail reminder path
  (`triggerExpiryReminder`) with a "update your card / renew now" link to `/account`.
- Telegram: `⚠️ Auto-renew FAILED <slug> (attempt N): <reason>`.
- After the last retry (or once past grace) fall through to the **existing**
  suspend-past-grace logic — no new suspend path needed.

### 6.4 Cancel / manage
- Owner (`/account`) and admin (academies dashboard) can **turn off auto-renew**
  (`Subscription.autoRenew=false`, `canceledAt=now`, `status=canceled`) — the academy
  still runs until `validUntil`, then follows the normal expiry/reminder/suspend path.
- Owner can **replace the card**: run a fresh customer-present save-card checkout,
  upsert `PaymentMethod`.
- Never expose the token to the client; show only brand + last4 + expiry.

---

## 7. API surface (new / changed)

| Method & path | Purpose | Guard |
|---|---|---|
| `POST /api/payments/kashier/create` | + `autoRenew` flag → save-card session | signed-in owner |
| `POST /api/payments/kashier/webhook` | + capture token, open `Subscription` | HMAC |
| `POST /api/cron/billing` *(or fold into `/api/cron/expiry`)* | charge due subscriptions via token | `x-cron-secret` |
| `GET /api/subscriptions?slug=` | owner/admin: current sub + card (brand/last4) | owner or admin |
| `PATCH /api/subscriptions/<slug>` | `{ autoRenew }` cancel/resume | owner or admin |
| `POST /api/payments/kashier/update-card` | start a save-card session to replace the token | owner |

New server module `lib/kashierOrders.ts`: `payWithToken({ orderId, amount, currency,
customerReference, cardToken, recurring })` → builds the body + `Kashier-Hash`, POSTs
`v3/orders/`, normalizes the response to `{ ok, captured, transactionId, cardToken?,
error? }`. Keep it beside `lib/kashier.ts` (which stays the hosted-session module).

---

## 8. UI changes

- **Checkout**: an "Auto-renew (recommended)" toggle + a plain-language mandate line
  ("renews every month/year at EGP X until you cancel").
- **`/account`** (owner): a "Subscription" card — plan, next charge date, card
  brand/last4, **Cancel auto-renew** and **Update card** buttons, last failure reason
  if `past_due`.
- **Academies dashboard** (admin): a small **Auto-renew ✓/✗** badge per row (mirrors the
  Google-URL badge pattern just added) and, in the "…" menu, "Disable auto-renew".
- **Telegram** notices for enable / renew / fail / cancel (helper `notifyTelegram`
  already exists).

---

## 9. Open questions to confirm with Kashier BEFORE coding (do not guess in code)

1. **Save-card flag** — exact field on `POST /v3/payment/sessions` to store the card and
   the exact place the `cardToken` is returned (webhook payload key vs order-details
   GET). This decides §3 Option A vs B.
2. **Live `v3/orders` host** — test is `test-fep.kashier.io`; confirm the production FEP
   host and whether our merchant is enabled for MIT/`Recurring`.
3. **`Kashier-Hash` for `v3/orders`** — confirm it's the same
   `HMAC_SHA256("/?payment=mid.orderId.amount.currency.customerReference", apiKey)`
   recipe as hosted checkout (verify with one live test order).
4. **`customer.reference` stability** — we'll use the Mongo user id; confirm a token is
   reusable across orders under the same reference (and whether the token is bound to
   that reference).
5. **`securityCode`/CVV** — docs say required for `ECOMMERCE`; confirm `Recurring`/MIT
   does **not** need it (a background charge cannot collect a CVV).
6. **Currency unit** — we send whole EGP as a string today; confirm `v3/orders` amount is
   the same (major units) and not piastres.
7. **Merchant-initiated 3DS exemption** — confirm `Recurring` truly runs without OTP for
   our MID (some acquirers force step-up).

---

## 10. Config / env (server-only, never `NEXT_PUBLIC_`)

- `KASHIER_ORDERS_URL` — e.g. `https://fep.kashier.io/v3/orders/` (test/live).
- Reuse `KASHIER_MERCHANT_ID`, `KASHIER_API_KEY(_B64)`, `KASHIER_SECRET_KEY(_B64)`.
- `CREDENTIAL_SECRET` (already set) — encrypts the saved token.
- `RENEW_LEAD_DAYS` (default 0 = charge on expiry; set 1–3 to bill just before).
- `BILLING_RETRY_DAYS` (default `1,3,5`).
- Cron: the existing daily `POST /api/cron/expiry` (GitHub Action, `x-cron-secret`) can
  carry the billing step, or add a second scheduled hit to `/api/cron/billing`.

Remember the nit2 `.env` `$`-truncation rule — a `$` in any Kashier value must be
written `\$` (dotenv-expand) or provided base64 via the `_B64` fallback.

---

## 11. Phased rollout

- **Phase 0 — confirm** the §9 unknowns on a Kashier test order. Blocks everything.
- **Phase 1 — MVP auto-renew**: schema (`Subscription`, `PaymentMethod`, `Payment`
  additions) + save-card on first checkout + token capture in webhook +
  `lib/kashierOrders.ts` + billing step in cron (charge → extend → dunning → suspend) +
  Telegram notices. Monthly **and** annual work out of the box (they're just Licenses).
- **Phase 2 — manage & offers**: `/account` subscription card, cancel/update-card,
  admin badge, retry-ladder tuning, then promo/intro pricing via the coupon subsystem.
- **Phase 3 — hardening**: proration on mid-cycle upgrade, card-expiry pre-warnings,
  failed-payment analytics, receipts.

---

## 12. Risks

- **Token capture depends on a Kashier feature we haven't confirmed** (§9.1) — the whole
  feature hinges on it; Phase 0 de-risks before we build.
- **MIT/3DS**: if the acquirer forces OTP on recurring, silent renewal is impossible and
  we fall back to "one-click renew" (charge attempt → if step-up needed, email the owner
  a hosted link). Design the billing step so a `needs_auth` result degrades to the
  existing reminder flow rather than erroring.
- **Double-charge**: strict idempotency on `(subscriptionId, billingCycle)` + the unique
  `Payment.orderId`; mark paid before side effects (the webhook already does this).
- **PCI**: we only ever store an opaque token (encrypted) — never PAN/CVV. Keep it that
  way; the token lives only in `PaymentMethod.cardTokenEnc`.
- **Consent/audit**: persist `consentAt` + plan + cycle at first payment to satisfy
  scheme mandate rules and chargeback defense.
```
