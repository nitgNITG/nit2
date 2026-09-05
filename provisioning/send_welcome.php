<?php
// ============================================================================
//  send_welcome.php — provision the academy OWNER account (a restricted
//  "Academy Manager", NOT a site admin), email the customer their login, and
//  lock down the built-in `admin` account as NIT's own super-admin.
//
//  Run inside an academy container by create.sh (AFTER ensure_owner_role.php):
//     php <dataroot>/send_welcome.php
//
//  Model (see ensure_owner_role.php for the why):
//    - The CUSTOMER logs in on a dedicated OWNER account holding the
//      `academymanager` role — full day-to-day management, no site config.
//    - The built-in `admin` account stays NIT's sole site admin. We set it to a
//      random NIT password (never emailed) so no academy ships with the
//      template's shared admin password. NIT keeps shell/CLI access to reset it.
//
//  Reads env (passed by create.sh):
//    OWNER_USER    owner account username to create/point (default: owner)
//    OWNER_PASS    generated owner password to set + email (nit2 stores it enc.)
//    OWNER_EMAIL   customer email (owner account email + recipient)
//    OWNER_NAME    customer display name (optional)
//    OWNER_LOCALE  ar | en  (email language; default ar)
//    OWNER_ROLE    role shortname to assign (default: academymanager)
//    ADMIN_PASS    random NIT password for the built-in `admin` account
//                  (optional; if unset the admin password is left unchanged)
//
//  Effects: ensures the owner account + role, sets its password, forces a
//  first-login password change, secures the admin account, then emails the
//  owner their credentials. (Outbound email needs SMTP configured to deliver.)
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/moodlelib.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->libdir . '/accesslib.php');

global $DB, $CFG;

$owneruser  = getenv('OWNER_USER') ?: 'owner';
$ownerpass  = (string) getenv('OWNER_PASS');
$email      = trim((string) getenv('OWNER_EMAIL'));
$name       = trim((string) getenv('OWNER_NAME'));
$locale     = (getenv('OWNER_LOCALE') === 'en') ? 'en' : 'ar';
$roleshort  = getenv('OWNER_ROLE') ?: 'academymanager';
$adminpass  = (string) getenv('ADMIN_PASS');

$systemcontext = context_system::instance();

// ── 1) Secure the built-in `admin` account as NIT's super-admin ─────────────
// Give it a random NIT password (not the template's shared one, not emailed).
// Left unchanged if ADMIN_PASS wasn't provided.
if ($adminpass !== '') {
    $admin = $DB->get_record('user', ['username' => 'admin', 'deleted' => 0]);
    if ($admin) {
        update_internal_user_password($admin, $adminpass);
        echo "admin (NIT super-admin) password set\n";
    } else {
        fwrite(STDERR, "built-in admin account not found — skipping admin password\n");
    }
}

if ($ownerpass === '') {
    fwrite(STDERR, "OWNER_PASS not set — skipping owner setup\n");
    exit(0);
}

// ── 2) Create or fetch the OWNER account ────────────────────────────────────
$owner = $DB->get_record('user', ['username' => $owneruser, 'mnethostid' => $CFG->mnet_localhost_id, 'deleted' => 0]);
$parts = $name !== '' ? preg_split('/\s+/', trim($name), 2) : [];
$firstname = $parts[0] ?? 'Academy';
$lastname  = (isset($parts[1]) && trim($parts[1]) !== '') ? trim($parts[1]) : 'Owner';
$validemail = ($email !== '' && validate_email($email));

if (!$owner) {
    $new = new stdClass();
    $new->auth         = 'manual';
    $new->confirmed    = 1;
    $new->mnethostid   = $CFG->mnet_localhost_id;
    $new->username     = $owneruser;
    $new->firstname    = $firstname;
    $new->lastname     = $lastname;
    $new->email        = $validemail ? $email : ($owneruser . '@localhost.invalid');
    $new->lang         = ($locale === 'en') ? 'en' : 'ar';
    $ownerid = user_create_user($new, false, false);
    update_internal_user_password($DB->get_record('user', ['id' => $ownerid]), $ownerpass);
    $owner = $DB->get_record('user', ['id' => $ownerid]);
    echo "created owner account '{$owneruser}' (id {$ownerid})\n";
} else {
    if ($validemail) { $owner->email = $email; }
    $owner->firstname = $firstname;
    $owner->lastname  = $lastname;
    $DB->update_record('user', $owner);
    update_internal_user_password($owner, $ownerpass);
    echo "updated owner account '{$owneruser}' (id {$owner->id})\n";
}

// Force a password change on first login.
set_user_preference('auth_forcepasswordchange', 1, $owner);

// ── 3) Assign the hardened Academy Manager role at system context ────────────
$roleid = $DB->get_field('role', 'id', ['shortname' => $roleshort]);
if ($roleid) {
    role_assign($roleid, $owner->id, $systemcontext->id);
    echo "assigned role '{$roleshort}' to owner at system context\n";
} else {
    fwrite(STDERR, "role '{$roleshort}' not found — run ensure_owner_role.php first\n");
}

// Safety: the owner must NEVER be a site admin.
$adminids = array_filter(array_map('intval', explode(',', (string) $CFG->siteadmins)));
if (in_array((int) $owner->id, $adminids, true)) {
    $adminids = array_values(array_diff($adminids, [(int) $owner->id]));
    set_config('siteadmins', implode(',', $adminids));
    echo "removed owner from siteadmins\n";
}

// ── 4) Email the owner their credentials ────────────────────────────────────
if (!$validemail) {
    fwrite(STDERR, "OWNER_EMAIL missing/invalid — owner set up, no email sent\n");
    exit(0);
}

$sitename = format_string($DB->get_field('course', 'fullname', ['id' => SITEID]));
$url = $CFG->wwwroot;

if ($locale === 'en') {
    $subject = "Your academy \"{$sitename}\" is ready";
    $body = "Hello {$name},\n\n"
        . "Your academy is live: {$url}\n\n"
        . "Login details:\n"
        . "  Username: {$owneruser}\n"
        . "  Password: {$ownerpass}\n\n"
        . "For your security, you will be asked to change this password the first time you log in.\n\n"
        . "— NIT";
} else {
    $subject = "أكاديميتك \"{$sitename}\" جاهزة";
    $body = "مرحباً {$name}،\n\n"
        . "تم تجهيز أكاديميتك ويمكنك الدخول إليها من هنا: {$url}\n\n"
        . "بيانات الدخول:\n"
        . "  اسم المستخدم: {$owneruser}\n"
        . "  كلمة المرور: {$ownerpass}\n\n"
        . "لأمان حسابك سيُطلب منك تغيير كلمة المرور عند أول تسجيل دخول.\n\n"
        . "— NIT";
}

$from = core_user::get_support_user();
if (email_to_user($owner, $from, $subject, $body)) {
    echo "welcome email sent to {$email}\n";
} else {
    fwrite(STDERR, "email_to_user failed (is outbound email/SMTP configured?)\n");
}
