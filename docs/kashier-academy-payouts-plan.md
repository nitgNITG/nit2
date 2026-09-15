# Kashier per-academy payouts via sub-accounts — design & analysis

**Status:** analysis only (not built). Settlement decided as a **manual admin action**.
**Context:** all academies share ONE Kashier merchant account; NIT collects all student
money and must settle each academy owner. See `docs/kashier-and-lifecycle-plan.md`
and the memory note `kashier-shared-account-model`.

## Goal

Keep collecting student payments centrally (NIT's one merchant), but **manage and pay
out each academy through Kashier programmatically** instead of manual out-of-band
transfers — using Kashier **Accounts** (sub-accounts), balances, and payouts.

## What Kashier provides (confirmed from the docs)

Kashier **Accounts** = sub-accounts *under one merchant* (not separate merchants):

- `POST /v2/account` — create a sub-account with its own `payoutMethod` (the owner's
  bank: `accountHolderName`, `accountNumber`, `bankName`, `bankAbbreviation`,
  `bankBranchName`, `bankBranchCode`). Returns `accountId` like `ACC-46254-582-02`
  under our `merchantId`.
- `GET /v2/account` (primary), `GET /v2/account/:accountId` — account + balances:
  `totalBalance`, `availableBalance`, `onHoldBalance` (holds reduce *available*, not
  *total*).
- `PUT /v2/account/:accountId` — update (payout-method changes need an `x-otp` header).
- `GET /v2/account/overview/accounts-list`, `…/overview/payments/:accountId`,
  `…/overview/payouts/:accountId`, `GET /v2/account/:accountId/records` — per-account
  reporting / ledger. Ledger `operation` types include `settlement`, `payout`,
  `transfer`, `deduct`, `refund`.
- Auth: our **platform secret key** (`Authorization`) — NIT manages everything centrally
  with its own credentials. No cap on number of accounts; no delete endpoint.

Test base `https://test-api.kashier.io`, live `https://api.kashier.io`.

## The constraint that dictates the flow

**A payment cannot be routed to a sub-account at checkout** — the Payment Sessions body
has **no `accountId`** field, and `connectedAccount.merchantId` targets a *separate*
merchant, not a sub-account. Therefore:

```
student pays
   → funds land in NIT's PRIMARY account   (we collect them)
   → NIT attributes each academy's share    (via metaData.academy + tagged order id)
   → NIT TRANSFERS that share into the academy's sub-account (ACC-…)
   → PAYOUT to the owner's bank via the sub-account's payoutMethod
```

Attribution already works: the shipped tenant change tags every Kashier payment with
`metaData.academy` and a tenant-prefixed order id (`PAY-<TAG>-YYYY-…`). That is the key
NIT uses to total each academy's earnings before transferring.

## Proposed architecture (mostly nit2)

- **Schema (MySQL):** per Academy — `kashierAccountId String?` and payout-bank fields
  (or a `PayoutAccount` table keyed by academy).
- **`lib/kashierAccounts.ts`:** `createAccount`, `getAccount` (balance), `listAccounts`,
  `getAccountRecords`, and `createPayout` / `transfer` (once the endpoint is confirmed).
- **Owner onboarding UI:** owner enters bank details → `POST /v2/account` → store
  `accountId`.
- **Settlement (MANUAL):** an admin reviews each academy's attributed earnings in the
  fleet dashboard and clicks to transfer → payout into that academy's sub-account.
  Show balances + payout history from the overview endpoints. No automatic job.
- **saas-demo:** unchanged — payments keep landing in the primary account; the tags
  already added are the attribution key.

## OPEN QUESTIONS FOR KASHIER (blocking the settlement half)

1. **Create-payout / create-transfer endpoint** — exact method, URL, and body
   (`accountId`, `amount`, `currency`, …) to move money from the primary account into a
   sub-account and/or pay a sub-account's balance to its `payoutMethod` bank. Not in the
   public API-reference pages reachable to us.
2. **Trigger model** — are sub-account payouts **API-triggered**, or does Kashier
   **auto-pay** a sub-account balance to its `payoutMethod` on a schedule? (We chose
   manual admin action, so we prefer an API-triggered payout.)
3. **Merchant enablement** — confirm NIT's merchant is enabled to create sub-accounts,
   and any KYC needed for a sub-account's payout bank.
4. **Fees/commission** — we are designing assuming **no per-transaction split** (NIT's
   revenue is the SaaS licence). Confirm there's no required platform fee mechanic.

## Not doing (explicitly rejected)

- **Connected accounts** (`connectedAccount.merchantId`) — routes funds to a *separate*
  merchant the owner must own + KYC. We are collecting centrally, so this is not the fit.
- **Per-transaction split at checkout** — no such field on Payment Sessions.
