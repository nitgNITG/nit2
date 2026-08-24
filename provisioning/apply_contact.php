<?php
// ============================================================================
//  apply_contact.php — fill the front-page CONTACT section with the client's
//  phone / WhatsApp. Run by create.sh:
//     CONTACT_PHONE="+20100..." [CONTACT_WHATSAPP="+20100..."] php <dataroot>/apply_contact.php
//  Rebuilds the data-nit-section="contact" block with the call + WhatsApp buttons.
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
global $DB;

$phone = trim((string) getenv('CONTACT_PHONE'));
$wa    = trim((string) getenv('CONTACT_WHATSAPP'));
if ($wa === '') { $wa = $phone; }
if ($phone === '' && $wa === '') { fwrite(STDERR, "no contact phone\n"); exit(0); }

$e = fn($s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$telDigits = preg_replace('/[^0-9+]/', '', $phone);
$waDigits  = preg_replace('/[^0-9]/', '', $wa);

$buttons = '';
if ($phone !== '') {
    $buttons .= '<a href="tel:' . $e($telDigits) . '" style="background: var(--nit-brand-primary); color: var(--nit-brand-textprimary); padding: 13px 30px; border-radius: 8px; font-weight: bold; text-decoration: none;">📞 ' . $e($phone) . '</a>';
}
if ($waDigits !== '') {
    $buttons .= '<a href="https://wa.me/' . $e($waDigits) . '" style="border: 1px solid var(--nit-brand-bordersecondary); color: var(--nit-brand-textprimary); padding: 13px 30px; border-radius: 8px; font-weight: bold; text-decoration: none;">{mlang ar}واتساب{mlang}{mlang en}WhatsApp{mlang}</a>';
}

$html =
    '<div dir="auto" data-nit-section="contact" style="background: color-mix(in srgb, var(--nit-brand-surface) 70%, var(--nit-brand-background)); color: var(--nit-brand-textprimary); padding: 72px 20px; text-align: center;">' .
      '<div style="max-width: 820px; margin: 0 auto;">' .
        '<h2 style="font-size: clamp(24px,4vw,36px); font-weight: 800; margin: 0 0 12px;">{mlang ar}انضم إلينا اليوم{mlang}{mlang en}Join us today{mlang}</h2>' .
        '<p style="font-size: 15px; color: var(--nit-brand-textsecondary); line-height: 1.8; margin: 0 0 24px;">{mlang ar}تواصل معنا للاستفسار أو التسجيل.{mlang}{mlang en}Contact us to enquire or enrol.{mlang}</p>' .
        '<div style="display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; align-items: center;">' . $buttons . '</div>' .
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
    echo "contact filled (phone={$phone})\n";
    exit(0);
}
fwrite(STDERR, "contact block not found on site-index\n");
