<?php
// ============================================================================
//  apply_contact.php — fill the front-page CONTACT section with the client's
//  phone / WhatsApp and social links. Only the ones provided are shown, each as
//  an icon that opens in a new tab. Run by create.sh:
//     CONTACT_PHONE=... CONTACT_WHATSAPP=... SOCIAL_FACEBOOK=... SOCIAL_INSTAGRAM=...
//     SOCIAL_YOUTUBE=... SOCIAL_TIKTOK=... SOCIAL_WEBSITE=... php <dataroot>/apply_contact.php
//  Rebuilds the data-nit-section="contact" block.
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
global $DB;

$phone = trim((string) getenv('CONTACT_PHONE'));
$wa    = trim((string) getenv('CONTACT_WHATSAPP'));
if ($wa === '') { $wa = $phone; }
$social = [
    'facebook'  => ['url' => trim((string) getenv('SOCIAL_FACEBOOK')),  'label' => 'f'],
    'instagram' => ['url' => trim((string) getenv('SOCIAL_INSTAGRAM')), 'label' => '◉'],
    'youtube'   => ['url' => trim((string) getenv('SOCIAL_YOUTUBE')),   'label' => '▶'],
    'tiktok'    => ['url' => trim((string) getenv('SOCIAL_TIKTOK')),    'label' => '♪'],
    'website'   => ['url' => trim((string) getenv('SOCIAL_WEBSITE')),   'label' => '🌐'],
];

$e = fn($s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$telDigits = preg_replace('/[^0-9+]/', '', $phone);
$waDigits  = preg_replace('/[^0-9]/', '', $wa);
// A round icon button; social/website open in a new tab.
$icon = function (string $href, string $label, bool $blank) use ($e): string {
    $t = $blank ? ' target="_blank" rel="noopener"' : '';
    return '<a href="' . $e($href) . '"' . $t . ' style="width:48px; height:48px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; background: color-mix(in srgb, var(--nit-brand-primary) 15%, transparent); border:1px solid color-mix(in srgb, var(--nit-brand-primary) 35%, transparent); color: var(--nit-brand-accenttext); font-size:20px; font-weight:bold; text-decoration:none;">' . $label . '</a>';
};

$buttons = '';
if ($phone !== '')   { $buttons .= $icon('tel:' . $telDigits, '📞', false); }
if ($waDigits !== '') { $buttons .= $icon('https://wa.me/' . $waDigits, '✆', true); }
foreach ($social as $s) {
    if ($s['url'] !== '') { $buttons .= $icon($s['url'], $s['label'], true); }
}
if ($buttons === '') { fwrite(STDERR, "no contact/social provided — leaving placeholder\n"); exit(0); }

$html =
    '<div dir="auto" data-nit-section="contact" style="background: color-mix(in srgb, var(--nit-brand-surface) 70%, var(--nit-brand-background)); color: var(--nit-brand-textprimary); padding: 72px 20px; text-align: center;">' .
      '<div style="max-width: 820px; margin: 0 auto;">' .
        '<h2 style="font-size: clamp(24px,4vw,36px); font-weight: 800; margin: 0 0 12px;">{mlang ar}انضم إلينا اليوم{mlang}{mlang en}Join us today{mlang}</h2>' .
        '<p style="font-size: 15px; color: var(--nit-brand-textsecondary); line-height: 1.8; margin: 0 0 24px;">{mlang ar}تواصل معنا للاستفسار أو التسجيل.{mlang}{mlang en}Contact us to enquire or enrol.{mlang}</p>' .
        '<div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; align-items: center;">' . $buttons . '</div>' .
      '</div>' .
    '</div>';

foreach ($DB->get_records('block_instances', ['blockname' => 'nit_section', 'pagetypepattern' => 'site-index']) as $bi) {
    $cfg = $bi->configdata ? unserialize(base64_decode($bi->configdata)) : null;
    if (!is_object($cfg)) { continue; }
    if (strpos((string) ($cfg->htmltext ?? ''), 'data-nit-section="contact"') === false) { continue; }
    $cfg->mode = 'html';
    $cfg->htmltext = $html;
    $bi->configdata = base64_encode(serialize($cfg));
    $bi->timemodified = time();
    $DB->update_record('block_instances', $bi);
    purge_all_caches();
    echo "contact + social applied\n";
    exit(0);
}
fwrite(STDERR, "contact block not found on site-index\n");
