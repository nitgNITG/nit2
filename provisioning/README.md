# SaaS provisioning — `create.sh` (server B / Apache)

Turns a `client/<slug>` branch of **NITGg/saas-demo** into a live HTTPS site at
`https://<slug>.academy2026.nitg-eg.com` on **server B** (`157.180.118.100`,
host `3alemny`) — its own database, moodledata, and container, fronted by the
existing **Apache** (same pattern as `academy2026` itself). Nothing existing is
touched: it uses its own network + a dedicated `saas_mariadb`, and reuses the
already-built `moodle-new:latest` image.

## What `create.sh` does (the brief's 5 steps, for Apache)

1. **create virtual host** — writes `/etc/apache2/sites-available/<sub>.conf`
2. **clone academy** — clones the client's branch into `/opt/saas/clients/<slug>/code`
3. **enable vhost** — `a2ensite` + reload apache
4. **add SSL** — `certbot --apache` (issues the cert, adds the redirect)
5. **restart apache**

Plus: its own DB (`moodle_<slug>` in `saas_mariadb`, seeded from a template) and a
Moodle container on a free local port that Apache proxies to.

## Prerequisites (already done / one-time)

- Wildcard DNS `*.academy2026.nitg-eg.com` → `157.180.118.100`  ✅ (done)
- Server B has Docker, Apache, certbot — ✅ (already used by the other sites)

## Usage

```bash
sudo bash create.sh <slug> "<Academy name>"
# example:
sudo bash create.sh teacher01 "أكاديمية تجريبية"
```

First run auto-creates the shared network, the `saas_mariadb`, and the template
(`/opt/saas/template.sql` + `/opt/saas/moodledata-base`) **from the existing EAAC**.
Every run provisions the given client. → `https://teacher01.academy2026.nitg-eg.com`

## Notes

- The template starts as a copy of the current EAAC content; swap
  `/opt/saas/template.sql` + `/opt/saas/moodledata-base` for a clean base later.
- Private repo cloning: `export GITHUB_TOKEN=...` before running.
- The button (`/api/academies` on the NIT site) creates the branch; this script
  turns that branch into the live site. Wiring the button to call it comes after a
  successful manual run.

## Remove a client

`destroy.sh` is the reverse of `create.sh` — it removes the container, database,
files, and Apache vhosts (and best-effort deletes the SSL cert + log). It's
idempotent, so re-running on a half-removed client is safe.

```bash
sudo bash destroy.sh <slug>
```

The admin "delete platform" button on the NIT site calls this automatically via
the provisioning endpoint:

```
DELETE https://saas-provision.academy2026.nitg-eg.com/deprovision/<slug>
       header  X-Provision-Secret: <secret>
```

which runs `destroy.sh <slug>` in the background (logs to
`/opt/saas/logs/<slug>.log`). Deploy `destroy.sh` to `/root/destroy.sh` (path set
by `DESTROY_SH` in `/opt/saas/provision.env`) next to `create.sh`.

Manual equivalent, if you ever need the individual steps:

```bash
docker rm -f saas_moodle_<slug>
docker exec saas_mariadb mariadb -uroot -p"$(grep DB_ROOT_PW /opt/saas/saas.env|cut -d= -f2)" \
    -e "DROP DATABASE moodle_<slug_with_underscores>;"
rm -rf /opt/saas/clients/<slug>
a2dissite <slug>.academy2026.nitg-eg.com.conf; systemctl reload apache2
```

---

# How it all fits together (two servers)

- **Server A** — the nit2 app (Next.js control plane). Holds the repo + MySQL Academy records.
- **Server B** — this provisioning box. Runs the `saas-provision` systemd service
  (`provision-server.py` on `127.0.0.1:9099`, behind Apache/HTTPS) and the Docker
  academy containers.

## Runtime triggers — nobody runs scripts by hand

Every action in the nit2 dashboard/site fires an HTTP call to server B, which runs the
matching script in the background (logs to `/opt/saas/logs/<slug>.log`):

| User action (server A)                     | nit2 route                          | → server B endpoint            | script              |
|--------------------------------------------|-------------------------------------|--------------------------------|---------------------|
| Client submits **Build your product**      | `POST /api/academies`               | `POST /provision`              | `create.sh`         |
| Admin **deletes** an academy               | `DELETE /api/academies/[slug]`      | `DELETE /deprovision/<slug>`   | `destroy.sh`        |
| **Change plan** (Licenses page)            | `PATCH /api/academies/[slug]`       | `POST /apply-license/<slug>`   | `apply-license.sh`  |
| **Apply to all** (Platform Settings)       | `POST /api/platform-settings/apply` | `POST /apply-settings/<slug>`  | `apply-settings.sh` |
| **Update all sites** (Licenses)            | `POST /api/academies/update-sites`  | `POST /update-site/<slug>`     | `update-site.sh`    |

`create.sh` also receives, in the `POST /provision` body: the licence **`tier`**
(→ `local_license`), the global **`settings`** (→ `local_multitopics`, whitelisted),
and the **`brand`** (logo/favicon/names → `apply_brand.php`). Server A never runs the
scripts — it only POSTs (with `X-Provision-Secret`).

## Deploying script changes (server A → server B)

`provision-server.py` + the `*.sh` scripts live in this repo but must be *copied* to
server B. That is a devops step (not a runtime trigger):

```bash
# on server A, after `git pull`:
bash provisioning/deploy-provisioning.sh
```

It reads `SERVER_B_HOST` / `SERVER_B_USER` / `SERVER_B_SSH_KEY` / `SERVER_B_DEST` from
the app `.env`, rsync/scp's the 7 files to server B, and re-runs `setup-provision.sh`
there — reusing **server B's own** `PROVISION_SECRET` / `GITHUB_TOKEN` from
`/opt/saas/provision.env` (secrets never cross the wire).

### SSH prerequisite (do you need a password?)

The deploy uses **key-based SSH — no password**, once set up. From server A, one time:

```bash
ssh-keygen -t ed25519            # only if server A has no key yet (press Enter through prompts)
ssh-copy-id <SERVER_B_USER>@<SERVER_B_HOST>   # asks for server B's password ONCE, to install the key
```

After that, `deploy-provisioning.sh` connects without a password. Set
`SERVER_B_SSH_KEY` in `.env` if the key isn't the default `~/.ssh/id_ed25519`.

Two auth points to know:
- **SSH login A→B** — solved by the key above (no password after setup).
- **`sudo` on B** — the deploy runs `sudo setup-provision.sh`. If the deploy user's
  sudo needs a password, `ssh -t` prompts for it interactively; give the user
  passwordless sudo to skip that.

(No key access? You'd have to prefix with `sshpass -p '<pw>' ...` — discouraged; set up
the key instead.)

## First-time / after-changes runbook

1. **Push** nit2 `main` and saas-demo `main` to their remotes.
2. **Server A:** `cd /var/www/html/nit-dev && bash update.sh`. Ensure `.env` has
   `PROVISION_URL`, `PROVISION_SECRET`, and (for the deploy) `SERVER_B_*`.
3. **Ship scripts to B:** `bash provisioning/deploy-provisioning.sh` (ends with `active`).
4. **Dashboard:** Platform Settings → fill + **Apply to all**; Licenses → set tiers +
   **Update all sites**.
5. **Test:** create an academy from the Build form — it provisions with branding +
   tier + global settings automatically.
