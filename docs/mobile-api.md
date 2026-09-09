# nit2 Platform API — mobile integration guide

The **nit2** platform (control plane) is where users **sign up, buy, and manage
academies** — separate from the Moodle academy the learner app talks to. This
documents every nit2 HTTP endpoint a mobile client calls: **auth, profile,
academies CRUD, payments, subscriptions, catalogue**.

Base URL: the nit2 deployment, e.g. `https://dev.nitg-eg.com` (prod host TBD).
All paths below are under `/api`.

---

## 0. Auth model — READ THIS FIRST

nit2 authenticates with a **JWT in an httpOnly cookie named `token`** — **not** a
`Authorization: Bearer` header.

- On `POST /api/sign-in` (and verified `register`), the server sets
  `Set-Cookie: token=<jwt>; HttpOnly; Max-Age=…`.
- Every authenticated request must **send that cookie back**. In a native app use
  an HTTP client with a **cookie jar** (e.g. `cookie_jar`/`dio` on Flutter,
  `OkHttp CookieJar` on Android, `URLSession`'s `HTTPCookieStorage` on iOS) so the
  `token` cookie is stored from sign-in and replayed on later calls.
- The cookie is `HttpOnly`, so JS can't read it — that's fine for a native app,
  which just needs to persist and resend it. There is **no** token in the JSON
  body to store.
- **Roles:** each user is `admin` (NIT staff) or `client` (academy owner). Client
  users can manage only their own academies; admin-only routes are marked below.
- Sessions last a long time (cookie `Max-Age` ≈ 63 days). `POST /api/logout`
  clears it.

> If the mobile team would rather use a Bearer token than a cookie, that's a
> small backend change (accept `Authorization: Bearer` in `lib/auth`
> `getCurrentUser`) — ask and we'll add it. Today it's cookie-only.

**Unauthorized** → `401 { "error"/"message": … }`. On 401, drop the stored cookie
and return to sign-in.

---

## 1. Auth & account

| Endpoint | Method | Auth | Body → Result |
|---|---|---|---|
| `/api/register` | POST | – | `{name, email, password(≥8)}` → creates a `client`. If `REQUIRE_EMAIL_VERIFICATION=1`: returns `{needsVerify:true, email}` and emails a code (no cookie yet). Else logs in (sets cookie). |
| `/api/auth/verify-email` | POST | – | `{email, code}` → verifies + logs in (sets cookie). |
| `/api/auth/verify-email/request` | POST | – | `{email}` → resend the code. |
| `/api/sign-in` | POST | – | `{email, password}` → sets `token` cookie. `403 {needsVerify:true}` if unverified. |
| `/api/auth/forgot-password` | POST | – | `{email}` → emails a reset code. |
| `/api/auth/reset-password` | POST | – | `{email, code, newPassword}` → resets. |
| `/api/logout` | POST | user | clears the cookie. |
| `/api/me` | GET | user | `{ user: {id,email,name,role} \| null }` — current session. |
| `/api/me` | PATCH | user | `{name?}` and/or `{currentPassword, newPassword}` → update own profile. Email is not editable. |

Typical flow: `register` → (`verify-email`) → you're logged in → `GET /api/me`
to load the session.

---

## 2. Academy directory (public, for the app's picker)

| Endpoint | Method | Auth | Result |
|---|---|---|---|
| `/api/mobile/academies` | GET | **public** (CORS `*`) | `{ academies: [{id, name, slug, tier, url}] }` — **live** academies only, minimal fields. `url` = `https://<slug>.academy2026.nitg-eg.com`. |

This is the white-label app's academy chooser. After the user picks one, the app
switches to talking to **that academy's Moodle** (`design_system.php` /
`getsettings.php` / `login/token.php` — see the academy-side guide), not to nit2.

---

## 3. Academies — create / read / manage

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/academies` | POST | user (client) | **Create a FREE academy.** Body: `{name, slug, tier, brand{…}, platform_lang: "ar"\|"en"\|"both", locale, _hp}`. `_hp` is a honeypot — leave empty. Enforces the per-account free-academy limit; paid tiers go through Payments (§4). |
| `/api/academies` | GET | user | List academies (admin: all; client: their own). |
| `/api/academies/[slug]/status` | GET | user (owner/admin) | `{ slug, live, url }` — is the site up yet (poll after create). |
| `/api/academies/[slug]` | PATCH | **admin** | `{tier}` change plan · `{suspend:true\|false}` · `{updateImage:true}`. |
| `/api/academies/[slug]` | DELETE | owner/admin | Tear the academy down. |
| `/api/academies/[slug]/branding` | POST | admin | Re-apply branding `{brand{…}, platform_lang?}`. |
| `/api/academies/[slug]/credentials` | GET | **admin** | Reveal stored `owner` + NIT `admin` login (support). |
| `/api/academies/[slug]/credentials` | POST | **admin** | Reset the owner password + re-send. |
| `/api/academies/usage` | GET | **admin** | Per-academy storage + host disk. |
| `/api/academies/update-images` · `/update-sites` | POST | **admin** | Bulk roll academies onto the latest image / pull code. |

## 3.1 Plan, subscription & payments (owner / admin)

What the academy owner (or an admin) sees for **package resources, subscription,
and previous payments**. All are role-scoped: a `client` sees only their own
academy/payments; an `admin` sees everything.

| Endpoint | Method | Auth | Returns |
|---|---|---|---|
| `/api/academies/[slug]/plan` | GET | owner of the academy, or admin | **Consolidated "My plan" for one academy** — `academy` (tier, `status`, `subscribedAt`, `validUntil`), `package` (the licence's **resources**: `maxCourses`, `maxTeachers`, `storageGb`, `videoSource`, `limits`, `features`, pricing), `subscription` (auto-renew term + saved `card {brand,last4}`, or null), and this academy's recent `payments`. **Use this for the owner's plan/billing screen — one call.** |
| `/api/subscriptions` | GET | user (client→own, admin→all) | All auto-renew subscriptions for the user, each with saved card + recent renewal/`update_card` charges. `{enabled:false}` when the feature is off. |
| `/api/subscriptions/[slug]` | PATCH | owner/admin | Manage one academy's subscription (e.g. toggle `autoRenew`). |
| `/api/payments` | GET | user (client→own, admin→all) | Payment history, paginated (`?page=&limit=`), filters `?status=&purpose=&slug=`. Fields: `orderId, purpose, amount, currency, status, academySlug, billingCycle, createdAt, paidAt, …`. |
| `/api/payments/[orderId]` | GET | owner/admin | One payment's status/detail (poll after a checkout redirect). |
| `/api/licenses` | GET | public | The full package catalogue (all plans' resources) — for a plan picker/upgrade screen. |

> "Package **resources**" = the licence fields: `maxCourses`, `maxTeachers`,
> **`storageGb`**, **`priceEgp`/`price`**, `durationDays`, `videoSource`,
> `features` (the on/off map), and per-activity `limits`. `/api/academies/[slug]/plan`
> returns exactly the academy's own package (all of the above), plus the
> **subscription** (`subscribedAt` via `academy.subscribedAt`, expiry via
> `academy.validUntil` + `subscription.currentPeriodEnd`, `autoRenew`, saved card),
> recent `payments`, and an **`actions`** block (below) — one call for the whole
> billing screen.

### Upgrade & renewal — the "actions" (web + API)

`/plan`'s `actions` tells the client exactly how to change the plan. All money
moves through Kashier; both the **web dashboard** and the **app** use the same
endpoints (owner or admin):

| Do | Call | Notes |
|---|---|---|
| **Renew** (extend the term) | `POST /api/payments/kashier/create` `{purpose:"renew", slug, tier:<current>, cycle:"annual"\|"monthly"}` | Charges the plan; the webhook resets `validUntil`. |
| **Upgrade** (change plan) | `POST /api/payments/kashier/create` `{purpose:"upgrade", slug, tier:<new key>, cycle}` | **Prorated** for the time left; pick `<new key>` from `actions.upgrade.options` (the plans + prices). Webhook moves the tier + resets the term. |
| **Auto-renew on/off** | `PATCH /api/subscriptions/<slug>` `{autoRenew:true\|false}` | No charge; cancels/resumes the saved-card renewal. |

Flow for renew/upgrade: `POST kashier/create` → open the returned Kashier URL in a
webview → on return poll `GET /api/payments/<orderId>` → the **webhook** applies
the change once paid (nothing changes before payment clears). Ownership is
enforced server-side (a client can only act on their own academy).

> The academy's Moodle exposes a **read-only** slice for the in-app admin view
> (`GET /local/academy/api.php?function=get_license_status` — limits, GB, live
> usage, expiry), but **price, purchase date, and all upgrade/renew actions live
> here in nit2** — the academy can't take payments for its own plan.

### The `brand` object (create + branding)
```jsonc
{
  "fullname_ar": "…", "fullname_en": "…",
  "shortname_ar": "…", "shortname_en": "…",
  "colors": { "primary": "#RRGGBB", "accent": "…", "secondary": "…",
              "background": "…", "surface": "…", "text": "…" },
  "logo":        { "filename": "logo.png",  "data_b64": "<base64, no data: prefix>" },
  "logocompact": { … }, "favicon": { … }, "hero": { … },
  "about": { … }, "login": { … },
  "about_bullets": ["…", "{mlang en}…{mlang}{mlang ar}…{mlang}"],
  "gallery": [ { filename, data_b64 }, … up to 8 ],
  "contact_phone": "…", "contact_whatsapp": "…",
  "social": { "facebook": "https://…", "instagram": "…", "youtube": "…", "tiktok": "…", "website": "…" },
  "links": { "terms": "https://…", "privacy": "https://…" }
}
```
Images are **base64 without the `data:…;base64,` prefix**. Keep each ≤ the
platform's `max_image_mb` (see `/api/public-settings`); total request ≤ 12 MB.
Bilingual `about_bullets` use `{mlang …}` (each renders in the viewer's language).

---

## 4. Payments (Kashier)

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/payments/kashier/create` | POST | user | **Start a checkout.** Body: `{name, slug, tier, brand{…}, locale, platform_lang, purpose, cycle}`. `purpose` ∈ `new_academy`\|`upgrade`\|`renew`\|`update_card`; `cycle` ∈ `annual`\|`monthly`. Returns the Kashier **hosted-payment** params/URL to open in a webview. |
| `/api/payments/kashier/save-card` | POST | user | After the redirect, save the card for auto-renew `{search: "<redirect query string>"}` (only when subscriptions are enabled). |
| `/api/payments/kashier/webhook` | POST | Kashier (HMAC) | Server-to-server confirmation — **not called by the app**. It's what actually provisions the academy / renews after payment clears. |
| `/api/payments` | GET | user | Payment history (paginated; admin sees all, client sees own). |
| `/api/payments/[orderId]` | GET | user | One payment's status/detail. |

Paid-academy flow: `POST /kashier/create` (with the same `name/slug/tier/brand`
you'd send to create) → open the returned Kashier page in a webview → on return,
poll `GET /api/payments/[orderId]` (or `academies/[slug]/status`) — the **webhook**
provisions the academy once Kashier confirms; nothing is created before payment.

---

## 5. Subscriptions (auto-renew)

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/subscriptions` | GET | user | `{ subscriptions:[…], enabled }` — the user's subscriptions + saved card/default method. `enabled:false` when the feature flag is off. |
| `/api/subscriptions/[slug]` | PATCH | owner/admin | Toggle auto-renew / manage one academy's subscription. |

Saving a card for auto-renew: `kashier/create` with `purpose:"update_card"` (a
tiny verification charge) → `kashier/save-card` with the redirect query string.

---

## 6. Catalogue & platform config (mostly read-only)

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/licenses` | GET | – | The packages (plans): key, name, price/`priceEgp`, duration, limits (`maxCourses`, `storageGb`, …), `videoSource`, `features`, `active`. Show these on the plan picker. |
| `/api/plans` · `/api/plans/[planId]` | GET | – | Marketing plans (if used separately from licences). |
| `/api/public-settings` | GET | – | Public platform config the app needs pre-login (e.g. `max_image_mb`, feature flags). |
| `/api/free-academy-limit` | GET | user | How many free academies this account may still create. |
| `/api/health` | GET | – | Liveness check. |
| `/api/contact` | POST | – | Contact-form submission. |

Admin-only content/config (not for the client app): `/api/licenses/[key]` (PUT/DELETE),
`/api/platform-settings*`, `/api/dashboard`, `/api/blog/*`, `/api/project*`,
`/api/sponser*`, `/api/cron/expiry`, `/api/revalidate`, `/api/setup`.

---

## 7. Error conventions

- **401** `{error|message}` → not signed in (cookie missing/expired) → go to login.
- **403** → signed in but not allowed (e.g. a client hitting an admin route, or a
  `needsVerify` gate on sign-in). `{needsVerify:true, email}` means "verify email first".
- **400** → validation (`message` is human-readable, often Arabic).
- **409** → conflict (slug/email already taken).
- **429** → rate-limited (academy create is IP-limited).
- Success bodies vary per route (see the tables); most return `{message}` or the
  resource. Read `message` for user-facing text.

---

## 8. End-to-end: a client buys their first academy (app)

1. `POST /api/register` → `POST /api/auth/verify-email` → logged in (cookie set).
2. `GET /api/licenses` → show plans. `GET /api/public-settings` for `max_image_mb`.
3. Build the `brand` object (logos as base64).
4. **Free plan:** `POST /api/academies` → poll `GET /api/academies/[slug]/status`
   until `live`.
   **Paid plan:** `POST /api/payments/kashier/create` → open Kashier webview →
   on return poll `GET /api/payments/[orderId]`; the webhook provisions it.
5. `GET /api/academies` → the user's academies (each has a `slug`/`url`).
6. The learner side then opens `https://<slug>.academy2026.nitg-eg.com` in the
   white-label app and authenticates against **that academy's** Moodle
   (see the separate academy-side API guide).

> Note: nit2 endpoints were built for the web dashboard and use a **cookie
> session**. A native app works fine with a cookie jar; if you need Bearer-token
> auth or extra CORS headers for a browser-based client, that's a quick backend
> addition — tell us.
