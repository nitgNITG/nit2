<?php
// ============================================================================
//  apply_login.php — set the login / signup page background image to the
//  client's uploaded image. Run inside an academy container by create.sh:
//     LOGIN_IMAGE=/path/in/container php <dataroot>/apply_login.php
//
//  Unlike the hero/about/gallery sections (data-URI backgrounds in blocks),
//  the login page is a theme layout, so the image is stored as a real theme
//  stored-file in theme_nit's `loginbackgroundimage` file area (system context,
//  itemid 0) and the filename saved to config `theme_nit/loginbackgroundimage`.
//  theme_nit_get_extra_scss()/theme_nit_pluginfile() then serve & render it.
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');

global $CFG;

$path = getenv('LOGIN_IMAGE') ?: '';
if ($path === '' || !is_file($path)) { fwrite(STDERR, "LOGIN_IMAGE not found\n"); exit(0); }

$raw = file_get_contents($path);
if ($raw === false || $raw === '') { fwrite(STDERR, "login image unreadable\n"); exit(1); }

$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
$allowed = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];
if (!in_array($ext, $allowed, true)) { $ext = 'jpg'; }
$filename = 'login.' . $ext;

$fs = get_file_storage();
$filerecord = [
    'contextid' => context_system::instance()->id,
    'component' => 'theme_nit',
    'filearea'  => 'loginbackgroundimage',
    'itemid'    => 0,
    'filepath'  => '/',
    'filename'  => $filename,
];

// Replace any existing login background first (one file per area).
$fs->delete_area_files($filerecord['contextid'], 'theme_nit', 'loginbackgroundimage', 0);
$fs->create_file_from_string($filerecord, $raw);

// The config filename is what setting_file_url() resolves against.
set_config('loginbackgroundimage', '/' . $filename, 'theme_nit');

// Bump the theme revision so the compiled SCSS (with the new url) is regenerated.
theme_reset_all_caches();
purge_all_caches();
echo "login background applied (" . strlen($raw) . " bytes, {$filename})\n";
