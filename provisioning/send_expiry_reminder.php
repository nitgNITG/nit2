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
$mode       = getenv('MODE') ?: 'expiry';             // expiry | prerenew | receipt | payment_failed
$amountegp  = (int) getenv('AMOUNT_EGP');             // charge amount (auto-renew modes)
$cardlast4  = trim((string) getenv('CARD_LAST4'));    // saved card last 4
$cardexp    = getenv('CARD_EXPIRING') === '1';        // prerenew: card expires before the charge

// Keep the academy's local_license/expirydate in sync with nit2's validUntil so
// the in-academy banner always matches. Runs every cron tick, even without email.
if ($expirydate !== '') {
    set_config('expirydate', $expirydate, 'local_license');
    echo "expirydate synced -> {$expirydate}\n";
}
// Auto-renew flag for the in-academy banner ('' = leave unchanged).
$autorenew = trim((string) getenv('AUTORENEW'));
if ($autorenew === '0' || $autorenew === '1') {
    set_config('autorenew', $autorenew, 'local_license');
    echo "autorenew synced -> {$autorenew}\n";
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

// ── Auto-renew billing emails (prerenew | receipt | payment_failed). These modes
// concern the card-on-file, so the copy speaks to the automatic charge, not a
// manual renewal. All send + exit here. ─────────────────────────────────────────
if (in_array($mode, ['prerenew', 'receipt', 'payment_failed'], true)) {
    $en = $locale === 'en';
    $cardhint = $cardlast4 !== '' ? "•••• {$cardlast4}" : ($en ? 'your saved card' : 'بطاقتك المحفوظة');

    if ($mode === 'prerenew' && $cardexp) {
        // Card will be expired by the charge date → ask them to update it.
        if ($en) {
            $subject = "Action needed: update your card for \"{$sitename}\"";
            $body = "Hello {$name},\n\n"
                . "Your academy \"{$sitename}\" renews automatically in {$daysleft} day(s) for {$amountegp} EGP, "
                . "but your saved card {$cardhint} will have expired by then — so the renewal will fail.\n\n"
                . "Please update your card to avoid interruption: {$renewurl}\n\n— NIT";
        } else {
            $subject = "مطلوب إجراء: حدّث بطاقتك لأكاديمية \"{$sitename}\"";
            $body = "مرحباً {$name}،\n\n"
                . "سيتم تجديد اشتراك أكاديميتك \"{$sitename}\" تلقائياً خلال {$daysleft} يوم بمبلغ {$amountegp} ج.م، "
                . "لكن بطاقتك المحفوظة {$cardhint} ستكون منتهية الصلاحية — لذا سيفشل التجديد.\n\n"
                . "برجاء تحديث بطاقتك لتجنّب أي انقطاع: {$renewurl}\n\n— NIT";
        }
    } elseif ($mode === 'prerenew') {
        if ($en) {
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
    } elseif ($mode === 'receipt') {
        $nextline = $expirydate !== '' ? ($en ? "Next renewal: {$expirydate}." : "التجديد القادم: {$expirydate}.") : '';
        if ($en) {
            $subject = "Payment received — \"{$sitename}\" renewed";
            $body = "Hello {$name},\n\n"
                . "We’ve charged {$amountegp} EGP to {$cardhint} and renewed your academy \"{$sitename}\". "
                . "{$nextline}\n\n"
                . "Manage or cancel auto-renew any time: {$renewurl}\n\n— NIT";
        } else {
            $subject = "تم استلام الدفع — تم تجديد \"{$sitename}\"";
            $body = "مرحباً {$name}،\n\n"
                . "تم خصم {$amountegp} ج.م من {$cardhint} وتجديد اشتراك أكاديميتك \"{$sitename}\". "
                . "{$nextline}\n\n"
                . "يمكنك إدارة أو إلغاء التجديد التلقائي في أي وقت: {$renewurl}\n\n— NIT";
        }
    } else { // payment_failed
        if ($en) {
            $subject = "Payment failed for \"{$sitename}\" — update your card";
            $body = "Hello {$name},\n\n"
                . "We couldn’t charge {$amountegp} EGP to your card {$cardhint} to renew \"{$sitename}\". "
                . "We’ll retry automatically, but to avoid any interruption please update your card or renew: {$renewurl}\n\n"
                . "Your data stays safe.\n\n— NIT";
        } else {
            $subject = "فشل الدفع لأكاديمية \"{$sitename}\" — حدّث بطاقتك";
            $body = "مرحباً {$name}،\n\n"
                . "تعذّر خصم {$amountegp} ج.م من بطاقتك {$cardhint} لتجديد \"{$sitename}\". "
                . "سنعيد المحاولة تلقائياً، ولتجنّب أي انقطاع برجاء تحديث بطاقتك أو التجديد: {$renewurl}\n\n"
                . "بياناتك محفوظة.\n\n— NIT";
        }
    }

    $from = \core_user::get_support_user();
    if (email_to_user($to, $from, $subject, $body)) {
        echo "billing email ({$mode}) sent to {$to->email} (daysleft={$daysleft}, amount={$amountegp})\n";
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
