<?php
// ============================================================================
//  send_welcome.php — set the academy admin's credentials and email them to the
//  customer. Run inside an academy container by create.sh:
//     php <dataroot>/send_welcome.php
//
//  Reads env (passed by create.sh):
//    WELCOME_USER   admin username to set (default: admin)
//    WELCOME_PASS   the generated password to set + send
//    OWNER_EMAIL    customer email (becomes the admin account email + recipient)
//    OWNER_NAME     customer display name (optional)
//    OWNER_LOCALE   ar | en  (email language; default ar)
//
//  Effects: sets the admin password, points the admin email at the customer,
//  forces a password change on first login, then emails the login details.
//  (Outbound email must be configured on the academy — SMTP relay — to deliver.)
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/moodlelib.php');

global $DB, $CFG;

$username = getenv('WELCOME_USER') ?: 'admin';
$password = getenv('WELCOME_PASS') ?: '';
$email    = trim((string) getenv('OWNER_EMAIL'));
$name     = trim((string) getenv('OWNER_NAME'));
$locale   = (getenv('OWNER_LOCALE') === 'en') ? 'en' : 'ar';

if ($password === '') { fwrite(STDERR, "WELCOME_PASS not set — skipping\n"); exit(0); }
if ($email === '')    { fwrite(STDERR, "OWNER_EMAIL not set — setting password only, no email\n"); }

$admin = $DB->get_record('user', ['username' => $username, 'deleted' => 0]);
if (!$admin) { fwrite(STDERR, "admin user '$username' not found\n"); exit(1); }

// Point the admin account at the customer + set the generated password.
if ($email !== '' && validate_email($email)) { $admin->email = $email; }
if ($name !== '') {
    // Split "First Last" → firstname + lastname (Moodle requires a non-empty
    // lastname). First whitespace-separated word is the first name, the rest is
    // the last name; a single-word name falls back to a placeholder the owner
    // can edit later.
    $parts = preg_split('/\s+/', trim($name), 2);
    $admin->firstname = $parts[0];
    $admin->lastname  = (isset($parts[1]) && trim($parts[1]) !== '') ? trim($parts[1]) : '-';
}
$DB->update_record('user', $admin);
update_internal_user_password($admin, $password);
// Force a password change on first login.
set_user_preference('auth_forcepasswordchange', 1, $admin);
echo "admin '{$username}' password set; force-change on\n";

// Nothing to email if we have no valid recipient.
if ($email === '' || !validate_email($email)) { exit(0); }

$sitename = format_string($DB->get_field('course', 'fullname', ['id' => SITEID]));
$url = $CFG->wwwroot;

if ($locale === 'en') {
    $subject = "Your academy \"{$sitename}\" is ready";
    $body = "Hello {$name},\n\n"
        . "Your academy is live: {$url}\n\n"
        . "Login details:\n"
        . "  Username: {$username}\n"
        . "  Password: {$password}\n\n"
        . "For your security, you will be asked to change this password the first time you log in.\n\n"
        . "— NIT";
} else {
    $subject = "أكاديميتك \"{$sitename}\" جاهزة";
    $body = "مرحباً {$name}،\n\n"
        . "تم تجهيز أكاديميتك ويمكنك الدخول إليها من هنا: {$url}\n\n"
        . "بيانات الدخول:\n"
        . "  اسم المستخدم: {$username}\n"
        . "  كلمة المرور: {$password}\n\n"
        . "لأمان حسابك سيُطلب منك تغيير كلمة المرور عند أول تسجيل دخول.\n\n"
        . "— NIT";
}

$from = core_user::get_support_user();
if (email_to_user($admin, $from, $subject, $body)) {
    echo "welcome email sent to {$email}\n";
} else {
    fwrite(STDERR, "email_to_user failed (is outbound email/SMTP configured?)\n");
}
