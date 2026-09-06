<?php
// ============================================================================
//  enable_payment_provider.php — enable/disable a local_payments provider row
//  to match the academy's licence. Run inside an academy container by
//  apply-integrations.sh:
//     PP_PROVIDER=kashier PP_ENABLED=1 php <dataroot>/enable_payment_provider.php
//
//  Why: apply-integrations.sh pushes the provider's CREDENTIALS
//  (paymentprovider_kashier/*) but the provider itself is registered DISABLED by
//  local_payments' install (local_payments_providers.enabled = 0). Checkout only
//  considers enabled providers, so a Kashier package would still fail with
//  "No enabled payment provider for country=…". This flips the enabled flag to
//  track the licence: on when the package includes Kashier, off otherwise.
//
//  Env:
//    PP_PROVIDER  provider row name (e.g. kashier)   [default: kashier]
//    PP_ENABLED   1 = enable, 0 = disable            [default: 0]
//
//  Soft by design: if local_payments isn't installed or the provider isn't
//  registered, it logs and exits 0 (never blocks provisioning).
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');

global $DB;

$name    = trim((string) getenv('PP_PROVIDER')) ?: 'kashier';
$enabled = ((int) getenv('PP_ENABLED')) ? 1 : 0;

if (!$DB->get_manager()->table_exists('local_payments_providers')) {
    fwrite(STDERR, "local_payments_providers table not present — skipping\n");
    exit(0);
}

$rec = $DB->get_record('local_payments_providers', ['name' => $name]);
if (!$rec) {
    fwrite(STDERR, "provider '{$name}' not registered in local_payments_providers — skipping\n");
    exit(0);
}

if ((int) $rec->enabled === $enabled) {
    echo "provider '{$name}' already enabled={$enabled}; nothing to do\n";
    exit(0);
}

$rec->enabled = $enabled;
if (property_exists($rec, 'timemodified')) {
    $rec->timemodified = time();
}
$DB->update_record('local_payments_providers', $rec);
echo "provider '{$name}' set enabled={$enabled}\n";
