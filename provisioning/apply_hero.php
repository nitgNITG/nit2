<?php
// ============================================================================
//  apply_hero.php — set the front-page HERO section's cover image to the
//  client's uploaded image. Run inside an academy container by create.sh:
//     HERO_IMAGE=/path/in/container php <dataroot>/apply_hero.php
//
//  The image is embedded as a data-URI background in the hero nit_section block
//  (found by its data-nit-section="hero" marker), so it renders with no file-
//  serving/theme changes. One cover image per academy — keep it reasonably small.
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/blocklib.php');

global $DB;

$path = getenv('HERO_IMAGE') ?: '';
if ($path === '' || !is_file($path)) { fwrite(STDERR, "HERO_IMAGE not found\n"); exit(0); }

$raw = file_get_contents($path);
if ($raw === false || $raw === '') { fwrite(STDERR, "hero image unreadable\n"); exit(1); }

$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
$mime = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
         'webp' => 'image/webp', 'gif' => 'image/gif', 'svg' => 'image/svg+xml'][$ext] ?? 'image/jpeg';
$datauri = 'data:' . $mime . ';base64,' . base64_encode($raw);

// Find the hero block on the front page by its marker.
$hero = null;
foreach ($DB->get_records('block_instances', ['blockname' => 'nit_section', 'pagetypepattern' => 'site-index']) as $bi) {
    $cfg = $bi->configdata ? unserialize(base64_decode($bi->configdata)) : null;
    $html = is_object($cfg) ? ($cfg->htmltext ?? $cfg->visualtext ?? $cfg->text ?? '') : '';
    if (strpos((string) $html, 'data-nit-section="hero"') !== false) { $hero = [$bi, $cfg]; break; }
}
if (!$hero) { fwrite(STDERR, "hero block not found on site-index\n"); exit(0); }

[$bi, $cfg] = $hero;
if (!is_object($cfg)) { $cfg = new stdClass(); }

// Full-bleed cover using the uploaded image; keeps the marker so it's re-findable.
$cfg->mode = 'html';
$cfg->htmltext =
    '<div dir="auto" data-nit-section="hero" style="width:100%; background: var(--nit-brand-surface); border-bottom:1px solid var(--nit-brand-borderprimary);">' .
      '<div style="max-width:1400px; margin:0 auto;">' .
        '<div style="width:100%; aspect-ratio:16/6; min-height:280px; background:#000 url(\'' . $datauri . '\') center/cover no-repeat;"></div>' .
      '</div>' .
    '</div>';

$bi->configdata = base64_encode(serialize($cfg));
$bi->timemodified = time();
$DB->update_record('block_instances', $bi);

purge_all_caches();
echo "hero image applied (" . strlen($raw) . " bytes, {$mime})\n";
