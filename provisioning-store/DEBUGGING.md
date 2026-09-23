# Debugging a store

Everything below runs **on the store host** (the box where `provisioning-store/`
is installed). `clients/` is root-owned, so prefix commands with `sudo`.

```bash
SLUG=store-7                      # the store you are looking at
P=store_${SLUG//-/_}              # its compose project (hyphens become underscores)
```

## Where everything lives

| Path | What it is |
|---|---|
| `/var/www/html/saas-stores/provision.env` | host settings (tag, mail, Cloudinary, auto-update). Managed from nit2 → Platform Settings → 🛒 Stores; don't hand-edit those keys |
| `/var/www/html/saas-stores/clients/<slug>/store.env` | that store's settings (ports, DB, IMAGE_TAG) |
| `/var/www/html/saas-stores/clients/<slug>/compose.yml` | copy of the compose template, refreshed on every rollout |
| `/var/www/html/saas-stores/clients/<slug>/pin` | if present, fleet rollouts skip this store |
| `/var/www/html/saas-stores/logs/<slug>.log` | create / update / reset / destroy job output for that store |
| `/var/www/html/saas-stores/logs/bump-image.log` | fleet rollouts (CI callback + auto-update) |
| `/var/www/html/saas-stores/logs/apply-config.log` | "Push to store host" runs |
| `journalctl -u saas-store-provision` | the service itself (queue, auto-update, HTTP errors) |

## Step 1 — which layer is broken?

A request goes: **browser → nginx (host) → site/dash container → api container → MariaDB**.

```bash
sudo docker ps --filter "name=$P" --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
```

* A container missing or `Restarting` → that's your culprit, go to its log.
* All `Up` → the failure is inside the app, not in docker.

What the symptom usually means:

| What you see | Where to look first |
|---|---|
| **502 Bad Gateway** (nginx page) | the container for that path is down or not listening — `docker ps`, then its log |
| **"This page couldn't load"** (dark page) | the **site** container ran but threw — nearly always the api is erroring; read the api log |
| **"This store has not been set up yet" / suspended notice** | licence state, not a crash — `cli status` below |
| **403 `FEATURE_UNAVAILABLE`** | the plan doesn't include that feature (blog/ads/coupons/reports) — check the licence in nit2 |
| **404 on a page that exists** | the container is running an older image — check the tag (Step 4) |

## Step 2 — read the logs

```bash
sudo docker logs --tail 50 $P-api-1     # the one that matters most
sudo docker logs --tail 30 $P-site-1
sudo docker logs --tail 30 $P-dash-1
sudo docker logs -f $P-api-1            # follow while you reproduce
```

The api logs JSON in production. Common lines:

* `Invalid prisma.<model>.<op>() invocation … Unknown argument` → the code and the
  database schema disagree (a migration dropped/renamed a column). Fix the code;
  **never** "fix" it with `db push` on a live store.
* `P1001 Can't reach database server` → MariaDB down, or the store's DB creds are
  wrong. `sudo docker ps | grep saas_mariadb`.
* `migrate found failed migration` → a migration errored half-way; see Step 6.

## Step 3 — ask the store itself

```bash
sudo docker compose -p $P --env-file /var/www/html/saas-stores/clients/$SLUG/store.env \
  -f /var/www/html/saas-stores/clients/$SLUG/compose.yml exec -T api node dist/cli.js status
```

Prints one JSON line: store name, whether an owner exists, the licence
(`active`, `suspended`, `expired`, limits, features) and the image tag it thinks
it is. This is the fastest way to tell "broken" from "working but locked".

Health straight from the api, bypassing nginx:

```bash
P_API=$(sudo sed -n 's/^P_API=//p' /var/www/html/saas-stores/clients/$SLUG/store.env)
curl -s http://127.0.0.1:$P_API/apis/v1/health; echo
```

`{"ok":true,"db":true,...}` means the api and its database are fine — then the
problem is above it (site/dash or nginx).

## Step 4 — is it running the image you think?

The single most common false lead. Compare what compose *would* use with what is
*actually* running:

```bash
sudo grep IMAGE_TAG /var/www/html/saas-stores/clients/$SLUG/store.env
for s in api site dash; do echo -n "$s: "; sudo docker inspect --format '{{.Config.Image}}' $P-$s-1; done
```

If they differ, roll the store again from nit2 (**move to…**) — `update-image.sh`
verifies the running image by ID and force-recreates, so a mismatch afterwards is
a real failure, not a silent one.

> `dev` is a *moving* tag: the name never changes, so "already on dev" says
> nothing. Compare image IDs:
> `sudo docker image inspect --format '{{.Id}}' ghcr.io/nitgg/saas-store-site:dev`
> against `sudo docker inspect --format '{{.Image}}' $P-site-1`.

## Step 5 — provisioning failed (the store never came up)

```bash
sudo tail -60 /var/www/html/saas-stores/logs/$SLUG.log
```

The log is numbered `[1/11] … [11/11]`; the step it stops on tells you what
failed. Frequent ones:

* **`[8/11] Bootstrapping store` → `cli setup failed`** — the api image and the
  provisioning payload disagree (a dropped column). Code fix + new image.
* **`[9/11] … certbot`** — DNS for `<slug>.commerce.nitg-eg.com` isn't pointing
  here yet. The store still goes live over HTTP with `tls: pending`; use **Issue
  TLS** in the dashboard once DNS is ready.
* **`[10/11] Smoke test`** — the containers are up but the app answers non-200;
  go back to Step 2.

The failed attempt is destroyed automatically, so "Retry" in the dashboard is
safe. Queue state for the service itself:

```bash
sudo journalctl -u saas-store-provision -n 50 --no-pager
```

## Step 5b — no welcome e-mail / images don't upload

The store reads SMTP, Cloudinary and Google **from its own database row**
(`IntegrationSettings`), not from its container environment — the merchant can
override them in the dashboard. The provisioner seeds that row from
`provision.env` at creation, and **Push to store host** re-sends it to existing
stores. So:

* `(welcome e-mail NOT sent — mail not configured)` on a *new* store → `MAIL_*`
  was empty in `provision.env` when it was created, or the values never reached
  the row. Fill them in nit2 → Platform Settings → 🛒 Stores → Save → **Push to
  store host**, then `Credentials → Reset owner password` to send the mail again.
* Same for `CLOUDINARY_*` and image uploads.

```bash
sudo tail -20 /var/www/html/saas-stores/logs/apply-config.log   # what was pushed
```

## Step 6 — database

Day-2 work goes through the store's CLI, not SQL. Read-only poking is fine:

```bash
DB=$(sudo sed -n 's/^DB_NAME=//p' /var/www/html/saas-stores/clients/$SLUG/store.env)
PW=$(sudo sed -n 's/^DB_ROOT_PW=//p' /var/www/html/saas-stores/provision.env)
# The client binary is `mariadb` — recent images no longer ship a `mysql` alias.
sudo docker exec -it saas_mariadb mariadb -uroot -p"$PW" \
  -e "USE \`$DB\`; SHOW TABLES; SELECT id,email,is_platform FROM store_user;"
```

What the store is really enforcing, straight from its row — the same thing
`cli status` prints, and the way to check it on an image older than that command:

```bash
sudo docker exec saas_mariadb mariadb -uroot -p"$PW" -N \
  -e "SELECT tier, definition FROM \`$DB\`.platform_license WHERE id=1"
```

A failed migration blocks every start-up. Look at `_prisma_migrations` for the
row with `finished_at` NULL and fix forward (a new migration in `saas-commerce`),
rather than editing tables by hand.

## Step 7 — restart, rebuild, last resorts

```bash
# restart one service
sudo docker compose -p $P --env-file …/store.env -f …/compose.yml restart api
# recreate all three on the tag in store.env
sudo docker compose -p $P --env-file …/store.env -f …/compose.yml up -d --force-recreate
# the provisioner itself
sudo systemctl restart saas-store-provision
```

Deleting a store from the nit2 dashboard removes containers, database, files and
the nginx vhost — irreversible, and only the right move for a test store.

## Talking to the provisioner directly

```bash
S=$(sudo sed -n 's/^PROVISION_SECRET=//p' /var/www/html/saas-stores/provision.env)
H="X-Provision-Secret: $S"
curl -s -H "$H" http://127.0.0.1:9098/health | head -c 400; echo      # host snapshot
curl -s -H "$H" http://127.0.0.1:9098/usage  | head -c 400; echo      # per-store tag + DB size
curl -s -H "$H" http://127.0.0.1:9098/images | head -c 400; echo      # tags it can run
curl -s -H "$H" http://127.0.0.1:9098/status/$SLUG | head -c 400; echo # last job + log tail
```

## Rules that keep the fleet sane

* Change host settings in **nit2 → Platform Settings → 🛒 Stores**, then **Push to
  store host** — hand edits to `provision.env` are overwritten by the next push.
* Never run `prisma db push` against a live store; ship a migration.
* Pin a store you are experimenting with (`sudo touch clients/<slug>/pin`) so
  fleet rollouts leave it alone — and remember to remove the file afterwards.
