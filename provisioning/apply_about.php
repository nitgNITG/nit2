<?php
// ============================================================================
//  apply_about.php — fill the front-page ABOUT section: bullet points (chips)
//  and the instructor/academy photo. Run by create.sh:
//     ABOUT_BULLETS="point 1|||point 2|||..." ABOUT_IMAGE=/path php <dataroot>/apply_about.php
//  Rebuilds the data-nit-section="about" block (keeps the site name heading).
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
global $DB;

$bulletsRaw = (string) getenv('ABOUT_BULLETS');
$bullets = array_values(array_filter(array_map('trim', explode('|||', $bulletsRaw)), fn($b) => $b !== ''));
$imgPath = getenv('ABOUT_IMAGE') ?: '';

if (!$bullets && ($imgPath === '' || !is_file($imgPath))) { fwrite(STDERR, "nothing to apply for about\n"); exit(0); }

// Image box — fixed 4:3 aspect (consistent dimensions). Data-URI so no file serving.
$imgStyle = 'background: var(--nit-brand-surface);';
if ($imgPath !== '' && is_file($imgPath)) {
    $raw = file_get_contents($imgPath);
    if ($raw !== false && $raw !== '') {
        $ext = strtolower(pathinfo($imgPath, PATHINFO_EXTENSION));
        $mime = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'gif' => 'image/gif', 'svg' => 'image/svg+xml'][$ext] ?? 'image/jpeg';
        $imgStyle = "background:#000 url('data:{$mime};base64," . base64_encode($raw) . "') center/cover no-repeat;";
    }
}

$e = fn($s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$name = (string) $DB->get_field('course', 'fullname', ['id' => SITEID]); // {mlang}-tagged; filter renders it
$items = '';
foreach ($bullets as $b) {
    $items .= '<li style="display:flex; gap:10px; font-size:15px; color: var(--nit-brand-textsecondary); line-height:1.7;"><span style="color: var(--nit-brand-accent);">◆</span> ' . $e($b) . '</li>';
}
if ($items === '') {
    $items = '<li style="display:flex; gap:10px; font-size:15px; color: var(--nit-brand-textsecondary); line-height:1.7;"><span style="color: var(--nit-brand-accent);">◆</span> {mlang ar}اكتب نبذة عن الأكاديمية.{mlang}{mlang en}Write about the academy.{mlang}</li>';
}

$html =
    '<div dir="auto" data-nit-section="about" style="background: var(--nit-brand-background); color: var(--nit-brand-textprimary); padding: 64px 20px;">' .
      '<div style="max-width: 1140px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit,minmax(300px,1fr)); gap: 40px; align-items: center;">' .
        '<div>' .
          '<h2 style="font-size: clamp(24px,4vw,34px); font-weight: 800; margin: 0 0 6px; color: var(--nit-brand-accenttext);">{mlang ar}نبذة عن{mlang}{mlang en}About{mlang}</h2>' .
          '<h3 style="font-size: 20px; font-weight: 700; margin: 0 0 18px;">' . $name . '</h3>' .
          '<ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;">' . $items . '</ul>' .
        '</div>' .
        '<div data-nit-about-image style="aspect-ratio:4/3; width:100%; border-radius: 20px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--nit-brand-textprimary) 10%, transparent); ' . $imgStyle . '"></div>' .
      '</div>' .
    '</div>';

foreach ($DB->get_records('block_instances', ['blockname' => 'nit_section', 'pagetypepattern' => 'site-index']) as $bi) {
    $cfg = $bi->configdata ? unserialize(base64_decode($bi->configdata)) : null;
    if (!is_object($cfg)) { continue; }
    if (strpos((string) ($cfg->htmltext ?? ''), 'data-nit-section="about"') === false) { continue; }
    $cfg->mode = 'html';
    $cfg->htmltext = $html;
    $bi->configdata = base64_encode(serialize($cfg));
    $bi->timemodified = time();
    $DB->update_record('block_instances', $bi);
    purge_all_caches();
    echo "about applied (" . count($bullets) . " bullet(s))\n";
    exit(0);
}
fwrite(STDERR, "about block not found on site-index\n");
