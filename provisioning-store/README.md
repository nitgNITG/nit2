# provisioning-store — the store provisioner

The host agent that turns a nit2 request into a live merchant store
(`https://<slug>.commerce.nitg-eg.com` · `/dashboard` · `/apis`). It is the store
counterpart of `provisioning/` (academies): same shape (shared-secret HTTP service +
bash scripts + `provision.env` + systemd), different tenant model — **one docker
compose project per store** running the three `saas-store-{api,site,dash}` images
built from `saas-commerce/Dockerfile`.

Portable by design: everything it needs is in this folder; `setup.sh` prepares any
Ubuntu host (Docker, shared MariaDB, web server detection, certbot, service). The
first deployment is the nit2 box itself (`deploy.sh --local`), where the service
listens on `127.0.0.1:9098` and nit2 calls it over localhost.

## Files

| File | Role |
|---|---|
| `setup.sh` | idempotent host setup; writes `provision.env` (existing values preserved), installs scripts to `STORE_ROOT`, systemd unit |
| `provision-server.py` | HTTP API (below), SQLite job queue + worker pool, progress callbacks to nit2 |
| `lib.sh` | shared helpers: paths, ports, compose/CLI wrappers, `report_step/done/failed` |
| `create-store.sh` | the 11-step creation (db → store.env/compose.yml → `compose up` → `cli setup` → vhost + certbot → smoke) |
| `destroy-store.sh` | full teardown, safe on half-created stores |
| `apply-license.sh` · `apply-suspend.sh` · `reset-owner.sh` | day-2 ops through the api CLI (sync) |
| `update-image.sh` · `bump-image.sh` | move one / every store to an image tag; compose recreates only changed services |
| `bind-domain.sh` · `unbind-domain.sh` | merchant custom domain (vhost + cert + `PUBLIC_URL`) |
| `proxy/proxy.sh` + templates | host web-server adapter (`PROXY=nginx\|apache`), reload-only, per-host certbot |
| `upload-image.sh` | signed Cloudinary upload (store logo at creation) |
| `compose.store.yml` | **copy of `saas-commerce/deploy/compose.store.yml`** — keep in sync when that file changes |
| `deploy.sh` | rsync this folder to a host and run `setup.sh` (`--local` for this box) |

On the host: `STORE_ROOT=/var/www/html/saas-stores` holds `provision.env`, the scripts,
`clients/<slug>/{store.env,compose.yml,domain-status.json,pin}`, `logs/<slug>.log`,
`staging/`, `jobs.sqlite` and (when created here) `mariadb/`.

## HTTP API (header `X-Provision-Secret`)

| Endpoint | Body | Result |
|---|---|---|
| `POST /provision` | `{slug, name, name_ar?, owner:{email,name,locale,password?}, store:{country,currency,timezone,default_locale,vat_rate,theme,contact,social,logo:{filename,data_b64}}, tier, definition, license:{expires_at,subscribed_at,grace_days,renew_url}, image_tag?, force?}` | `202 {job}` — queued; `force:true` (retry) destroys a half-created store first, in the same job |
| `GET /status/<slug>` | — | latest job: `state queued\|running\|done\|failed`, `step/total/label`, `url`, `error`, `log_tail` |
| `POST /apply-license/<slug>` | `{tier, definition, expires_at, …}` | sync, CLI result |
| `POST /suspend/<slug>` | `{suspended}` | sync |
| `POST /reset-owner/<slug>` | `{email?}` | sync; returns the new temporary password (nit2 stores it encrypted) |
| `POST /tls/<slug>` | — | (re)issue the Let's Encrypt certificate; a creation whose certbot failed (DNS not ready) goes live over HTTP with `tls:"pending"` |
| `POST /update-image/<slug>` · `POST /update-image` | `{tag}` | one store (queued) · every store (detached `bump-image.sh --all`; 409 while one is running) |
| `GET /config` · `POST /config` | `{values}` | host settings nit2's Platform Settings → Stores tab manages (mail, Cloudinary, Google, memory, auto-update). POST rewrites `provision.env` (shell-quoted) and runs `apply-config.sh` to re-apply the per-store keys to every running store |
| `GET /images` | — | tags on the registry ∩ local, `current` platform tag, `latest` release, `auto_update` + `rollout` state (the dashboard version picker) |
| `POST /bind-domain/<slug>` · `POST /unbind-domain/<slug>` · `GET /domain-status/<slug>` | `{domain}` | queued |
| `DELETE /deprovision/<slug>` | — | queued `destroy-store.sh` |
| `GET /health` · `GET /usage` | — | host snapshot (nit2's create gate) · per-store image tag + DB size |

**Auto-update.** With `AUTO_UPDATE=1` (default) the service checks the registry every
`AUTO_UPDATE_MINUTES` (15) and rolls every store to the newest `X.Y.Z` tag when it differs
from `IMAGE_TAG` in `provision.env` — the CI callback is the fast path, this is the safety
net (box was down when CI called, image pushed by hand). Pinned stores (`clients/<slug>/pin`)
are skipped as always; a failed rollout is retried hourly. `sha-*` / `latest` are never
auto-followed. Set `AUTO_UPDATE=0` to move stores only via CI or the dashboard.

Every queued job reports each step to nit2 — `POST $CALLBACK_URL/api/tenants/<slug>/progress`
with `x-worker-secret: $WORKER_SECRET` and `{product:"store", job, kind, state, step, total,
label, url?, error?, image_tag?, owner_email?, owner_password?}` — and always ends with an
explicit `done` or `failed`. A service restart marks in-flight jobs `failed` (and says so)
instead of losing them.

## Operator runbook

```bash
# install / update on this box
bash provisioning-store/deploy.sh --local
# then fill in provision.env (MAIL_*, CLOUDINARY_*, GHCR_*, CALLBACK_URL, WORKER_SECRET) and
systemctl restart saas-store-provision

# create a store by hand
curl -s -X POST http://127.0.0.1:9098/provision -H "X-Provision-Secret: $S" -H 'Content-Type: application/json' \
  -d '{"slug":"ziad","name":"Ziad Store","owner":{"email":"ziad@example.com","name":"Ziad"},"tier":"basic","definition":{"limits":{"products":100,"staff":3}}}'
curl -s http://127.0.0.1:9098/status/ziad -H "X-Provision-Secret: $S" | python3 -m json.tool
tail -f /var/www/html/saas-stores/logs/ziad.log          # ends with "'Ziad Store' is live:  https://…"

# poke a store
cd /var/www/html/saas-stores/clients/ziad && docker compose -p store_ziad --env-file store.env ps
docker compose -p store_ziad --env-file store.env exec api node dist/cli.js status

# roll out a release (CI does this on tag v*)
curl -s -X POST http://127.0.0.1:9098/update-image -H "X-Provision-Secret: $S" -d '{"tag":"1.2.0"}'
tail -f /var/www/html/saas-stores/logs/bump-image.log
# pin one store to a tag: touch clients/<slug>/pin (content = tag) — bump --all skips it

# remove
curl -s -X DELETE http://127.0.0.1:9098/deprovision/ziad -H "X-Provision-Secret: $S"
```

DNS: one wildcard `A` record `*.commerce.nitg-eg.com → <host IP>` (Namecheap). TLS:
`TLS_MODE=per-host` issues a Let's Encrypt cert per store at creation via certbot's
nginx/apache plugin (HTTP-01), exactly like the academies. Let's Encrypt allows 50
new certificates per registered domain per week — the practical cap on store
creation rate until a wildcard cert is used.
