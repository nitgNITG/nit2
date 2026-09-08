<?php
// ============================================================================
//  send_expiry_reminder.php — email the academy OWNER that their subscription is
//  about to expire (or has expired), reusing the academy's own Moodle mail (the
//  same path send_welcome.php uses on provisioning). Run inside an academy
//  container by send-expiry-reminder.sh:
//     DAYS_LEFT=7 RENEW_URL=https://…/account php <dataroot>/send_expiry_reminder.php
//
//  Why via Moodle: nit2 has no mail transport, and each academy already has an
//  SMTP relay configured for the welcome email — so the control plane just tells
//  the academy to send, instead of adding an email stack to nit2.
//
//  Env:
//    DAYS_LEFT    days until expiry; 0 or negative = already expired   [required]
//    RENEW_URL    link the owner clicks to renew (nit2 account page)   [optional]
//    OWNER_USER   owner account username to email                      [default: owner]
//
//  Emails the owner account (falls back to the admin account). Soft: prints and
//  exits 0 on any problem so it never blocks the cron.
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/moodlelib.php');

global $DB, $CFG;

$daysleft = (int) getenv('DAYS_LEFT');
$renewurl = trim((string) getenv('RENEW_URL')) ?: $CFG->wwwroot;
$owneruser = getenv('OWNER_USER') ?: 'owner';
$expirydate = trim((string) getenv('EXPIRY_DATE'));   // YYYY-MM-DD (sync target)
$sendemail  = getenv('SEND_EMAIL') !== '0';           // '0' = sync only, no email
$mode       = getenv('MODE') ?: 'expiry';             // expiry | prerenew (auto-renew heads-up)
$amountegp  = (int) getenv('AMOUNT_EGP');             // prerenew: charge amount
$cardlast4  = trim((string) getenv('CARD_LAST4'));    // prerenew: saved card last 4

// Keep the academy's local_license/expirydate in sync with nit2's validUntil so
// the in-academy banner always matches. Runs every cron tick, even without email.
if ($expirydate !== '') {
    set_config('expirydate', $expirydate, 'local_license');
    echo "expirydate synced -> {$expirydate}\n";
}
if (!$sendemail) {
    exit(0);   // sync-only run — no reminder email this time.
}

// Recipient: the owner account, else the built-in admin.
$to = $DB->get_record('user', ['username' => $owneruser, 'deleted' => 0]);
if (!$to) {
    $to = $DB->get_record('user', ['username' => 'admin', 'deleted' => 0]);
}
if (!$to || trim((string) $to->email) === '') {
    fwrite(STDERR, "no owner/admin email to notify — skipping\n");
    exit(0);
}

$locale   = ($to->lang ?? '') === 'en' ? 'en' : 'ar';
$sitename = format_string($DB->get_field('course', 'fullname', ['id' => SITEID]));
$name     = fullname($to);
$expired  = $daysleft <= 0;

// ── Auto-renew heads-up (mode=prerenew): the card WILL be charged automatically,
// so the copy reassures rather than asking the owner to renew manually. ──────────
if ($mode === 'prerenew') {
    $cardhint = $cardlast4 !== '' ? "•••• {$cardlast4}" : ($locale === 'en' ? 'your saved card' : 'بطاقتك المحفوظة');
    if ($locale === 'en') {
        $subject = "Heads-up: \"{$sitename}\" auto-renews in {$daysleft} day(s)";
        $body = "Hello {$name},\n\n"
            . "Your academy \"{$sitename}\" will renew automatically in {$daysleft} day(s). "
            . "We’ll charge {$amountegp} EGP to {$cardhint} — no action needed.\n\n"
            . "Want to change or cancel auto-renew? Manage it here: {$renewurl}\n\n— NIT";
    } else {
        $subject = "تنبيه: تجديد تلقائي لأكاديمية \"{$sitename}\" خلال {$daysleft} يوم";
        $body = "مرحباً {$name}،\n\n"
            . "سيتم تجديد اشتراك أكاديميتك \"{$sitename}\" تلقائياً خلال {$daysleft} يوم. "
            . "سنخصم {$amountegp} ج.م من {$cardhint} — لا حاجة لأي إجراء.\n\n"
            . "لتغيير أو إلغاء التجديد التلقائي: {$renewurl}\n\n— NIT";
    }
    $from = \core_user::get_support_user();
    if (email_to_user($to, $from, $subject, $body)) {
        echo "pre-renew notice sent to {$to->email} (daysleft={$daysleft}, amount={$amountegp})\n";
    } else {
        fwrite(STDERR, "email_to_user failed (is outbound email/SMTP configured?)\n");
    }
    exit(0);
}

if ($locale === 'en') {
    if ($expired) {
        $subject = "Your academy \"{$sitename}\" has expired";
        $body = "Hello {$name},\n\n"
            . "Your academy \"{$sitename}\" subscription has ended. It will be paused soon "
            . "if not renewed — your data stays safe.\n\n"
            . "Renew now: {$renewurl}\n\n— NIT";
    } else {
        $subject = "Your academy \"{$sitename}\" expires in {$daysleft} day(s)";
        $body = "Hello {$name},\n\n"
            . "Your academy \"{$sitename}\" subscription expires in {$daysleft} day(s). "
            . "Renew to avoid any interruption — your data stays safe.\n\n"
            . "Renew now: {$renewurl}\n\n— NIT";
    }
} else {
    if ($expired) {
        $subject = "انتهى اشتراك أكاديميتك \"{$sitename}\"";
        $body = "مرحباً {$name}،\n\n"
            . "انتهى اشتراك أكاديميتك \"{$sitename}\". سيتم إيقافها مؤقتاً قريباً إذا لم يتم التجديد، "
            . "وبياناتك محفوظة.\n\n"
            . "جدّد الآن: {$renewurl}\n\n— NIT";
    } else {
        $subject = "اشتراك أكاديميتك \"{$sitename}\" ينتهي خلال {$daysleft} يوم";
        $body = "مرحباً {$name}،\n\n"
            . "اشتراك أكاديميتك \"{$sitename}\" ينتهي خلال {$daysleft} يوم. "
            . "جدّد لتجنّب أي انقطاع، وبياناتك محفوظة.\n\n"
            . "جدّد الآن: {$renewurl}\n\n— NIT";
    }
}

$from = \core_user::get_support_user();
if (email_to_user($to, $from, $subject, $body)) {
    echo "expiry reminder sent to {$to->email} (daysleft={$daysleft})\n";
} else {
    fwrite(STDERR, "email_to_user failed (is outbound email/SMTP configured?)\n");
}
