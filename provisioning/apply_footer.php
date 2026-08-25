<?php
// ============================================================================
//  apply_footer.php — ensure the front page has a FOOTER section.
//  Run inside an academy container by apply-branding.sh / create.sh:
//     php <dataroot>/apply_footer.php
//
//  Academies provisioned before the footer section existed have no footer block.
//  This idempotently appends one (data-nit-section="footer") as the LAST
//  full-width section on the site-index page, so existing sites gain a footer
//  without rebuilding the template. If a footer block already exists it is left
//  untouched.
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/blocklib.php');

global $DB;

// Already has a footer? Nothing to do.
$maxweight = -1;
foreach ($DB->get_records('block_instances', ['blockname' => 'nit_section', 'pagetypepattern' => 'site-index']) as $bi) {
    $cfg = $bi->configdata ? unserialize(base64_decode($bi->configdata)) : null;
    $html = is_object($cfg) ? ($cfg->htmltext ?? '') : '';
    if (strpos((string) $html, 'data-nit-section="footer"') !== false) {
        echo "footer already present — leaving as-is\n";
        exit(0);
    }
    if ((int) $bi->defaultweight > $maxweight) { $maxweight = (int) $bi->defaultweight; }
}

// The default footer (brand-aware; matches home-sections/95-footer.html).
$html = <<<'HTML'
<div dir="auto" data-nit-section="footer" style="background: var(--nit-brand-secondary); color: var(--nit-brand-textsecondary); border-top:1px solid var(--nit-brand-borderprimary);">
  <div style="max-width:1140px; margin:0 auto; padding:48px 20px 24px; display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:32px;">
    <div>
      <div style="font-size:18px; font-weight:800; color: var(--nit-brand-textprimary); margin-bottom:10px;">{mlang ar}أكاديميتك{mlang}{mlang en}Your Academy{mlang}</div>
      <p style="font-size:13px; line-height:1.8; margin:0;">{mlang ar}نبذة قصيرة عن الأكاديمية تظهر هنا. عدّلها من محرر الصفحة الرئيسية.{mlang}{mlang en}A short line about the academy. Edit it from the front-page editor.{mlang}</p>
    </div>
    <div>
      <div style="font-size:14px; font-weight:bold; color: var(--nit-brand-textprimary); margin-bottom:12px;">{mlang ar}روابط سريعة{mlang}{mlang en}Quick links{mlang}</div>
      <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
        <a href="/" style="color: var(--nit-brand-textsecondary); text-decoration:none;">{mlang ar}الرئيسية{mlang}{mlang en}Home{mlang}</a>
        <a href="/course/index.php" style="color: var(--nit-brand-textsecondary); text-decoration:none;">{mlang ar}الكورسات{mlang}{mlang en}Courses{mlang}</a>
        <a href="/login/index.php" style="color: var(--nit-brand-textsecondary); text-decoration:none;">{mlang ar}تسجيل الدخول{mlang}{mlang en}Log in{mlang}</a>
      </div>
    </div>
    <div>
      <div style="font-size:14px; font-weight:bold; color: var(--nit-brand-textprimary); margin-bottom:12px;">{mlang ar}تواصل معنا{mlang}{mlang en}Contact{mlang}</div>
      <p style="font-size:13px; line-height:1.8; margin:0;">{mlang ar}للاستفسار والتسجيل تواصل معنا عبر بيانات التواصل بالأعلى.{mlang}{mlang en}Reach us via the contact details above.{mlang}</p>
    </div>
  </div>
  <div style="border-top:1px solid var(--nit-brand-borderprimary); padding:16px 20px; text-align:center; font-size:12px;">
    &copy; <span data-nit-year>2026</span> &mdash; {mlang ar}جميع الحقوق محفوظة{mlang}{mlang en}All rights reserved{mlang}
    &nbsp;&middot;&nbsp; <a href="https://nitg-eg.com" target="_blank" rel="noopener" style="color: var(--nit-brand-accenttext); text-decoration:none;">N.I.T</a>
  </div>
</div>
HTML;

$config = (object) [
    'mode'         => 'html',
    'htmltext'     => $html,
    'showtitle'    => 0,
    'width'        => 'full',
    'align'        => 'stretch',
    'plain'        => 1,
    'spacingunit'  => 'px',
    'margintop'    => '',
    'marginbottom' => '',
];

$context = context_system::instance();
$rec = new stdClass();
$rec->blockname         = 'nit_section';
$rec->parentcontextid   = $context->id;
$rec->showinsubcontexts = 0;
$rec->requiredbytheme   = 0;
$rec->pagetypepattern   = 'site-index';
$rec->subpagepattern    = null;
$rec->defaultregion     = 'fullwidth-top';
$rec->defaultweight     = $maxweight + 1;   // last section on the page
$rec->configdata        = base64_encode(serialize($config));
$rec->timecreated       = time();
$rec->timemodified      = time();

$id = $DB->insert_record('block_instances', $rec);
context_block::instance($id);

purge_all_caches();
echo "footer section added (weight {$rec->defaultweight})\n";
