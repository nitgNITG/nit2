# ============================================================================
#  Baked SaaS Moodle image — the Moodle code layered on top of the proven base.
#
#  Base  = moodle-new:latest  (php:8.3-apache + Moodle PHP extensions +
#          php-moodle.ini + 000-default.conf with DocumentRoot -> public).
#          This base is UNCHANGED — it already runs every academy today.
#  This  = adds the saas-demo code into /var/www/html so NO per-client bind
#          mount is needed. The code then lives ONCE in Docker's layer store
#          and is shared copy-on-write by every container.
#
#  Build context MUST be a CLEAN checkout of saas-demo (see build-image.sh).
#  .dockerignore keeps junk + secrets (config.php, moodledata, *.sql, .git) out.
#
#  config.php is intentionally NOT baked — create.sh generates a per-client one
#  and mounts it at /var/www/html/config.php:ro at run time.
# ============================================================================
ARG BASE_IMAGE=moodle-new:latest
FROM ${BASE_IMAGE}

# Bake the code in. Apache serves as www-data (uid 33), so own the tree to it.
COPY --chown=33:33 . /var/www/html

WORKDIR /var/www/html
