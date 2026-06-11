# Incident Response Plan
# ختمة — Khatma Platform

**Version:** 1.0.0  

---

## 1. Severity Levels

| Level | Definition | Examples | Response Time |
|-------|-----------|---------|--------------|
| P0 — Critical | Complete service outage or data loss | API down, DB down, security breach | < 15 min |
| P1 — High | Core feature broken, many users affected | Reservation failing, auth broken | < 1 hour |
| P2 — Medium | Feature degraded, workaround exists | Slow performance, WS disconnections | < 4 hours |
| P3 — Low | Minor issue, small user impact | UI glitch, minor error | < 24 hours |

---

## 2. On-Call Rotation

| Day | Primary | Secondary |
|-----|---------|-----------|
| Mon–Fri | Backend Dev | DevOps |
| Sat–Sun | DevOps | Backend Dev |

**Escalation:** If no response in 15 min → escalate to secondary → Tech Lead

---

## 3. Incident Response Playbooks

### P0: Backend API Down

```
DETECTION: Uptime Robot alert OR error rate > 50%

IMMEDIATE ACTIONS (0–5 min):
1. SSH to production: ssh deploy@prod-server
2. Check container status: docker ps
3. Check logs: docker logs khatma_backend_1 --tail 100
4. Check health: curl http://localhost:3001/api/health

IF containers running but not responding:
  → docker restart khatma_backend_1 khatma_backend_2 khatma_backend_3 khatma_backend_4

IF containers crashed:
  → docker-compose -f docker-compose.prod.yml up -d backend
  → If still failing: docker logs khatma_backend_1 --tail 500 | grep ERROR

IF recent deploy:
  → ROLLBACK immediately: ./scripts/rollback.sh

COMMUNICATION (5–15 min):
  → Post in #incidents: "P0 incident: API down. Investigating."
  → If > 5 min: Post status update on https://status.khatma.app

RESOLUTION:
  → Identify root cause
  → Fix + verify: curl https://api.khatma.app/api/health
  → Post-mortem within 24 hours
```

---

### P0: Database Down

```
1. Check PostgreSQL: docker logs khatma_postgres
2. Check disk space: df -h (full disk = common cause)
3. Check connections: psql -c "SELECT count(*) FROM pg_stat_activity"
4. Check if Read Replica is up → switch traffic to replica (read-only mode)
5. Attempt DB restart: docker restart khatma_postgres
6. If disk full: clean old logs/WAL files
7. If corruption: restore from latest backup (see BACKUP_AND_RECOVERY.md)
```

---

### P0: Security Breach

```
IMMEDIATE (0–15 min):
1. Identify scope: which data/systems affected
2. If active attack: Block attacker's IP in Cloudflare/Nginx
3. Revoke ALL refresh tokens: 
   redis-cli FLUSHDB  (nuclear option — logs out all users)
4. Rotate JWT keys immediately (new keypair)
5. Restart all backends with new keys

NOTIFY (within 1 hour):
  → Tech Lead
  → Legal (if user data breach)
  → Affected users (if required by law)

PRESERVE EVIDENCE:
  → Copy logs before any restart
  → Document timeline
```

---

### P1: Reservation Feature Broken

```
SYMPTOMS: Part reservations returning errors, duplicate reservations

1. Check Redis: redis-cli ping
   → If Redis is down: Redis is required for locks → restart Redis
2. Check for DB locks: 
   SELECT pid, query, wait_event_type FROM pg_stat_activity WHERE wait_event IS NOT NULL
3. Check unique constraint: 
   SELECT COUNT(*) FROM reserved_parts GROUP BY part_id HAVING COUNT(*) > 1
   → If duplicates found: DATA INTEGRITY ISSUE → P0 escalate
4. Check backend logs for lock acquisition failures
5. If rate limiting too aggressive: temporarily increase limit in Nginx
```

---

### P1: WebSocket Disconnections

```
1. Check backend logs: grep "socket.io" in logs
2. Check Redis Pub/Sub: redis-cli monitor | grep khatma
3. Check Nginx timeout config (proxy_read_timeout should be 86400)
4. Check if Redis adapter configured correctly
5. Client-side: verify auto-reconnect logic is working
6. If partial outage: restart specific backend instance
```

---

## 4. Communication Templates

### Status Page Update (user-facing)
```
[INVESTIGATING] We are aware of issues affecting [feature]. 
Our team is investigating. — [TIME]

[IDENTIFIED] We have identified the cause of [issue] and are working on a fix. — [TIME]

[RESOLVED] The issue with [feature] has been resolved. 
All systems are operating normally. — [TIME]
Root cause: [brief explanation]
```

### Internal Slack (#incidents)
```
🔴 P0 INCIDENT - [TIME]
Issue: API not responding
Impact: All users cannot use the app
Responder: @username
Status: Investigating

UPDATE [TIME+5min]: Identified as container crash. Restarting.
UPDATE [TIME+10min]: Service restored. Monitoring.
RESOLVED [TIME+15min]: Root cause: OOM. Fix: increased memory limit.
Post-mortem due: [DATE+24h]
```

---

## 5. Post-Mortem Template

```markdown
# Incident Post-Mortem — [DATE]

**Severity:** P0/P1/P2
**Duration:** X minutes
**Impact:** X% of users affected

## Timeline
- T+0: Alert fired
- T+5: Root cause identified
- T+15: Fix deployed
- T+20: Resolved

## Root Cause
[Explain what happened technically]

## Contributing Factors
[What made this worse or allowed it to happen]

## What Went Well
- Fast detection via monitoring
- Clear runbook

## Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| Fix root cause | BE Dev | [DATE] |
| Add alert for X | DevOps | [DATE] |
| Update runbook | QA | [DATE] |
```
