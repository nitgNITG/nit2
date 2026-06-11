# Production Deployment Guide
# ختمة — Khatma Platform

**Version:** 1.0.0  

---

## 1. Infrastructure Requirements

### Minimum Production Specs

| Server | CPU | RAM | Storage | Purpose |
|--------|-----|-----|---------|---------|
| App-1 | 4 vCPU | 8 GB | 50 GB | Backend + Frontend |
| App-2 | 4 vCPU | 8 GB | 50 GB | Backend + Frontend (scale) |
| DB-1 | 4 vCPU | 16 GB | 200 GB SSD | PostgreSQL Primary |
| DB-2 | 2 vCPU | 8 GB | 200 GB SSD | PostgreSQL Read Replica |
| Cache | 2 vCPU | 4 GB | 20 GB | Redis |
| LB | 2 vCPU | 2 GB | 20 GB | Nginx Load Balancer |

**Cloud Provider:** AWS / DigitalOcean / Hetzner  
**Estimated Monthly Cost:** $200–400/month at launch scale

---

## 2. Environment Variables (Production)

```bash
# Database
DATABASE_URL="postgresql://khatma_prod:STRONG_PASSWORD@db-primary:5432/khatma_prod?schema=public"
DATABASE_READ_URL="postgresql://khatma_readonly:PASSWORD@db-replica:5432/khatma_prod?schema=public"

# Redis
REDIS_URL="redis://:PASSWORD@redis-cluster:6379"

# JWT (RS256 — generate new keypair for prod)
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Cloudinary (for avatar uploads)
CLOUDINARY_CLOUD_NAME="khatma-prod"
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

# SMS/OTP Service
SMS_API_KEY="..."
SMS_SENDER_ID="Khatma"

# Application
NODE_ENV="production"
PORT="3001"
FRONTEND_URL="https://khatma.app"
API_URL="https://api.khatma.app"

# Monitoring
SENTRY_DSN="https://...@sentry.io/..."

# Logging
LOG_LEVEL="warn"
```

---

## 3. Docker Compose Production

```yaml
# docker-compose.prod.yml
version: '3.9'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/prod.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on: [backend, frontend]
    restart: always

  backend:
    image: ${REGISTRY}/khatma-backend:${IMAGE_TAG}
    env_file: .env.prod
    ports:
      - "3001:3001"
    deploy:
      replicas: 4
      restart_policy:
        condition: on-failure
        max_attempts: 3
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    image: ${REGISTRY}/khatma-frontend:${IMAGE_TAG}
    env_file: .env.prod
    ports:
      - "3000:3000"
    restart: always
```

---

## 4. Initial Deployment Steps

```bash
# 1. SSH to production server
ssh deploy@prod-server

# 2. Clone repo
git clone https://github.com/your-org/khatma.git /app/khatma
cd /app/khatma

# 3. Create production .env
cp .env.example .env.prod
# Edit .env.prod with production values

# 4. Pull Docker images
docker-compose -f docker-compose.prod.yml pull

# 5. Run database migrations
docker-compose -f docker-compose.prod.yml run --rm backend \
  npx prisma migrate deploy

# 6. Seed initial data (super admin)
docker-compose -f docker-compose.prod.yml run --rm backend \
  npx ts-node prisma/seed.prod.ts

# 7. Start all services
docker-compose -f docker-compose.prod.yml up -d

# 8. Verify health
curl https://khatma.app/api/health
# Expected: {"status":"ok","db":"connected","redis":"connected"}

# 9. Check logs
docker-compose -f docker-compose.prod.yml logs -f backend
```

---

## 5. Zero-Downtime Deployment

```bash
# Blue-Green Deploy Script
#!/bin/bash
set -e

NEW_TAG=$1
CURRENT_TAG=$(cat /app/khatma/.current-tag)

echo "Deploying $NEW_TAG (current: $CURRENT_TAG)"

# Pull new images
docker pull $REGISTRY/khatma-backend:$NEW_TAG
docker pull $REGISTRY/khatma-frontend:$NEW_TAG

# Run migrations (safe to run multiple times)
docker run --rm --env-file .env.prod \
  $REGISTRY/khatma-backend:$NEW_TAG \
  npx prisma migrate deploy

# Update backend instances one at a time
for i in 1 2 3 4; do
  echo "Updating backend instance $i..."
  docker service update \
    --image $REGISTRY/khatma-backend:$NEW_TAG \
    --update-delay 10s \
    khatma_backend
  sleep 15
  # Verify instance is healthy
  curl -sf http://localhost:3001/api/health || { echo "Health check failed!"; exit 1; }
done

# Update frontend
docker service update --image $REGISTRY/khatma-frontend:$NEW_TAG khatma_frontend

echo "$NEW_TAG" > /app/khatma/.current-tag
echo "Deploy complete: $NEW_TAG"
```

---

## 6. SSL Certificate Setup

```bash
# Using Certbot (Let's Encrypt)
certbot certonly --webroot \
  -w /var/www/html \
  -d khatma.app \
  -d www.khatma.app \
  -d api.khatma.app \
  --email admin@khatma.app \
  --agree-tos

# Auto-renewal cron
0 12 * * * /usr/bin/certbot renew --quiet && nginx -s reload
```

---

## 7. Nginx Production Config

```nginx
# /nginx/prod.conf
upstream backend {
    server backend:3001;
    keepalive 32;
}

server {
    listen 80;
    server_name khatma.app www.khatma.app api.khatma.app;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.khatma.app;
    
    ssl_certificate /etc/letsencrypt/live/khatma.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/khatma.app/privkey.pem;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;
    
    location /auth/ {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://backend;
    }
    
    location / {
        limit_req zone=api burst=30;
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

---

## 8. Backup Strategy

```bash
# Daily full backup (runs at 2 AM UTC)
0 2 * * * /scripts/backup-db.sh

# backup-db.sh:
#!/bin/bash
BACKUP_FILE="/backups/khatma-$(date +%Y%m%d-%H%M%S).sql.gz"
pg_dump $DATABASE_URL | gzip > $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://khatma-backups/daily/

# Keep only last 30 days locally
find /backups -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

**Retention Policy:**
- Daily backups: 30 days
- Weekly backups: 6 months  
- Monthly backups: 2 years

---

## 9. Health Endpoints

```typescript
// GET /api/health
{
  "status": "ok",
  "timestamp": "2026-03-05T10:00:00Z",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "database": "connected",
    "redis": "connected",
    "migrations": "up-to-date"
  }
}
```

---

## 10. Rollback Procedure

```bash
# Emergency rollback (< 5 minutes)
PREVIOUS_TAG=$(cat /app/khatma/.previous-tag)
echo "Rolling back to: $PREVIOUS_TAG"

docker service update \
  --image $REGISTRY/khatma-backend:$PREVIOUS_TAG \
  khatma_backend

docker service update \
  --image $REGISTRY/khatma-frontend:$PREVIOUS_TAG \
  khatma_frontend

# Verify
curl -sf https://khatma.app/api/health && echo "Rollback successful"
```
