# AI agent — deploy runbook and UAT checklist

The NITG AI sales assistant (SRS v1.2, phase 1). Code: `lib/agent/**`, `app/api/agent/**`,
dashboard pages under `app/[locale]/dashboard/{conversations,agent-*,price-ranges}`, widget in
`app/[locale]/components/ChatWidget`.

## 1. Environment

| Variable | Where it comes from |
| :-- | :-- |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys (one key per environment; set a monthly spend limit there as a backstop) |
| `AGENT_IP_SALT` | any long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CRON_SECRET`, `TELEGRAM_*`, SMTP | already set for the existing crons and alerts |
| `WHATSAPP_APP_SECRET` | Phase 3. Meta app → App settings → Basic → App secret (checks the webhook signature) |
| `WHATSAPP_VERIFY_TOKEN` | Phase 3. Any long random string; the same value goes into Meta → WhatsApp → Configuration |
| `CREDENTIAL_SECRET` | Already used for academy passwords; also encrypts the WhatsApp access token saved in AI Settings |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID` | Optional env fallback; normally entered in AI Settings → WhatsApp instead |

## 2. Deploy order (SRS §13.4)

**The MySQL migration must run before the new code serves traffic.** Prisma now reads
`User.agentPermissions` on every sign-in; without the column every login fails.

1. Back up MongoDB and MySQL.
2. `npm run mysql:deploy` — adds the nullable `User.agentPermissions` column (migration 25).
3. `npm run mongo:push` — new collections + optional fields only; existing documents are untouched. It then runs `scripts/agent-indexes.mjs` itself: `prisma db push` drops indexes it doesn't know, which includes the TTL ones.
4. (Only if you ran `npx prisma db push` directly) `node scripts/agent-indexes.mjs` — TTL indexes (sessions 30 d, tool audit 180 d, idempotency 7 d, rate-limit buckets, usage events 180 d).
5. Deploy the build (`git pull && npm run build && <restart>`). The agent ships **off**.
6. Schedule the daily cron (next section).
7. Dashboard → **AI Settings**: set the daily budget, then switch **Website chat on**.

Rollback: switch the agent off in AI Settings, redeploy the previous build. The new
collections and the nullable column can stay.

## 2b. Seed the custom-project price ranges (optional)

Each range has a USD amount and an **optional EGP amount** that sales enters (never converted).
The assistant quotes EGP to visitors in Egypt (stated country, or Egyptian dialect / pounds) and
USD to everyone else; with no EGP amount it always quotes USD.

`scripts/data/price-ranges.json` holds **suggested** starting ranges (USD; EGP left empty) for the standard
categories (custom LMS, LMS apps, e-commerce, delivery, restaurant, loyalty, school
management, website, custom software). They are estimates, not approved prices.

```bash
npm run seed:price-ranges -- --dry-run     # show what would happen
npm run seed:price-ranges                  # insert missing categories, INACTIVE
```

The assistant quotes only **active** ranges, word for word. After seeding, sales reviews each
range in **Dashboard → Price Ranges**, corrects the numbers and ticks **Active**. Existing ranges
are never overwritten (sales edits win); `--force` overwrites them, `--activate` inserts the seeds
already active — use it only after editing the JSON to the approved numbers.

## 2c. Settings worth checking after deploy

- **AI Settings → Abuse protection**: messages per IP per window, new chats per IP per hour, messages per visitor per day (account, else guest browser session), max messages per conversation. The panel under it shows today's blocked requests, the IPs blocked most and the busiest visitors.
- **AI Settings → Team notifications**: handoff emails go to the admin alert emails (Platform Settings) + staff with the sales or support permission matching the chat; the staff owner is emailed when the visitor replies. Needs SMTP (`MAIL_HOST`/`MAIL_USER`/`MAIL_PASS`). Each person can also turn on sound + desktop alerts at the bottom of the dashboard sidebar.
- **AI Usage & Cost**: cost per model, per UTC day (compare with the Anthropic console, which uses UTC and can lag a few hours) and per visitor / IP. Per-visitor cost exists only for calls made after this update. Days before 2026-10-06 overstate Haiku calls (summaries, tagging), which were priced as Opus because the API returns the dated id `claude-haiku-4-5-20251001`.

## 2e. Telegram alerts for the AI Inbox (optional)

AI alerts (handoffs, HOT leads, tickets, meetings, budget, errors) use the shared SaaS bot (`TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`) until **AI Settings → Telegram alerts** is set: @BotFather → `/newbot` → add the bot to a group → send a message there → paste the token → **Find chat ID** → Save → Send test. Stored encrypted (needs `CREDENTIAL_SECRET`); clear both fields to go back to the shared bot. No GitHub Actions change: the workflows don't send AI alerts.

## 2d. WhatsApp (phase 3)

1. Meta Business Settings → **System users** → Add (role Admin) → **Assign assets**: the app (Full control → Manage app) and the WhatsApp account (Full control → Manage WhatsApp Business accounts).
2. Same system user → **Generate token** → pick the app → permissions `business_management`, `whatsapp_business_messaging`, `whatsapp_business_management` → copy the token (choose "Never" for expiry if offered).
3. Meta app → WhatsApp → **API Setup**: copy the **Phone number ID** and **WhatsApp Business Account ID**.
4. Server `.env`: `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (and `CREDENTIAL_SECRET` if missing) → `pm2 restart nit2-dev --update-env`.
5. Dashboard → **AI Settings → WhatsApp**: paste the number id, account id and token → Save. All checks should be ✓. "Send test" sends Meta's `hello_world` template (with the test number, add the recipient under API Setup → To first).
6. Meta app → WhatsApp → **Configuration** → Webhook: callback URL from the settings card (`…/api/agent/whatsapp/webhook`), verify token = `WHATSAPP_VERIFY_TOKEN` → Verify and save → **Manage** → subscribe to `messages`.
7. Tick **AI answers on WhatsApp** in AI Settings → Save. Unticked, WhatsApp messages still arrive and go straight to the AI Inbox for the team.

## 2f. Follow-ups (phase 4)

The daily job (E18) drafts follow-ups into **Dashboard → Follow-ups**; nothing is sent until someone with the sales permission (or an admin) clicks **Approve & send**. Three kinds, each switchable in **AI Settings → Follow-ups**:
- **Follow-up date today** — set **Next follow-up** on a lead (AI Inbox lead panel or the Contacts popup).
- **Checkout not paid** — a checkout link given in chat, no paid payment after 48 h (by the signed-in account or an account with the lead's email).
- **Didn't come back** — a chat lead who left a phone / WhatsApp number, said yes to being contacted, and hasn't written for 24 h (skipped if a person already handled the chat).

Consent: chat / WhatsApp leads need an explicit yes; contact-form leads asked to be contacted; a "no" is never contacted (re-checked when sending).

Sending: WhatsApp first (as plain text if the customer wrote in the last 24 h, else through the approved template), else email (SMTP). Create the template in WhatsApp Manager → Message templates: name `nit_followup`, category **Marketing**, languages Arabic + English, body with two variables, e.g. `Hello {{1}}, this is the N.I.T team. {{2}} Reply here if you'd like to continue.` ({{1}} = first name, {{2}} = the approved text). Put the name and language codes in AI Settings → Follow-ups.

## 3. Daily cron

Scheduled by the GitHub Actions workflow `.github/workflows/agent-daily-cron.yml` (00:30 UTC,
03:30 Cairo), next to `expiry-cron.yml`. It uses the same repo settings: the `NIT_BASE_URL`
variable and the `CRON_SECRET` secret, which must equal `CRON_SECRET` in the server's `.env`.
Run it by hand from the **Actions** tab (**Run workflow**), or:

```bash
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://dev.nitg-eg.com/api/cron/agent-daily
```

It closes conversations idle for 24 h (with an AI summary), tags finished conversations for
**AI Analytics** (service, country, intent, unanswered questions), and applies retention: chat 12 months,
tool audit 180 days, idempotency 7 days, sessions 30 days, usage 24 months. Leads, tickets and
meeting requests are kept. The JSON response lists what it closed and deleted.

## 4. Evals before UAT (level 4)

```bash
npm run agent:eval
```

Runs the 62 scripted conversations in `tests/evals/cases.ts` against the real model, with the
databases replaced by an in-memory copy of `tests/evals/fixtures.ts` (nothing is written to a real
database, no alerts are sent). Writes `tests/evals/report.md`. Gate to enter UAT: **≥ 90% overall
and 100% on the safety groups**. Re-run after any change to the system prompt (`lib/agent/knowledge/core.ts`),
tools or model profile. `EVAL_FILTER=<group|id>` runs a subset; `EVAL_JUDGE=0` skips the Haiku judge.
A full run costs roughly a few US dollars.

## 5. Staff access

Dashboard → **AI Staff** (admins only): find the account by email and tick Sales / Support /
Viewer. Staff accounts keep role `client`; they see only the agent pages their permissions allow.

| Permission | Can open |
| :-- | :-- |
| Sales | AI Inbox (sales), Price Ranges, Meetings, AI Usage, AI Analytics, lead score corrections |
| Support | AI Inbox (support), Tickets |
| Viewer | AI Usage, AI Analytics |
| Admin | everything, including AI Settings and AI Staff |

## 6. UAT checklist (level 5, SRS §9.4) — dev server, sign-off by QA + a sales team member

**Browsers:** Chrome, Safari, Firefox desktop; iPhone Safari and Android Chrome at 375 px.

- [ ] `/ar/pricing`: chat button bottom-left; panel opens right-to-left with the greeting, the AI notice and 3 suggestions (AC-01.1).
- [ ] `/en`: "What is NITG?" streams an English reply, first words in under 3 s (AC-01.2).
- [ ] Egyptian Arabic question about Moodle hosting → Arabic answer, no invented facts (AC-01.3).
- [ ] No chat button on `/ar/dashboard`, `/ar/payment`, `/ar/account` (AC-01.4).
- [ ] Mixed Arabic/English text, Arabic and Latin digits, a 2,000-character message, and a 2,001-character one (refused).
- [ ] Keyboard only: Tab to the button, Enter opens, type + Enter sends, Escape closes; screen reader announces the button and new replies.
- [ ] Sales journey: ask prices → numbers match **Plans & Pricing** exactly → "I want Standard" → button opens build-product with the plan pre-selected (AC-02.1, AC-05.1).
- [ ] Leave name, phone, email in chat → lead appears in the AI Inbox with tier, score breakdown, AI brief and next action (AC-04.1, AC-27.1).
- [ ] Saudi company, LMS for 20,000 users, apps, payments, video protection, 3 months, $10,000+ → tier HOT; Telegram + email alert with the business fields only (AC-10.2).
- [ ] Custom LMS price → the range from **Price Ranges** quoted exactly; a category with no range → no number, offer of a quotation (AC-25.1/25.2).
- [ ] "Have you built something similar?" → only projects from **Projects** (AC-24.1); experience → 13+ years, 150+ projects, 50+ Moodle platforms (AC-24.2).
- [ ] Tender / RFP message → handed to a person at once, no price or scope discussed (AC-06.4).
- [ ] Handoff journey: "Talk to a person" → Telegram alert with dashboard link → staff **Take over** in the inbox → reply appears in the visitor's panel within 5 s → **Hand back** → AI answers again with the full history (AC-06.1, AC-12.1, AC-12.2).
- [ ] Outside working hours, handoff tells the next working time and asks for a phone number (AC-06.3).
- [ ] Reload the page within 24 h → same conversation continues (AC-07.1). Another browser can't open it (AC-01.5).
- [ ] Settings: change the Arabic greeting → a new visitor sees it with no restart (AC-13.1); two admins saving → the second gets the conflict warning (AC-13.2).
- [ ] Switch the web chat off → WhatsApp button instead (AC-09.2). Budget at a few cents → fallback + one admin alert that day (AC-09.3).
- [ ] Sales staff (Mona): sees sales conversations, price ranges, usage; cannot open AI Settings or AI Staff (AC-33.1).
- [ ] Correct a WARM lead's budget to $10,000 in the inbox → score, tier and breakdown update at once (AC-35.1).
- [ ] AI Usage shows today's conversations, leads, handoffs, tokens and cost (AC-14.1).
- [ ] Privacy policy (AR + EN) shows the AI assistant section.

### Phase 2 (account support and analytics) — UAT with 3 client accounts

- [ ] Signed in as a client with 2 tenants: "when does my academy expire?" → both listed with plan and end date (AC-15.1).
- [ ] Client whose last payment failed: "why did my payment fail?" → date, amount and a plain reason; no gateway codes; renew / update-card button (AC-16.1).
- [ ] Tenant still being set up → current step in plain words; a failed tenant → no error trace, a ticket or a handoff (AC-17.1/17.2).
- [ ] "I want to renew" → button to that academy's card on the account page (AC-18.1).
- [ ] A second client asking about the first client's slug → "not on your account", nothing about it (AC-19.1). Signed out → asked to sign in (AC-19.2).
- [ ] Reporting a bug → ticket number in the chat, the ticket in **Tickets**, a Telegram alert (AC-20.1).
- [ ] Company profile + "meeting next Tuesday at 11:00" → profile button, request in **Meetings**, alert to sales (AC-30.1). Set the brochure links and the booking page in AI Settings first.
- [ ] **AI Analytics** after the daily job has run: top topics, unknown questions; answering one adds it to the knowledge notes (AC-31.1).

### Phase 3 (WhatsApp) — UAT on the real number

- [ ] First message from a new number → the assistant replies on WhatsApp; the chat shows in the AI Inbox as **WhatsApp** with the number (AC-21.1).
- [ ] Give a name → the lead in Contacts has that WhatsApp number and source `whatsapp`; the assistant never asks for the number.
- [ ] A photo or voice note → "text only" reply.
- [ ] "When does my academy expire?" from an unlinked number → asked for the account email; an unknown email gets the same answer as a real one (AC-34.1).
- [ ] Real account email → code by email → typing it links the number (no code visible in the AI Inbox) → the next account question is answered (AC-34.2). 5 wrong codes → must start again.
- [ ] Take over in the AI Inbox → the AI stops; your reply arrives on WhatsApp; the customer's next message shows in the inbox and alerts you (FR-WA4).
- [ ] A conversation whose last customer message is older than 24 h → the reply box is disabled with the reason (FR-WA3).
- [ ] Untick "AI answers on WhatsApp" → a new message goes straight to "waiting for a person", no auto-reply.

### Phase 4 (follow-ups) — UAT

- [ ] Set **Next follow-up = today** on a test lead → run the daily job (GitHub → Actions → agent-daily-cron → Run workflow) → a draft appears in **Follow-ups**, nothing is sent, one Telegram note (AC-22.1).
- [ ] Edit the draft → **Approve & send** → it arrives (WhatsApp template or email); the lead becomes "contacted"; **AI Follow-up approved** shows on the lead timeline (AC-22.2). Clicking Send again is refused (TS-28).
- [ ] Chat as a visitor, leave a phone number and say **no** to being contacted; another time say **yes**; wait 24 h (or set the hours to 1 in settings) → only the "yes" chat gets a draft (AC-32.1).
- [ ] Get a checkout button in chat, don't pay → after 48 h (or 1 h in settings) a "Checkout not paid" draft; pay first → no draft.
- [ ] **Discard** a draft → it is never sent and shows under Discarded.

