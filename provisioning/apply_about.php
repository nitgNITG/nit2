<?php
// ============================================================================
//  apply_about.php — set the front-page ABOUT section's photo to the client's
//  uploaded image (embedded as a data-URI background). Run by create.sh:
//     ABOUT_IMAGE=/path/in/container php <dataroot>/apply_about.php
//  Targets the data-nit-about-image box inside the data-nit-section="about" block.
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
global $DB;

$path = getenv('ABOUT_IMAGE') ?: '';
if ($path === '' || !is_file($path)) { fwrite(STDERR, "ABOUT_IMAGE not found\n"); exit(0); }
$raw = file_get_contents($path);
if ($raw === false || $raw === '') { fwrite(STDERR, "about image unreadable\n"); exit(1); }
$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
$mime = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
         'webp' => 'image/webp', 'gif' => 'image/gif', 'svg' => 'image/svg+xml'][$ext] ?? 'image/jpeg';
$bg = "url('data:{$mime};base64," . base64_encode($raw) . "') center/cover no-repeat";

foreach ($DB->get_records('block_instances', ['blockname' => 'nit_section', 'pagetypepattern' => 'site-index']) as $bi) {
    $cfg = $bi->configdata ? unserialize(base64_decode($bi->configdata)) : null;
    if (!is_object($cfg)) { continue; }
    $html = $cfg->htmltext ?? '';
    if (strpos((string) $html, 'data-nit-section="about"') === false) { continue; }

    // Swap the about-image box's background + clear its placeholder text.
    $new = preg_replace_callback(
        '/(<div\b[^>]*data-nit-about-image[^>]*style=")([^"]*)("[^>]*>)(.*?)(<\/div>)/s',
        function ($m) use ($bg) {
            $style = rtrim($m[2], '; ') . '; background:' . $bg . ';';
            return $m[1] . $style . $m[3] . $m[5]; // drop the inner placeholder text
        },
        $html, 1, $count
    );
    if ($count > 0) {
        $cfg->htmltext = $new;
        $bi->configdata = base64_encode(serialize($cfg));
        $bi->timemodified = time();
        $DB->update_record('block_instances', $bi);
        purge_all_caches();
        echo "about image applied (" . strlen($raw) . " bytes)\n";
    } else {
        fwrite(STDERR, "about-image box not found in the block\n");
    }
    exit(0);
}
fwrite(STDERR, "about block not found on site-index\n");
