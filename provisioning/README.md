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

```bash
docker rm -f saas_moodle_<slug>
docker exec saas_mariadb mariadb -uroot -p"$(grep DB_ROOT_PW /opt/saas/saas.env|cut -d= -f2)" \
    -e "DROP DATABASE moodle_<slug_with_underscores>;"
rm -rf /opt/saas/clients/<slug>
a2dissite <slug>.academy2026.nitg-eg.com.conf; systemctl reload apache2
```
