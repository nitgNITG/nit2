# Custom domain — first live bind (runbook)

Bind a customer's own domain to a live academy and make it the canonical URL with
SSL. Feature = Phase 2 (owner self-serve). This runbook is for the **first real
bind** on the server, to confirm the pipeline end-to-end.

Concepts: the academy already runs behind `<slug>.academy2026.nitg-eg.com` (a
wildcard-DNS subdomain + Apache reverse proxy + per-name certbot). Binding a
custom domain adds the **same** three pieces for the customer's domain, then
switches Moodle's `$CFG->wwwroot` to it; the subdomain keeps proxying and Moodle
301-redirects it to the new canonical domain.

## 0. One-time prerequisites

- **DB migration applied** (adds `Academy.customDomain/domainStatus/domainError`):
  ```bash
  npm run mysql:deploy
  ```
- **nit2 rebuilt & restarted** after `git pull` (App Router picks up the new API +
  UI).
- **Provisioning scripts shipped to server B** (installs `bind-domain.sh`,
  `unbind-domain.sh`, and the new `provision-server.py` endpoints), then restart
  the provision service:
  ```bash
  bash provisioning/deploy-provisioning.sh
  sudo systemctl restart saas-provision   # or however the provision service runs
  ```
- **Env on server B (provision service):** `SAAS_CLIENT_DOMAIN` (default
  `academy2026.nitg-eg.com`), `LE_EMAIL` (certbot account email), and
  `SERVER_PUBLIC_IP` = server B's public IPv4. Set `SERVER_PUBLIC_IP` in nit2's env
  too — it's used for the apex A-record instruction and DNS verification.
- **Ports/firewall:** 80 and 443 open to the internet (certbot HTTP-01 uses 80).
- Pick a **throwaway test academy** for the first bind, and a domain you control,
  e.g. `test.yourdomain.com`.

## 1. Customer adds DNS

From the owner account page (or `GET /api/academies/<slug>/domain`) you get the
exact record. Two shapes:

- **Subdomain** (`academy.customer.com`): a **CNAME** → `<slug>.academy2026.nitg-eg.com`.
- **Apex / root** (`customer.com`): a **CNAME isn't allowed on an apex**, so an
  **A record** → `SERVER_PUBLIC_IP`.

Wait for it to propagate. Check from anywhere:
```bash
dig +short academy.customer.com
```
It should return server B's IP (directly, or via the CNAME chain).

## 2. Bind

**Owner path (the real flow):** account page → the academy's **Custom domain**
card → type the domain → **Save** → **"I've added it — verify & activate"**.

**Admin/curl equivalent** (cookie-authenticated as owner or admin):
```bash
# set the intended domain (→ pending_dns, returns DNS instructions)
curl -X POST https://dev.nitg-eg.com/api/academies/<slug>/domain \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"domain":"academy.customer.com"}'

# verify DNS + trigger the bind (→ verifying)
curl -X PUT https://dev.nitg-eg.com/api/academies/<slug>/domain -b cookies.txt
```
`PUT` returns **409** with a reason if DNS isn't pointing here yet — fix DNS and
retry. On success the status goes to **verifying**; the UI polls until
**active**/**failed** (admins also get a Telegram/email on start + result).

## 3. Verify on server B

```bash
# vhost created and enabled
ls -l /etc/apache2/sites-enabled/academy.customer.com.conf
apache2ctl -S | grep academy.customer.com

# cert issued
certbot certificates | grep -A3 academy.customer.com

# Moodle canonical URL switched
grep wwwroot /var/www/html/saas/clients/<slug>/config.php
# → $CFG->wwwroot   = 'https://academy.customer.com';

# the bind result nit2 polls
cat /var/www/html/saas/clients/<slug>/domain-status.json   # {"state":"active",...}

# full log of the run
tail -n 60 /var/www/html/saas/logs/<slug>.log
```
Then in a browser: `https://academy.customer.com` loads with a valid cert, and
hitting the old `https://<slug>.academy2026.nitg-eg.com` 301-redirects to it.

## 4. Post-bind: Google login

The canonical URL changed, so the academy's **Google OAuth redirect URI changed**
too — binding re-arms the "Google URL missing" flag. In **Dashboard → Academies**,
copy the academy's OAuth URL (now `https://academy.customer.com/admin/oauth2callback.php`),
add it in the Google Cloud console's Authorized redirect URIs, then mark it done.

## 5. Rollback (unbind)

Owner: **Remove** on the domain card. Admin/curl:
```bash
curl -X DELETE https://dev.nitg-eg.com/api/academies/<slug>/domain -b cookies.txt
```
This reverts `$CFG->wwwroot` to the subdomain, purges caches, and disables/removes
the custom vhost (the issued cert is left in place — harmless).

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `PUT` returns 409 "DNS isn't pointing here" | DNS not propagated or wrong record. Re-check `dig +short <domain>` = server IP. |
| status `failed`, log shows certbot error | `<domain>` doesn't resolve to this host yet, or port 80 blocked. Fix, then re-run verify/activate. |
| Let's Encrypt rate-limit | Too many failed issues for that name. Wait (the DNS pre-check exists to avoid this) — don't retry in a loop. |
| Site loads on the domain but links go to the subdomain | `wwwroot` not updated / caches not purged — re-run, or `docker exec saas_moodle_<slug> php admin/cli/purge_caches.php`. |
| Google login broken after bind | Redirect URI not re-added for the new domain (step 4). |
| App users on the old subdomain | Expected — wwwroot is now the custom domain. Bind custom domains early, before an academy has many app users. |
