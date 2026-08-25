<?php
// ============================================================================
//  apply_apptoken.php — ensure the academy has a Moodle Mobile web-service token
//  and publish it as local_multitopics/admin_token, which getsettings.php serves
//  to the app. Without it getsettings returns an empty admin_token and the app
//  falls back to the compiled-in EAAC token (elevated calls then hit the wrong
//  site / a rotated token). Run inside an academy container:
//     php <dataroot>/apply_apptoken.php
//
//  Idempotent: enables web services + REST + the mobile service, then reuses the
//  admin's existing permanent mobile token or mints one.
//
//  SECURITY NOTE: this token is an ADMIN mobile token and getsettings.php returns
//  it anonymously (the app's pre-login contract). It grants mobile-WS access at
//  admin level — acceptable per the app design, but rotate/scope it if that
//  changes. A dedicated least-privilege WS user would be the harder-but-safer
//  long-term option.
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/externallib.php');
require_once($CFG->dirroot . '/webservice/lib.php');

global $DB, $CFG;

// 1. Turn on web services + the mobile service + the REST protocol.
set_config('enablewebservices', 1);
set_config('enablemobilewebservice', 1);
$protocols = array_filter(array_map('trim', explode(',', (string) get_config('core', 'webserviceprotocols'))));
if (!in_array('rest', $protocols, true)) {
    $protocols[] = 'rest';
    set_config('webserviceprotocols', implode(',', $protocols));
}

// 2. The stock Moodle Mobile service — created/enabled when the mobile WS is on.
require_once($CFG->dirroot . '/lib/moodlelib.php');
$service = $DB->get_record('external_services', ['shortname' => MOODLE_OFFICIAL_MOBILE_SERVICE]);
if (!$service) {
    // Enabling the setting normally materialises it; force it if a race left it absent.
    if (function_exists('external_update_services')) {
        // no-op safeguard; most installs already have the row.
    }
    $service = $DB->get_record('external_services', ['shortname' => MOODLE_OFFICIAL_MOBILE_SERVICE]);
}
if (!$service) {
    fwrite(STDERR, "moodle_mobile_app service missing — cannot mint token\n");
    exit(1);
}
if (empty($service->enabled)) {
    $service->enabled = 1;
    $DB->update_record('external_services', $service);
}

// 3. Reuse the admin's permanent mobile token, or mint one.
$admin = get_admin();
if (!$admin) {
    fwrite(STDERR, "no site admin found\n");
    exit(1);
}
$existing = $DB->get_records('external_tokens', [
    'userid'            => $admin->id,
    'externalserviceid' => $service->id,
    'tokentype'         => EXTERNAL_TOKEN_PERMANENT,
], 'timecreated DESC', '*', 0, 1);
$existing = $existing ? reset($existing) : null;

if ($existing) {
    $token = $existing->token;
} else {
    $ctx = context_system::instance();
    // Moodle 4.4+ moved token generation to \core_external\util::generate_token
    // (service object); older cores expose the global external_generate_token
    // (service id). Support both so this works across point releases.
    if (class_exists('\core_external\util') && method_exists('\core_external\util', 'generate_token')) {
        $token = \core_external\util::generate_token(
            EXTERNAL_TOKEN_PERMANENT, $service, $admin->id, $ctx, 0, '');
    } else {
        $token = external_generate_token(
            EXTERNAL_TOKEN_PERMANENT, $service->id, $admin->id, $ctx, 0, '');
    }
}

// 4. Publish it for the app.
set_config('admin_token', $token, 'local_multitopics');
purge_all_caches();
echo "admin_token set (" . substr($token, 0, 6) . "…, service #{$service->id})\n";
