<?php
// ============================================================================
//  ensure_owner_role.php — create/refresh the hardened "Academy Manager" role
//  that academy OWNERS run on (instead of Moodle site admin). Run inside an
//  academy container by create.sh BEFORE send_welcome.php:
//     php <dataroot>/ensure_owner_role.php
//
//  Why: the owner must run the academy day-to-day (courses, users, enrolments,
//  grades, content) but must NOT be able to change site configuration, the
//  licence, or escalate privileges — otherwise they could re-enable
//  licence-gated features (subscriptions/offers/packages/coupons) or turn the
//  local_license master switch off. A Moodle site admin bypasses every check,
//  so owners are NOT site admins any more; they get this role instead.
//
//  The role is seeded from the stock `manager` archetype (good day-to-day
//  management, no moodle/site:config) and then HARDENED, because stock Manager
//  is itself an escalation path:
//    - moodle/role:manage  → could edit any role and grant itself site:config
//    - moodle/role:override → could override permissions to escalate
//    - it may assign the unrestricted stock Manager role to a puppet account
//  We prohibit those and restrict role assignment to teacher/student only.
//
//  Idempotent: safe to run on every provision/upgrade. Re-applies the hardening
//  each time so a Moodle upgrade can't silently loosen it.
//
//  Env (optional):
//    OWNER_ROLE   role shortname to create/refresh (default: academymanager)
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/accesslib.php');

global $DB;

$shortname = getenv('OWNER_ROLE') ?: 'academymanager';
$name = 'Academy Manager';
$desc = 'Academy owner: full day-to-day management of the academy, but cannot '
      . 'change site configuration, the licence, or escalate privileges.';

$systemcontext = context_system::instance();

$role  = $DB->get_record('role', ['shortname' => $shortname]);
$fresh = false;
if (!$role) {
    // archetype 'manager' → inherits the sensible day-to-day management defaults.
    $roleid = create_role($name, $shortname, $desc, 'manager');
    $fresh  = true;
    echo "created role '{$shortname}' (id {$roleid})\n";
} else {
    $roleid = (int) $role->id;
    echo "role '{$shortname}' already exists (id {$roleid})\n";
}

if ($fresh) {
    // Apply the manager archetype's default capabilities + allow matrices, then
    // make it assignable where an owner needs to work.
    reset_role_capabilities($roleid);
    set_role_contextlevels($roleid, [CONTEXT_SYSTEM, CONTEXT_COURSECAT, CONTEXT_COURSE]);
}

// ── Harden (re-applied every run) ──────────────────────────────────────────
// Block every route back to site configuration / privilege escalation.
$prohibit = [
    'moodle/role:manage',   // editing role definitions ⇒ could grant self anything
];
$prevent = [
    'moodle/role:override', // overriding permissions ⇒ escalation
    'moodle/site:config',   // defensive: never allow site configuration
    'moodle/site:configview',
];
foreach ($prohibit as $cap) {
    assign_capability($cap, CAP_PROHIBIT, $roleid, $systemcontext->id, true);
}
foreach ($prevent as $cap) {
    assign_capability($cap, CAP_PREVENT, $roleid, $systemcontext->id, true);
}

// ── Restrict role assignment ────────────────────────────────────────────────
// The owner may assign ONLY teacher/student/editing-teacher — never manager or
// this role itself (either would re-open the escalation door).
$allowed = [];
foreach (['editingteacher', 'teacher', 'student'] as $sn) {
    $tid = $DB->get_field('role', 'id', ['shortname' => $sn]);
    if ($tid) {
        $allowed[(int) $tid] = true;
        core_role_set_assign_allowed($roleid, (int) $tid);
    }
}
// Drop any other allow-assign entries the archetype seeded (e.g. manager).
foreach ($DB->get_records('role_allow_assign', ['roleid' => $roleid]) as $row) {
    if (empty($allowed[(int) $row->allowassign])) {
        $DB->delete_records('role_allow_assign', ['id' => $row->id]);
    }
}
// And drop allow-override entirely (they can't override permissions to escalate).
$DB->delete_records('role_allow_override', ['roleid' => $roleid]);

// Make the new permissions take effect.
$systemcontext->mark_dirty();
echo "hardened role '{$shortname}' (prohibit role:manage; prevent override/site:config; assign teacher/student only)\n";
