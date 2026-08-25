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

// Real brand marks. Moodle's HTML filter strips inline <svg>/<path>, so we can't
// embed SVG tags in the block. Instead each glyph is drawn as a data-URI SVG used
// as a background-image on a <span> — the exact mechanism the hero/about images
// use, which is known to survive the filter. The brand colour is baked into the
// SVG paint at provision time (@C@ sentinel → the icon colour).
$svgbody = [
    'phone'     => "<path fill='@C@' d='M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.2 1l-2.2 2.2z'/>",
    'whatsapp'  => "<path fill='@C@' d='M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.8c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3.2-.5 0-.1 0-.3-.1-.4L9 8.4c-.2-.4-.3-.4-.5-.4h-.4c-.2 0-.4.1-.6.3-.7.7-.9 1.6-.6 2.6.4 1.4 1.3 2.6 2.5 3.5 1.5 1.1 2.8 1.5 4.2 1.3.7-.1 1.4-.6 1.6-1.2.1-.3.1-.6.1-.7l-.4-.5z'/>",
    'facebook'  => "<path fill='@C@' d='M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5H17V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V10H8v3h2.6v8h2.9z'/>",
    'instagram' => "<rect x='3' y='3' width='18' height='18' rx='5' fill='none' stroke='@C@' stroke-width='2'/><circle cx='12' cy='12' r='4' fill='none' stroke='@C@' stroke-width='2'/><circle cx='17.2' cy='6.8' r='1.3' fill='@C@'/>",
    'youtube'   => "<path fill='@C@' d='M23 7.5a3 3 0 0 0-2.1-2.1C19 5 12 5 12 5s-7 0-8.9.4A3 3 0 0 0 1 7.5 31 31 0 0 0 .6 12 31 31 0 0 0 1 16.5a3 3 0 0 0 2.1 2.1C5 19 12 19 12 19s7 0 8.9-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23.4 12 31 31 0 0 0 23 7.5zM9.8 15.3V8.7l5.7 3.3z'/>",
    'tiktok'    => "<path fill='@C@' d='M16.5 3c.3 2.1 1.5 3.4 3.5 3.5v2.4c-1.2.1-2.3-.3-3.5-1v5.9c0 3.6-2.9 6.3-6.4 5.4-3.9-.9-4.9-5.8-1.8-8.2.9-.7 2-1 3.2-.9v2.6c-.5-.1-1-.1-1.5.1-1.3.5-1.6 2.2-.6 3.1 1 .9 2.9.5 3-1.2V3h2.6z'/>",
    'website'   => "<circle cx='12' cy='12' r='9' fill='none' stroke='@C@' stroke-width='2'/><path fill='none' stroke='@C@' stroke-width='2' d='M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18'/>",
];

// Icon colour = the brand primary (passed from create.sh); fall back to a
// sensible teal if unset. Must be a #rrggbb hex.
$iconcolor = trim((string) getenv('ICON_COLOR'));
if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $iconcolor)) { $iconcolor = '#1e7d67'; }

// Wrap a glyph body in a full SVG (colour baked in) as a BASE64 data URI.
// base64 (unlike url-encoding) can't contain ':' '(' ')' '-' etc., so Moodle's
// emoticon filter can't match a smiley inside the encoded path and inject an
// <img> that would split the style attribute (which broke the phone/whatsapp
// icons). Same encoding apply_hero.php uses.
$bguri = function (string $body) use ($iconcolor): string {
    $svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" . str_replace('@C@', $iconcolor, $body) . "</svg>";
    return 'data:image/svg+xml;base64,' . base64_encode($svg);
};

$social = [
    'facebook'  => ['url' => trim((string) getenv('SOCIAL_FACEBOOK')),  'body' => $svgbody['facebook']],
    'instagram' => ['url' => trim((string) getenv('SOCIAL_INSTAGRAM')), 'body' => $svgbody['instagram']],
    'youtube'   => ['url' => trim((string) getenv('SOCIAL_YOUTUBE')),   'body' => $svgbody['youtube']],
    'tiktok'    => ['url' => trim((string) getenv('SOCIAL_TIKTOK')),    'body' => $svgbody['tiktok']],
    'website'   => ['url' => trim((string) getenv('SOCIAL_WEBSITE')),   'body' => $svgbody['website']],
];

$e = fn($s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$telDigits = preg_replace('/[^0-9+]/', '', $phone);
$waDigits  = preg_replace('/[^0-9]/', '', $wa);
// A round icon button; social/website open in a new tab. The glyph is a data-URI
// SVG background on a <span> — no <svg> tag, so it survives the HTML filter.
$icon = function (string $href, string $body, bool $blank) use ($e, $bguri): string {
    $t = $blank ? ' target="_blank" rel="noopener"' : '';
    $uri = $e($bguri($body));
    $glyph = "width:22px; height:22px; display:block; background: url('$uri') center/contain no-repeat;";
    return '<a href="' . $e($href) . '"' . $t . ' style="width:48px; height:48px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; background: color-mix(in srgb, var(--nit-brand-primary) 12%, transparent); border:1px solid color-mix(in srgb, var(--nit-brand-primary) 30%, transparent); text-decoration:none;">'
        . '<span aria-hidden="true" style="' . $glyph . '"></span></a>';
};

$buttons = '';
if ($phone !== '')   { $buttons .= $icon('tel:' . $telDigits, $svgbody['phone'], false); }
if ($waDigits !== '') { $buttons .= $icon('https://wa.me/' . $waDigits, $svgbody['whatsapp'], true); }
foreach ($social as $s) {
    if ($s['url'] !== '') { $buttons .= $icon($s['url'], $s['body'], true); }
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
