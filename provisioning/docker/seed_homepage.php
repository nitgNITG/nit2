<?php
// ============================================================================
//  seed_homepage.php — seed the front-page (Site home) marketing sections.
//
//  Reads *.html files from  <dataroot>/home-sections/  (sorted by filename) and
//  creates one block_nit_section per file on the site-index page, region
//  fullwidth-top, weight = file order. Existing nit_section blocks on that page
//  are removed first (idempotent). Run inside an academy container:
//     php <dataroot>/seed_homepage.php
//
//  File naming: NN-name.html  (NN sets the order, e.g. 00-hero.html).
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/blocklib.php');

global $DB;

$dir = $CFG->dataroot . '/home-sections';
if (!is_dir($dir)) {
    fwrite(STDERR, "no home-sections dir at $dir\n");
    exit(1);
}
$files = glob($dir . '/*.html');
sort($files, SORT_STRING);
if (!$files) {
    fwrite(STDERR, "no *.html sections in $dir\n");
    exit(1);
}

$context = context_system::instance();

// 1. Remove any existing nit_section blocks on the front page (clean slate).
$existing = $DB->get_records('block_instances', [
    'blockname'       => 'nit_section',
    'pagetypepattern' => 'site-index',
]);
foreach ($existing as $bi) {
    blocks_delete_instance($bi);
}
echo "removed " . count($existing) . " existing section(s)\n";

// 2. Insert one nit_section block per file.
$weight = 0;
foreach ($files as $file) {
    $html = file_get_contents($file);
    if ($html === false) { continue; }

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

    $rec = new stdClass();
    $rec->blockname        = 'nit_section';
    $rec->parentcontextid  = $context->id;
    $rec->showinsubcontexts = 0;
    $rec->requiredbytheme  = 0;
    $rec->pagetypepattern  = 'site-index';
    $rec->subpagepattern   = null;
    $rec->defaultregion    = 'fullwidth-top';
    $rec->defaultweight    = $weight;
    $rec->configdata       = base64_encode(serialize($config));
    $rec->timecreated      = time();
    $rec->timemodified     = time();

    $id = $DB->insert_record('block_instances', $rec);
    context_block::instance($id); // materialise the block context
    echo "seeded " . basename($file) . " (weight $weight)\n";
    $weight++;
}

purge_all_caches();
echo "done: seeded " . count($files) . " section(s)\n";
