# Backup & Recovery Plan
# ختمة — Khatma Platform

**Version:** 1.0.0  
**RPO:** < 1 hour  
**RTO:** < 2 hours  

---

## 1. Backup Strategy

### Database Backups

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Full dump | Daily at 2 AM UTC | 30 days local, 1 year S3 | S3 + local |
| WAL archiving | Continuous | 7 days | S3 |
| Weekly snapshot | Sunday midnight | 6 months | S3 |
| Monthly snapshot | 1st of month | 2 years | S3 Glacier |

### Redis Backups
- AOF (Append-Only File) persistence enabled
- RDB snapshot every 15 minutes
- Stored locally + synced to S3 hourly

### File Storage (Cloudinary)
- Cloudinary handles its own backup
- Export/archive user avatars monthly

---

## 2. Backup Script

```bash
#!/bin/bash
# /scripts/backup-db.sh

set -e

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/backups"
S3_BUCKET="s3://khatma-backups"

# Full PostgreSQL backup
echo "Starting backup at $TIMESTAMP"
pg_dump $DATABASE_URL \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="$BACKUP_DIR/khatma-$TIMESTAMP.dump"

# Verify backup is valid
pg_restore --list "$BACKUP_DIR/khatma-$TIMESTAMP.dump" > /dev/null
echo "Backup verified"

# Upload to S3
aws s3 cp "$BACKUP_DIR/khatma-$TIMESTAMP.dump" \
  "$S3_BUCKET/daily/khatma-$TIMESTAMP.dump"

# Cleanup old local backups (keep 7 days)
find $BACKUP_DIR -name "*.dump" -mtime +7 -delete

# Log success
echo "Backup completed: khatma-$TIMESTAMP.dump"

# Send metric to monitoring
curl -X POST $MONITORING_URL/backup_completed \
  -d '{"timestamp":"'$TIMESTAMP'","size":"'$(du -sh $BACKUP_DIR/khatma-$TIMESTAMP.dump | cut -f1)'"}'
```

---

## 3. Recovery Procedures

### 3.1 Point-in-Time Recovery (< 1 hour data loss)

```bash
# 1. Stop backend services to prevent new writes
docker-compose stop backend

# 2. Find the latest backup before incident
aws s3 ls s3://khatma-backups/daily/ --recursive | sort | tail -5

# 3. Download backup
aws s3 cp s3://khatma-backups/daily/khatma-20260305-020000.dump /tmp/restore.dump

# 4. Create new DB (keep old as audit)
createdb khatma_restored

# 5. Restore
pg_restore \
  --dbname=khatma_restored \
  --no-owner \
  --clean \
  --if-exists \
  /tmp/restore.dump

# 6. Verify restored data
psql khatma_restored -c "SELECT COUNT(*) FROM users;"
psql khatma_restored -c "SELECT COUNT(*) FROM khatmas;"

# 7. Switch connection string and restart
export DATABASE_URL="postgresql://khatma:pass@localhost/khatma_restored"
docker-compose start backend

# 8. Verify health
curl https://api.khatma.app/api/health
```

### 3.2 Redis Recovery

```bash
# 1. Stop Redis
docker stop khatma_redis

# 2. Copy latest RDB snapshot
aws s3 cp s3://khatma-backups/redis/dump.rdb /data/redis/dump.rdb

# 3. Restart Redis
docker start khatma_redis

# 4. Verify
redis-cli ping  # Should return PONG
redis-cli info keyspace  # Should show key counts
```

---

## 4. Backup Verification (Monthly Test)

```bash
# Run monthly on a separate staging-like environment
#!/bin/bash
# /scripts/test-backup.sh

# Download latest backup
LATEST=$(aws s3 ls s3://khatma-backups/daily/ | sort | tail -1 | awk '{print $4}')
aws s3 cp "s3://khatma-backups/daily/$LATEST" /tmp/test-restore.dump

# Create test database
createdb khatma_test_restore_$(date +%Y%m%d)

# Restore
pg_restore --dbname=khatma_test_restore_$(date +%Y%m%d) /tmp/test-restore.dump

# Verify key tables exist and have data
USERS=$(psql khatma_test_restore_$(date +%Y%m%d) -t -c "SELECT COUNT(*) FROM users;")
KHATMAS=$(psql khatma_test_restore_$(date +%Y%m%d) -t -c "SELECT COUNT(*) FROM khatmas;")

echo "Restore test: Users=$USERS, Khatmas=$KHATMAS"

if [ "$USERS" -gt 0 ]; then
  echo "✅ Backup restore test PASSED"
else
  echo "❌ Backup restore test FAILED — ALERT!"
  # Send alert
fi

# Cleanup
dropdb khatma_test_restore_$(date +%Y%m%d)
rm /tmp/test-restore.dump
```

---

## 5. Disaster Recovery Scenario

### Scenario: Complete Server Loss

```
RTO Target: < 2 hours

Steps:
1. Provision new server (15 min via IaC/Terraform)
2. Install Docker + dependencies (10 min)
3. Download and restore latest DB backup (20 min)
4. Restore Redis data (5 min)
5. Deploy application containers (10 min)
6. Update DNS to new server IP (5 min — Cloudflare instant)
7. Verify health checks pass (5 min)
8. Monitor for 15 minutes

Total: ~85 minutes
```

### IaC Requirement
- Infrastructure defined in Terraform / Ansible
- Can provision identical environment in < 15 minutes
- Runbook tested quarterly
