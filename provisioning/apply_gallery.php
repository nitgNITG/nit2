<?php
// ============================================================================
//  apply_gallery.php — fill the front-page GALLERY grid with the client's
//  uploaded photos (each embedded as a data-URI background). Run by create.sh:
//     GALLERY_IMAGES="/p/1.jpg,/p/2.jpg,..." php <dataroot>/apply_gallery.php
//  Rebuilds the data-nit-section="gallery" block with one tile per image.
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
global $DB;

$list = array_filter(array_map('trim', explode(',', (string) getenv('GALLERY_IMAGES'))));
if (!$list) { fwrite(STDERR, "GALLERY_IMAGES empty\n"); exit(0); }

$mimes = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
          'webp' => 'image/webp', 'gif' => 'image/gif', 'svg' => 'image/svg+xml'];
$tiles = '';
$n = 0;
foreach ($list as $path) {
    if (!is_file($path)) { continue; }
    $raw = file_get_contents($path);
    if ($raw === false || $raw === '') { continue; }
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $mime = $mimes[$ext] ?? 'image/jpeg';
    $bg = "url('data:{$mime};base64," . base64_encode($raw) . "') center/cover no-repeat";
    $tiles .= '<div style="aspect-ratio:4/3; border-radius:12px; background:' . $bg .
              '; border:1px solid var(--nit-brand-borderprimary);"></div>';
    $n++;
}
if ($n === 0) { fwrite(STDERR, "no readable gallery images\n"); exit(0); }

$html =
    '<div dir="auto" data-nit-section="gallery" style="background: var(--nit-brand-background); color: var(--nit-brand-textprimary); padding: 64px 20px;">' .
      '<div style="max-width: 1140px; margin: 0 auto;">' .
        '<div style="text-align:center; margin-bottom:36px;">' .
          '<span style="display:inline-block; background: color-mix(in srgb, var(--nit-brand-accenttext) 15%, transparent); border:1px solid color-mix(in srgb, var(--nit-brand-accenttext) 30%, transparent); border-radius:50px; padding:6px 18px; font-size:14px; color:var(--nit-brand-accenttext); font-weight:bold;">{mlang ar}ألبوم الصور{mlang}{mlang en}Gallery{mlang}</span>' .
        '</div>' .
        '<div data-nit-gallery-grid style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px;">' . $tiles . '</div>' .
      '</div>' .
    '</div>';

foreach ($DB->get_records('block_instances', ['blockname' => 'nit_section', 'pagetypepattern' => 'site-index']) as $bi) {
    $cfg = $bi->configdata ? unserialize(base64_decode($bi->configdata)) : null;
    if (!is_object($cfg)) { continue; }
    if (strpos((string) ($cfg->htmltext ?? ''), 'data-nit-section="gallery"') === false) { continue; }
    $cfg->mode = 'html';
    $cfg->htmltext = $html;
    $bi->configdata = base64_encode(serialize($cfg));
    $bi->timemodified = time();
    $DB->update_record('block_instances', $bi);
    purge_all_caches();
    echo "gallery filled with {$n} image(s)\n";
    exit(0);
}
fwrite(STDERR, "gallery block not found on site-index\n");
