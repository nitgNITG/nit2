# SaaS academies — the baked-image workflow (team guide)

How our multi-tenant Moodle SaaS runs **now** (baked Docker image, not per-client
git clones). Read this before touching academies, code, or the servers.

## The big idea

The Moodle code is **baked into one Docker image**, shared by every academy
container. A tenant is just: a **config file + a data dir + a database** on top of
that shared image.

- Per academy on the server ≈ **140 MB** (was ~820 MB with the old clone-per-client).
- Change code = build a **new image version**, not edit files on the server.

## The pieces

| Thing | What / where |
|---|---|
| **Code repo** | `NITGg/saas-demo` (the Moodle code + our plugins/theme) |
| **Image** | `ghcr.io/nitgg/saas-moodle:<version>` — built by GitHub Actions, stored in GHCR |
| **Control plane** | `nit2` (Next.js + MySQL) on **Server A** — the dashboard + `/api/academies` |
| **Runtime** | **Server B** (`157.180.118.100`, host `3alemny`) — Docker, Apache, the academy containers |
| **Provisioner** | `provision-server.py` on Server B, called by nit2 over HTTPS; runs the `*.sh` scripts |

Per academy on Server B:
- `/var/www/html/saas/clients/<slug>/config.php` — mounted into the container (read-only)
- `/var/www/html/saas/clients/<slug>/moodledata` — uploads, cache, sessions
- database `moodle_<slug>` in the shared `saas_mariadb` container
- Apache vhost + HTTPS at `https://<slug>.academy2026.nitg-eg.com`

## Where's the code? (it's NOT on the server)

The code lives in the **image**, inside each container at `/var/www/html`:
```bash
docker exec -it saas_moodle_<slug> bash    # look around
docker exec saas_moodle_<slug> ls /var/www/html/public/theme/nit
```
⚠️ **Never edit code inside a container** — it's wiped on the next recreate. The
image is the source of truth. To change code, cut a new image (below).

## Changing Moodle code (theme, plugins, etc.)

```
1. edit + commit in the saas-demo repo (branch: main)
2. git tag vYYYY.MM  &&  git push origin vYYYY.MM
3. → GitHub Actions builds & pushes ghcr.io/nitgg/saas-moodle:YYYY.MM
   (watch: GitHub → saas-demo → Actions)
4. on Server B:  docker pull ghcr.io/nitgg/saas-moodle:YYYY.MM
5. roll academies onto it (below)
```
> Tags must be **lowercase** in the image path: `ghcr.io/nitgg/...` (GHCR rule).
> Pin versions (`:2026.08`), don't rely on `:latest`, so you can roll back.

### Pin the version the provisioner uses
`SAAS_IMAGE` in `/var/www/html/saas/provision.env` (Server B) decides which image **new**
academies get. To move to a new version:
```bash
sed -i 's#saas-moodle:.*#saas-moodle:2026.09#' /var/www/html/saas/provision.env
systemctl restart saas-provision
```

### Update existing academies to a new image
```bash
docker pull ghcr.io/nitgg/saas-moodle:2026.09
SAAS_IMAGE=ghcr.io/nitgg/saas-moodle:2026.09 bash /root/update-site.sh <slug>
```
This recreates the container from the new image, runs `upgrade.php` + purges caches.
DB + moodledata are preserved. **Rollback** = same command with the old tag.

## Everyday operations (Server B, as root)

```bash
# create one academy (normally the dashboard does this via the API)
SAAS_IMAGE=ghcr.io/nitgg/saas-moodle:2026.08 sudo -E bash /root/create.sh <slug> "<Name>"

# delete one (container + db + files + domain + cert)
sudo bash /root/destroy.sh <slug>

# a client with CUSTOM code (rare): clone+bind-mount instead of the shared image
CUSTOM_CODE=1 SAAS_IMAGE=... sudo -E bash /root/create.sh <slug> "<Name>"
```

Normal actions come from the **nit2 dashboard**, which calls the provisioner:
`POST /provision`, `DELETE /deprovision/<slug>`, `POST /update-site/<slug>`, etc.

## Deploying script / provisioner changes (Server A → B)

The `*.sh` + `provision-server.py` live in this `provisioning/` folder (in nit2).
After editing + pushing nit2:
```bash
# on Server A, in the nit2 checkout:
git pull
bash provisioning/deploy-provisioning.sh   # rsyncs the 8 files to Server B + restarts the service
```
Needs passwordless SSH from Server A → Server B (see the main README's SSH section).

## Deploying nit2 (the dashboard/site itself)

```bash
# on Server A:
cd /var/www/html/nit-dev && bash update.sh   # git pull + build + PM2 restart
```

## Health / sizes / cleanup

```bash
docker ps -s                       # per-container size (academies ~57kB + shared image)
docker system df                   # images / containers / volumes / build cache
du -sh /var/www/html/saas/clients/*         # disk per academy (~140MB)
source /var/www/html/saas/saas.env; docker exec saas_mariadb mariadb -uroot -p"$DB_ROOT_PW" \
  -e "SELECT table_schema, ROUND(SUM(data_length+index_length)/1024/1024,1) mb \
      FROM information_schema.tables GROUP BY table_schema ORDER BY mb DESC;"
docker builder prune -a -f         # reclaim build cache (safe; builds run in CI now)
```

## Logs & troubleshooting

- Provisioning log per academy: `/var/www/html/saas/logs/<slug>.log`
- `create.sh` says **"image not found"** → wrong case (`nitgg` not `NITGg`) or not pulled yet.
- New academy fails → check the image is pulled on Server B and `SAAS_IMAGE` in `provision.env`.
- Site 303 on first load = healthy (Moodle redirect to login).

## One-time / rare

- **New base image** (PHP version, extensions): edit `.docker/Dockerfile.ci` in saas-demo, tag, rebuild.
- **GHCR login on Server B** (to pull private images): `docker login ghcr.io -u <user>` with a PAT that has `read:packages`.

---
See also: `MIGRATION-docker-image.md` (why/how we moved to this) and the main
`README.md` (provisioning endpoints + SSH setup).
