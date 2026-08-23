# Plan — clean template, welcome email, data-dir move

Three independent changes to academy onboarding + infra. Companion to
`kashier-and-lifecycle-plan.md`.

## 1. Clean default template + branded home page

**Problem:** every new academy is seeded from `template.sql` + `moodledata-base`
that were dumped from the **EAAC** site — so new tenants start with EAAC's demo
courses/users/content.

**Goal:** a **clean Moodle** base + a nice **branded home page with placeholders**
the owner can edit.

**How:**
- Spin a throwaway container from the current image against a scratch DB → do a
  **fresh Moodle install** (no EAAC content).
- Configure a **default front page**: theme_nit layout with placeholder sections
  (hero, about, featured courses, contact) — text/images the owner overrides later.
- Dump → **new** `template.sql` + `moodledata-base` on Server B (version them, e.g.
  `template-2026.09.sql`). `create.sh` keeps importing these — no script change.
- The per-academy branding step (`apply_brand.php`) already overlays name/logo on top.

**Decide:** which placeholder sections + AR/EN default copy for the home page.

## 2. Per-academy admin credentials + welcome email

**Problem:** all academies inherit the **same admin login** from the template
(security risk) and the customer is never told how to log in.

**Goal:** each academy gets a **unique admin password**, emailed to the customer.

**How:**
- `nit2` `/api/academies` already knows the owner → add `owner_email` + `owner_name`
  to the `/provision` payload.
- `create.sh`: generate a strong password → set the Moodle admin password via CLI
  (`admin/cli/…` / `update_internal_user_password`) → flag **force change on first
  login**.
- **Send the welcome email FROM the academy's Moodle** (core `email_to_user` /
  `local_nit_emails`) with: site URL, username, password, "change it on first login".
  Keeps the password on-box — it never travels back to nit2.
- Each academy's Moodle needs working outbound email (SMTP) — set via the global
  platform settings pushed at provision time, or a shared relay.

**Decide:** username scheme (`admin` vs per-academy), email language (AR/EN), and
the SMTP/relay to send through.

## 3. Move academies dir: `/opt/saas` → `/var/www/html/saas`

**Scope:** `/opt/saas` is referenced **48×** across ~10 provisioning files
(scripts, `provision.env`, systemd unit, deploy script, docs).

**How:**
- Introduce a single **`SAAS_ROOT`** var (default new path) instead of hardcoding,
  so this never bites us again.
- Update: `create.sh`, `destroy.sh`, `update-site.sh`, `docker/migrate-client.sh`,
  `setup-provision.sh` (writes `provision.env` + paths), `saas-provision.service`
  (EnvironmentFile), `deploy-provisioning.sh` (sources `provision.env`), the `.md`s.
- **Migrate Server B:** stop `saas-provision` → `mv /opt/saas /var/www/html/saas` →
  update refs → **recreate** each academy container (mount paths changed) →
  restart service.
- Only ~2 academies exist now → **cheap to do today**, painful later. Do it first.

**Decide:** confirm target `/var/www/html/saas`.

## Suggested order
1. **Dir move** (#3) — do while academy count is ~2.
2. **Clean template + home page** (#1).
3. **Per-academy creds + welcome email** (#2) — needs #1's fresh admin.

## Open decisions (all three)
- Home page: sections + default AR/EN copy.
- Credentials: username scheme, force-change-on-first-login (yes?), email language.
- Email transport: per-academy SMTP vs one shared relay.
- Confirm the new data path `/var/www/html/saas`.
