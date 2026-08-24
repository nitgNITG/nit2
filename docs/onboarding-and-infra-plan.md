# Plan — clean template, welcome email, data-dir move

Three onboarding/infra changes. Companion to `kashier-and-lifecycle-plan.md`.
Decisions below are **resolved** unless marked otherwise.

## 1. Clean template + branded, editable home page

**Problem:** new academies are seeded from a `template.sql` dumped from **EAAC** —
they start with EAAC's demo content.

**Goal:** a **clean Moodle** base + a **teacher-editable landing page** modeled on
`nohahashim.com`, filled with placeholders the owner edits graphically.

**Home-page sections (in order), all editable placeholders:**
1. **Header** — logo, platform name, nav, login/register, phone
2. **Hero** — full-width hero image (editable)
3. **About** — heading + bullet text + image (right) + social links
4. **Courses** — auto from the academy's Moodle courses (cards + "Start now")
5. **Gallery** — image thumbnails
6. **Contact CTA** — heading, phone(s), logo, social links
7. **Footer** — N.I.T credit

**Editable fields the teacher controls (graphical):**
brand colour (Brand Colors gallery ✓), logo, platform name, hero image,
about image + about text, social links (FB / WhatsApp / YouTube / …), gallery,
contact phones.
→ Most already exist as **theme_nit** config (`branding_export` / `links_export`).
Work = (a) seed a **default front page** with these sections + placeholder copy in
the template, (b) fill any missing editable settings so the teacher can do it all
from the theme UI (no Moodle admin digging).

**How to build the template:** fresh Moodle install in a throwaway container →
configure the front page + placeholders → dump to a **versioned**
`template-YYYY.MM.sql` + `moodledata-base`. `create.sh` keeps importing these.

*Decide:* final placeholder AR/EN copy per section.

## 2. Per-academy admin credentials + welcome email  (RESOLVED)

**Problem:** all academies inherit the template's **same admin login**; the
customer is never told how to log in.

**Decisions:**
- **Owner-as-admin:** create the customer as a **site admin, username = their email**;
  keep the built-in `admin` with a random locked password. (Better UX + security
  than a shared `admin`.)
- **Force password change on first login.**
- **Welcome email sent FROM the academy's Moodle** (core `email_to_user` /
  `local_nit_emails`) → password never returns to nit2.
- **Email language = the user's page locale** (pass `locale` in the provision payload).

**How:**
- `nit2 /api/academies` → add `owner_email`, `owner_name`, `locale` to `/provision`.
- `create.sh` → create the owner admin account + generated strong password +
  force-change flag → trigger the localized welcome email.

## 3. Move academies dir: `/opt/saas` → `/var/www/html/saas`  (CONFIRMED)

**Scope:** `/opt/saas` referenced **48×** across ~10 provisioning files.

**How:**
- Introduce a single **`SAAS_ROOT`** (default `/var/www/html/saas`) — stop hardcoding.
- Update: `create.sh`, `destroy.sh`, `update-site.sh`, `docker/migrate-client.sh`,
  `setup-provision.sh` (writes `provision.env` + paths), `saas-provision.service`
  (EnvironmentFile path), `deploy-provisioning.sh` (sources `provision.env`), docs.
- **Migrate Server B:** stop `saas-provision` → `mv /opt/saas /var/www/html/saas` →
  redeploy scripts → **recreate** each academy container (mount paths change) →
  restart. Only ~2 academies now → do it **first**.

## Email transport (RESOLVED)
**Shared relay** — one transactional sender (nitg-eg.com subdomain, proper
SPF/DKIM), From-name = academy name, pushed to every academy via platform
settings at provision. (Per-academy SMTP rejected: unusable deliverability +
support load for self-serve teachers.)

## Order of work
1. **Dir move** (#3) — confirmed, cheap now.
2. **Clean template + home page** (#1).
3. **Per-academy creds + welcome email** (#2) — needs #1's fresh admin + the relay.

## Still to decide
- Home-page placeholder copy (AR/EN) per section.
- The shared relay's SMTP account/domain to send through.
