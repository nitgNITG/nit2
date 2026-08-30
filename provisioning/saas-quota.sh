#!/usr/bin/env bash
# ============================================================================
#  saas-quota.sh — per-academy moodledata storage quota (monitor + optional
#  enforcement), driven by each academy's local_license tier.
#
#  WHY NOT A HARD BLOCK-LEVEL QUOTA?
#    moodledata is a host bind-mount on an ext4 ROOT filesystem with quotas not
#    enabled. A true hard cap needs ext4 project quotas (tune2fs + remount, a
#    maintenance window) or per-academy loopback images. Until the data dir
#    lives on its own quota-enabled volume, this gives soft enforcement: measure
#    every academy's usage each hour, warn as it approaches its tier limit, and
#    (optionally) suspend one that blows past it — so a single runaway academy
#    can't silently fill the shared disk and take every tenant down with it.
#
#  Report-only by default. Set SAAS_QUOTA_ENFORCE=1 to auto-suspend over-quota
#  academies (reversible: apply-suspend.sh <slug> 0 resumes them).
#
#  Usage:  sudo bash saas-quota.sh            # measure + log (+ enforce if on)
#          sudo SAAS_QUOTA_ENFORCE=1 bash saas-quota.sh
# ============================================================================
set -uo pipefail

ROOT="${SAAS_ROOT:-/var/www/html/saas}"
LOG_DIR="${PROVISION_LOG_DIR:-$ROOT/logs}"
LOG="$LOG_DIR/quota.log"
SUSPEND_SH="${APPLY_SUSPEND_SH:-/root/apply-suspend.sh}"

# Per-tier storage allowance in GB (override any via env).
QUOTA_DEMO_GB="${QUOTA_DEMO_GB:-1}"
QUOTA_BASIC_GB="${QUOTA_BASIC_GB:-5}"
QUOTA_STANDARD_GB="${QUOTA_STANDARD_GB:-20}"
QUOTA_PRO_GB="${QUOTA_PRO_GB:-100}"

WARN_PCT="${SAAS_QUOTA_WARN_PCT:-80}"     # warn at/above this % of the cap
ENFORCE="${SAAS_QUOTA_ENFORCE:-0}"        # 1 = suspend academies over 100%
HOST_DISK_WARN_PCT="${SAAS_HOST_DISK_WARN_PCT:-85}"

mkdir -p "$LOG_DIR"
ts(){ date '+%Y-%m-%d %H:%M:%S'; }
line(){ echo "$*"; echo "$(ts)  $*" >> "$LOG"; }

cap_gb_for(){ case "$1" in
    basic) echo "$QUOTA_BASIC_GB";; standard) echo "$QUOTA_STANDARD_GB";;
    professional) echo "$QUOTA_PRO_GB";; *) echo "$QUOTA_DEMO_GB";; esac; }

# ── Host disk headroom first (the thing a runaway academy threatens) ─────────
HOST_USE=$(df -P "$ROOT" | awk 'NR==2{gsub("%","",$5);print $5}')
line "── quota sweep (enforce=$ENFORCE, host disk ${HOST_USE}% used) ──"
if [[ "${HOST_USE:-0}" -ge "$HOST_DISK_WARN_PCT" ]]; then
    line "!! HOST DISK ${HOST_USE}% — above ${HOST_DISK_WARN_PCT}% warn threshold; free space or add disk"
fi

printf '%-26s %-13s %10s %8s %8s   %s\n' "ACADEMY" "TIER" "USED" "CAP" "PCT" "STATUS"

shopt -s nullglob
any=0
for c in $(docker ps --format '{{.Names}}' | grep '^saas_moodle_' || true); do
    any=1
    slug="${c#saas_moodle_}"
    dir="$ROOT/clients/$slug/moodledata"
    [[ -d "$dir" ]] || { printf '%-26s %-13s %10s\n' "$slug" "-" "no dir"; continue; }

    used_b=$(du -sb "$dir" 2>/dev/null | cut -f1); used_b="${used_b:-0}"
    tier=$(docker exec "$c" php /var/www/html/admin/cli/cfg.php --component=local_license --name=tier 2>/dev/null | tr -d '[:space:]')
    [[ -n "$tier" ]] || tier="demo"
    # Dynamic per-academy cap set from the licence's storageGb (create/apply-license
    # write local_license/storagegb). Fall back to the tier default map if unset.
    cap_gb=$(docker exec "$c" php /var/www/html/admin/cli/cfg.php --component=local_license --name=storagegb 2>/dev/null | tr -d '[:space:]')
    [[ "$cap_gb" =~ ^[0-9]+$ && "$cap_gb" -gt 0 ]] || cap_gb="$(cap_gb_for "$tier")"
    cap_b=$(( cap_gb * 1024 * 1024 * 1024 ))
    pct=$(( cap_b > 0 ? used_b * 100 / cap_b : 0 ))
    used_h=$(numfmt --to=iec --suffix=B "$used_b" 2>/dev/null || echo "${used_b}B")

    status="OK"
    if   [[ "$pct" -ge 100 ]]; then status="OVER"
    elif [[ "$pct" -ge "$WARN_PCT" ]]; then status="WARN"; fi

    printf '%-26s %-13s %10s %7sG %7s%%   %s\n' "$slug" "$tier" "$used_h" "$cap_gb" "$pct" "$status"

    if [[ "$status" != "OK" ]]; then
        line "$status  $slug  tier=$tier  used=$used_h  cap=${cap_gb}G  (${pct}%)"
    fi

    if [[ "$status" == "OVER" && "$ENFORCE" == "1" ]]; then
        already=$(docker exec "$c" php /var/www/html/admin/cli/cfg.php --component=local_license --name=suspended 2>/dev/null | tr -d '[:space:]')
        if [[ "$already" == "1" ]]; then
            line "   $slug already suspended — leaving as is"
        elif [[ -x "$SUSPEND_SH" ]]; then
            line "   ENFORCE: suspending $slug (over quota)"
            bash "$SUSPEND_SH" "$slug" 1 >/dev/null 2>&1 && line "   $slug suspended" || line "   !! failed to suspend $slug"
        else
            line "   !! $SUSPEND_SH not executable — cannot enforce"
        fi
    fi
done
[[ "$any" == "1" ]] || line "no academies found"
