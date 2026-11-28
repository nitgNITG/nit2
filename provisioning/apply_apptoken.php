<?php
// ============================================================================
//  apply_apptoken.php — ensure the academy has a Moodle Mobile web-service token
//  and publish it as local_multitopics/admin_token, which getsettings.php serves
//  to the app. Without it getsettings returns an empty admin_token and the app
//  falls back to the compiled-in EAAC token (elevated calls then hit the wrong
//  site / a rotated token). Run inside an academy container:
//     php <dataroot>/apply_apptoken.php
//
//  Idempotent: enables web services + REST + the mobile service, then publishes
//  the read-only guest-browsing token built by the image's
//  local/multitopics/cli/app_guest_token.php.
//
//  SECURITY NOTE: getsettings.php returns admin_token to ANYONE, so it must never
//  be an admin's (or any real member's) token. It used to be the site admin's
//  mobile token; this script now revokes that token if it is still published and
//  publishes the least-privilege guest token instead.
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

// 2b. Expose the functions the app needs BEFORE login on this service.
// The stock mobile service does NOT include core_user_create_users, so an app
// signup fails with `webservice_access_exception` (accessexception) until it is
// added. Manual additions to the mobile service persist across upgrades — Moodle
// only auto-manages the functions plugins declare for mobile in db/services.php,
// it does not strip extras. The token's user is the site admin, so it already
// has moodle/user:create + webservice/rest:use.
$required = [
    'core_user_create_users',      // registration
    // Manual enrol/unenrol: the app enrols a user into a course with the admin
    // token (e.g. grant access after purchase / free-course join). The stock
    // mobile service ships enrol_self_* + enrol_guest_* but NOT manual enrol, so
    // the admin-token call fails with accessexception until it is added here.
    'enrol_manual_enrol_users',
    'enrol_manual_unenrol_users',  // revoke access (symmetric)
];
foreach ($required as $fname) {
    // Only add functions that actually exist on this core.
    if (!$DB->record_exists('external_functions', ['name' => $fname])) {
        fwrite(STDERR, "function {$fname} not installed on this core — skipping\n");
        continue;
    }
    $inservice = $DB->record_exists('external_services_functions', [
        'externalserviceid' => $service->id,
        'functionname'      => $fname,
    ]);
    if (!$inservice) {
        $DB->insert_record('external_services_functions', (object) [
            'externalserviceid' => $service->id,
            'functionname'      => $fname,
        ]);
        echo "added function {$fname} to service #{$service->id}\n";
    }
}

// 2c. Let NORMAL logged-in users call the web service. webservice/rest:use ships
// with EMPTY archetypes (Moodle grants it to NO role by default), so a freshly
// registered student gets webservice_access_exception on EVERY function while
// the admin token still works (admin bypasses capability checks via
// is_siteadmin). Grant it to the authenticated-user role at system context so
// every logged-in user (students, teachers) can use the app.
require_once($CFG->libdir . '/accesslib.php');
$syscontext = context_system::instance();
$roleids = [];
if (!empty($CFG->defaultuserroleid)) {
    $roleids[] = (int) $CFG->defaultuserroleid;
}
if ($r = $DB->get_record('role', ['shortname' => 'user'], 'id')) {
    $roleids[] = (int) $r->id;
}
$roleids = array_values(array_unique(array_filter($roleids)));
foreach ($roleids as $rid) {
    assign_capability('webservice/rest:use', CAP_ALLOW, $rid, $syscontext->id, true);
}
if ($roleids) {
    $syscontext->mark_dirty();
    echo "granted webservice/rest:use to role(s): " . implode(',', $roleids) . "\n";
}
// Keep the mobile service open to any authorised user (never an allow-list).
if (!empty($service->restrictedusers)) {
    $service->restrictedusers = 0;
    $DB->update_record('external_services', $service);
    echo "cleared restrictedusers on service #{$service->id}\n";
}

// 3. Retire the old published token.
// The published token used to be the SITE ADMIN's mobile token, which
// getsettings.php hands to anyone. If that is still what admin_token holds,
// delete that token row: it has been public, so it must not keep working.
$published = trim((string) get_config('local_multitopics', 'admin_token'));
if ($published !== '') {
    $old = $DB->get_record('external_tokens', ['token' => $published]);
    if ($old && is_siteadmin($old->userid)) {
        $DB->delete_records('external_tokens', ['id' => $old->id]);
        echo "revoked the previously published site-admin token (" . substr($published, 0, 6) . "…)\n";
    }
}
set_config('admin_token', '', 'local_multitopics');

// 4. Build the read-only guest-browsing token (dedicated `appguest` account on
// the restricted `nit_app_guest` service) and publish THAT instead. The builder
// ships in the academy image; an image older than it publishes nothing, which
// is safe (the app then uses its compiled-in fallback).
$builder = $CFG->dirroot . '/local/multitopics/cli/app_guest_token.php';
if (!is_readable($builder)) {
    fwrite(STDERR, "guest-token builder missing from this image ({$builder}) - admin_token left empty\n");
    purge_all_caches();
    exit(0);
}
passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($builder) . ' --create --save', $rc);
purge_all_caches();
if ($rc !== 0) {
    fwrite(STDERR, "guest-token builder failed (exit {$rc}) - admin_token left empty\n");
    exit(1);
}
echo "admin_token set to the guest-browsing token\n";
