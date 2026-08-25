<?php
// ============================================================================
//  apply_google_login.php — enable "Sign in with Google" on the login page.
//  Run inside an academy container by create.sh when BOTH a Google OAuth
//  client id and secret are provided in the nit2 platform settings:
//     GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… php <dataroot>/apply_google_login.php
//
//  It (idempotently) creates the standard Google OAuth2 issuer, stores the
//  client id/secret, shows it on the login page, and enables the oauth2 auth
//  plugin. Re-running just updates the credentials on the existing issuer.
//
//  NOTE (ops): Google requires each academy's redirect URI to be registered in
//  the Google Cloud OAuth client, i.e.
//     https://<academy-domain>/admin/oauth2callback.php
//  Wildcard redirect URIs are not supported by Google, so add each academy's
//  callback URL to the OAuth client's "Authorized redirect URIs" list.
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');

global $DB, $CFG, $USER;

// Run as the site admin: \core\oauth2\api enforces the moodle/site:config
// capability, but a CLI script has no logged-in user, so the check fails with
// "you do not currently have permissions to do that (Change site configuration)".
// get_admin() is in $CFG->siteadmins, so is_siteadmin() / require_capability pass.
$USER = get_admin();

$clientid = trim((string) getenv('GOOGLE_CLIENT_ID'));
$secret   = trim((string) getenv('GOOGLE_CLIENT_SECRET'));
// The platform's google_client_id may hold a COMMA-SEPARATED list (mobile app
// binds several platform client ids). The web OAuth2 issuer needs a single WEB
// client id — use the first entry (the web client id must be listed first, and
// its "Authorized redirect URI" must include this academy's oauth2callback.php).
if (strpos($clientid, ',') !== false) {
    $clientid = trim(explode(',', $clientid)[0]);
}
if ($clientid === '' || $secret === '') {
    fwrite(STDERR, "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not both set — skipping\n");
    exit(0);
}

require_once($CFG->libdir . '/authlib.php');

// ── 1. Find or create the Google issuer ─────────────────────────────────────
$issuer = null;
foreach (\core\oauth2\api::get_all_issuers() as $iss) {
    // Match the standard Google issuer by its service type or name.
    if (strcasecmp($iss->get('name'), 'Google') === 0
        || strpos((string) $iss->get('baseurl'), 'accounts.google.com') !== false) {
        $issuer = $iss;
        break;
    }
}
if ($issuer === null) {
    // Creates the issuer AND its standard endpoints + user-field mappings.
    $issuer = \core\oauth2\api::create_standard_issuer('google');
}

// ── 2. Store credentials + show on the login page ───────────────────────────
$issuer->set('clientid', $clientid);
$issuer->set('clientsecret', $secret);
// `showonloginpage`: older Moodle uses a boolean (1 = show); newer uses an enum
// where issuer::EVERYWHERE also shows on the login page. Prefer the constant when
// it exists, else fall back to 1 — both render the button on the login page.
$showvalue = defined('\core\oauth2\issuer::EVERYWHERE')
    ? constant('\core\oauth2\issuer::EVERYWHERE')
    : 1;
$issuer->set('showonloginpage', $showvalue);
$issuer->set('enabled', 1);
$issuer->update();

// ── 3. Enable the oauth2 auth plugin ────────────────────────────────────────
$enabled = false;
if (method_exists('\core\plugininfo\auth', 'enable_plugin')) {
    try {
        \core\plugininfo\auth::enable_plugin('oauth2', 1);
        $enabled = true;
    } catch (\Throwable $e) {
        // Fall back to the manual auth-list edit below.
    }
}
if (!$enabled) {
    $auths = array_filter(explode(',', (string) get_config('core', 'auth')));
    if (!in_array('oauth2', $auths, true)) {
        $auths[] = 'oauth2';
        set_config('auth', implode(',', $auths));
    }
}

purge_all_caches();
echo "Google login enabled (issuer #{$issuer->get('id')})\n";
