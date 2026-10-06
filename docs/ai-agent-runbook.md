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

## 2. Deploy order (SRS §13.4)

**The MySQL migration must run before the new code serves traffic.** Prisma now reads
`User.agentPermissions` on every sign-in; without the column every login fails.

1. Back up MongoDB and MySQL.
2. `npm run mysql:deploy` — adds the nullable `User.agentPermissions` column (migration 25).
3. `npm run mongo:push` — new collections + optional fields only; existing documents are untouched.
4. `node scripts/agent-indexes.mjs` — TTL indexes (sessions 30 d, tool audit 180 d, idempotency 7 d, rate-limit buckets).
5. Deploy the build (`git pull && npm run build && <restart>`). The agent ships **off**.
6. Schedule the daily cron (next section).
7. Dashboard → **AI Settings**: set the daily budget, then switch **Website chat on**.

Rollback: switch the agent off in AI Settings, redeploy the previous build. The new
collections and the nullable column can stay.

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
