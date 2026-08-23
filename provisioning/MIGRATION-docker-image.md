# Migration plan — bake the Moodle code into a Docker image

**Goal:** stop giving every academy its own ~700 MB `code/` folder (a full
`git clone`). Bake the code **once** into a versioned image; each client keeps
only its `config.php` + `moodledata` + database. Result: **706 MB → ~120 MB per
client**, no `git` on the server, versioned + rollback-able updates.

This is "Phase 2" from `docs/saas/academy-saas-analysis.md` §4A.

## Status — facts confirmed on server B (2026-08-23)

- `moodle-new:latest` is **PHP-only** — `docker run --rm moodle-new:latest ls
  /var/www/html` returned **empty**. Code exists only via the per-client bind mount.
- **12 academy containers** all run `moodle-new:latest`, each bind-mounting its own
  ~700 MB copy → this is the duplication we're killing.
- The base **Dockerfile** (`/var/www/html/moodle-new-version/Dockerfile`) is
  `php:8.3-apache` + Moodle extensions + `php-moodle.ini` + `000-default.conf`
  (DocumentRoot → `public`). It does **not** copy code. We keep it as the base and
  add one code layer on top.
- **Decisions locked in:** config = per-client mounted file (lowest risk);
  image build = **local on server B** first (GHCR/CI later); custom clients =
  `CUSTOM_CODE=1` bind-mount fallback.

## Concrete files produced (in this `provisioning/` folder)

| File | What it is |
|------|-----------|
| `docker/Dockerfile` | `FROM moodle-new:latest` + `COPY . /var/www/html` — bakes the code in. |
| `docker/.dockerignore` | Keeps `.git`, `config.php`, `moodledata`, dumps, backups out of the image. |
| `docker/build-image.sh` | Builds `saas-moodle:<date>` on server B from a **clean** `saas-demo` clone. |
| `docker/migrate-client.sh` | Converts one existing client to the baked image; deletes its `code/` only after an HTTP health check. |
| `create.image.sh` | Baked-image variant of `create.sh` (no clone; mounts config.php + moodledata; `CUSTOM_CODE=1` fallback). |
| `update-site.image.sh` | Baked-image variant of `update-site.sh` (recreate from new tag instead of `git pull`). |

> These are **drafts alongside** the live scripts — nothing existing was changed.
> Test on one client, then rename `*.image.sh` over `create.sh` / `update-site.sh`
> and ship via `deploy-provisioning.sh` (add the two to its `FILES=(...)` list).

---

## 1. Current state (Phase 1) — what we have today

Per client, `create.sh` does:

1. `git clone --depth 1 --branch client/<slug>` → `/opt/saas/clients/<slug>/code`
   (594 MB working tree + 110 MB `.git`).
2. Container runs `moodle-new:latest` with the code **bind-mounted**:
   `-v <code>:/var/www/html` and `-v <moodledata>:/var/www/moodledata`.
3. `config.php` written **into** the code dir.
4. DB `moodle_<slug>` in shared `saas_mariadb`, seeded from `template.sql`.
5. Branding: `brand.json` + logos written into `code/nit-brand`, then
   `apply_brand.php` run inside the container.
6. `enable_mlang.php` written into the code dir and run once.
7. Updates (`update-site.sh`): `git pull` **inside the container**.

**The whole problem:** the code is bind-mounted from a per-client clone, so it's
copied fresh for every academy, and `.git` is load-bearing (updates `git pull` it).

We confirmed with the user: **all academies run the same code**; only logo + name
differ; **occasionally** one academy may need custom code (the exception, not the rule).

---

## 2. Target state (Phase 2) — code baked into the image

- Build image `saas-moodle:<version>` that `COPY`s the `saas-demo` code into
  `/var/www/html`. The code now lives **once** in Docker's layer store; every
  container shares those layers copy-on-write.
- Per client on the host: **no `code/` folder**. Only:
  - `/opt/saas/clients/<slug>/config.php`  (a ~15-line file)
  - `/opt/saas/clients/<slug>/moodledata`  (~120 MB — real data, unavoidable)
  - the `moodle_<slug>` database
- `docker run` mounts **only** `config.php` (over the baked path) + `moodledata`:
  ```
  -v /opt/saas/clients/<slug>/config.php:/var/www/html/config.php:ro
  -v /opt/saas/clients/<slug>/moodledata:/var/www/moodledata
  ```
  (No code mount. The code comes from the image.)
- Updates: build a new image tag → recreate each container from it → run
  `upgrade.php` + `purge_caches.php`. `moodledata` + DB persist across recreate.
  **No git, no per-client pull.** Rollback = recreate from the previous tag.

**Why config.php stays a mounted file (not env-generated):** it's the lowest-risk
change — `create.sh` keeps generating the exact same `config.php` it does today,
we just write it to `clients/<slug>/config.php` instead of into the code dir and
mount it. (Env-driven config via an entrypoint is a nice later refinement, not
required for the size win.)

**Why writing into the code tree still works when needed:** with a baked image the
container has its own writable overlay layer over the image, so one-off writes
(branding manifest, mlang helper) still work — they just go to the container's
layer, not a shared host copy. We'll hand those inputs in with `docker cp`.

---

## 3. The "some academies need custom code" case

Keep it **opt-in per client** via a `CUSTOM_CODE` flag in `create.sh`:

- **Normal client (99%)** → runs the shared baked image. Zero extra disk.
- **Custom client (rare)** → two options, documented, pick per case:
  1. **Variant image** (preferred): build `saas-moodle-<slug>:<version>` `FROM`
     the base image with that client's changes layered on. Only the *diff* costs
     disk, not a whole copy.
  2. **Bind-mount fallback**: for that one client, keep the old behaviour — clone
     its `client/<slug>` branch and bind-mount it (exactly today's flow). Simple,
     isolated, and only that client pays the 700 MB.

Either way we never lose the ability to customize; we just stop paying for it on
every client that doesn't need it.

---

## 4. Image build & distribution

Two stages:

- **Bootstrap (fastest):** build the image **on server B** from a single checkout
  of `saas-demo` `main`. No registry needed to start. Tag e.g. `saas-moodle:2026.08`.
- **Target (proper):** GitHub Actions builds + pushes to **GHCR** on every
  `saas-demo` release, tagged by version. Server B `docker pull`s the pinned tag.
  Gives immutable, versioned, rollback-able releases and no build load on B.

Pin tags (`saas-moodle:2026.08`), **not** `:latest`, so updates are deliberate and
rollback is `recreate from previous tag`. Prune old tags periodically
(`docker image prune`).

> **Step 0 — verify what `moodle-new:latest` already contains.** It may already
> bake the EAAC code (it's "the existing EAAC image"), with the bind-mount just
> overriding it. Check: `docker run --rm moodle-new:latest ls /var/www/html`.
> - If it's **empty / PHP-only** → we build a new image that COPYs the code in.
> - If it **already has code** → migration is even simpler: rebuild that image
>   from `saas-demo` on each release and stop mounting code. Confirm the baked
>   version matches `saas-demo main` before trusting it.

---

## 5. Per-file changes

| File | Change |
|------|--------|
| **Dockerfile** *(moodle repo — currently git-ignored, lives on the build host)* | Add `COPY . /var/www/html` to bake the code. Keep PHP/Apache/extensions as-is. Optionally add an entrypoint that generates `config.php` from env (later refinement). **This is the crux of the migration.** |
| **create.sh** | Drop the `git clone`. Write `config.php` to `clients/<slug>/config.php`. `docker run` the pinned image with `-v config.php:…:ro` + `-v moodledata:…` (no code mount). Branding: write `brand.json`+logos to a host temp dir, `docker cp` into the container, run `apply_brand.php`. mlang: `docker cp` the helper (or bake it into the image) and run once. Add the `CUSTOM_CODE` branch (§3). |
| **update-site.sh** | Replace `git pull` with: (optionally `docker pull <tag>`) → `docker rm -f` + `docker run` the new tag with the same env/volumes → `upgrade.php` → `purge_caches.php`. |
| **destroy.sh** | Essentially unchanged — it already `rm -rf`s `clients/<slug>` (now just config + data) and drops the DB. |
| **apply-license.sh / apply-settings.sh / apply-suspend.sh** | **Unchanged** — they `docker exec … cfg.php`, which still works (code is in the image). |
| **provision-server.py** | Minor: thread an `IMAGE_TAG` through so the control plane can pin which image a client runs (optional). |
| **CI (new)** | GitHub Action on `saas-demo`: build + push `ghcr.io/NITGg/saas-moodle:<version>`. |

---

## 6. Migrating the existing ~12 clients

Per client, one-time, no data loss (DB + moodledata untouched):

```
1. Build/pull the baked image on server B.
2. Generate clients/<slug>/config.php (already have it inside code/config.php — move it out).
3. docker rm -f saas_moodle_<slug>
4. docker run … <image> with -v config.php + -v moodledata (no code mount)
5. docker exec … upgrade.php --non-interactive && purge_caches.php
6. Verify the site loads (HTTPS, login, a course).
7. rm -rf clients/<slug>/code      ← reclaims ~700 MB
```

Do it **one test client first** (e.g. `ziad-test`), confirm fully, then batch the rest.
Reclaims most of the ~8 GB.

---

## 7. Rollout order (safe, incremental)

1. **Step 0** — inspect `moodle-new:latest` (§4). Decide build-fresh vs reuse.
2. **Build the baked image** on server B; smoke-test it locally by running a
   throwaway container against a scratch DB.
3. **New `create.sh`** — provision a brand-new **test** academy end-to-end with it
   (branding, tier, settings, SSL). Confirm parity with a current client.
4. **New `update-site.sh`** — test an update cycle on that test academy.
5. **Migrate one existing client** (§6), verify, then the rest.
6. **CI + GHCR** — move image builds off server B once the flow is proven.
7. Delete leftover `code/` dirs + drop per-client `.git` habit entirely.

---

## 8. Risks & things to verify

- **Moodle writing into `dirroot`?** Default `localcache`/sessions/cache live in
  `moodledata`, not the code tree, so recreate is safe. Verify no plugin writes to
  `/var/www/html` at runtime (would be lost on recreate). Low risk, worth a check.
- **`apply_brand.php` — where do logos land?** Must be DB / `moodledata` (not the
  code dir) for the read-only-code model to hold. **Verify** in
  `public/theme/nit/cli/apply_brand.php` before finalising create.sh.
- **config.php mount** — a single-file bind mount over a baked path works, but the
  host file must exist before `docker run`. create.sh already writes it first.
- **Image version vs DB schema** — each update runs `upgrade.php`, so pinning a new
  image tag + upgrade keeps schema in sync. Rollback to an older tag with a
  *newer* DB schema is only safe if there were no destructive migrations — note
  which releases are one-way.
- **`template.sql` / `moodledata-base`** — unchanged; still seed per client.

---

## 9. Open questions (need answers before writing the scripts)

1. **Does `moodle-new:latest` already contain the Moodle code, or is it PHP-only?**
   (Decides build-fresh vs reuse — §4 Step 0.)
2. **Where does `apply_brand.php` store logos** — DB/moodledata, or the code dir?
   *Partial answer:* the `nit_core` branding **resolver reads from config**, and
   Moodle's theme logo settings store the file in `moodledata`/the files table —
   both point to "not the code dir" (good for read-only code). But `apply_brand.php`
   itself lives in the **saas-demo** repo, not here — confirm there before shipping.
3. **Registry now or later?** Start local-build on server B, or set up GHCR + CI first?
4. **config via mounted file (low risk) or env-generated entrypoint (cleaner)?**
   Recommend: mounted file now, entrypoint later.
5. **Custom-code clients** — go with variant images, or the bind-mount fallback?
