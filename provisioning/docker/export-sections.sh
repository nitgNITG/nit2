#!/usr/bin/env bash
# ============================================================================
#  export-sections.sh — capture a live academy's front-page nit_section blocks
#  into home-sections/*.html, so the good data-driven ones can be reused as the
#  default template home page (curate afterwards: keep the generic blocks, drop
#  tenant-specific ones, add the placeholder hero/about/contact).
#
#     bash export-sections.sh <slug> [outdir]   (default outdir: ./home-sections)
# ============================================================================
set -euo pipefail
SLUG="${1:?usage: export-sections.sh <slug> [outdir]}"
OUT="${2:-$(dirname "$0")/home-sections}"
C="saas_moodle_${SLUG}"

docker ps --format '{{.Names}}' | grep -qx "$C" || { echo "container $C not running"; exit 1; }
mkdir -p "$OUT"

docker exec "$C" sh -c 'rm -rf /var/www/moodledata/hx && mkdir -p /var/www/moodledata/hx'
docker exec "$C" php -r '
define("CLI_SCRIPT",true); require("/var/www/html/config.php"); global $DB;
$rows = $DB->get_records("block_instances",
    ["blockname"=>"nit_section","pagetypepattern"=>"site-index"], "defaultweight ASC");
$i = 0;
foreach ($rows as $r) {
    $c = $r->configdata ? unserialize(base64_decode($r->configdata)) : new stdClass();
    $html = $c->htmltext ?? $c->visualtext ?? $c->text ?? "";
    file_put_contents(sprintf("/var/www/moodledata/hx/%02d-section.html", $i*10), $html);
    $i++;
}
echo "exported $i section(s)\n";
'
docker cp "$C":/var/www/moodledata/hx/. "$OUT"/
docker exec "$C" rm -rf /var/www/moodledata/hx
echo "==> sections written to $OUT (curate them, then build-clean-template.sh seeds them)"
ls -1 "$OUT"
