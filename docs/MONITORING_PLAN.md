# Monitoring Plan
# ختمة — Khatma Platform

**Version:** 1.0.0  

---

## 1. Monitoring Stack

| Tool | Purpose | Cost |
|------|---------|------|
| Prometheus | Metrics collection | Free (self-hosted) |
| Grafana | Dashboards + alerts | Free (self-hosted) |
| Loki | Log aggregation | Free (self-hosted) |
| Sentry | Error tracking | Free tier / $26/mo |
| Uptime Robot | External uptime | Free tier |
| pg_stat_statements | DB query analysis | Free (PostgreSQL) |

---

## 2. Key Metrics to Monitor

### Application Metrics (via Prometheus + NestJS prom-client)

```typescript
// Metrics exported:
http_request_duration_seconds  // histogram, labels: method, route, status
http_requests_total            // counter, labels: method, route, status
active_websocket_connections   // gauge
khatma_part_reservations_total // counter
khatma_completions_total       // counter
user_registrations_total       // counter
```

### Infrastructure Metrics

| Metric | Warning | Critical |
|--------|---------|---------|
| CPU (App) | 70% | 90% |
| Memory (App) | 75% | 90% |
| DB Connections | 80% of pool | 95% |
| Redis Memory | 70% of limit | 85% |
| Disk Usage | 75% | 90% |
| Network I/O | 70% | 90% |

### Business Metrics (Grafana dashboards)

- Active khatmas count
- Parts reserved per hour
- New users per day
- Khatma completion rate
- Average khatma duration

---

## 3. Alert Rules

### Immediate (PagerDuty — on-call response)

```yaml
# alerts.yml
- alert: ServiceDown
  expr: up{job="khatma-backend"} == 0
  for: 1m
  annotations:
    summary: "Backend is down"
    
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  annotations:
    summary: "Error rate > 5% for 5 minutes"

- alert: DatabaseConnectionExhausted
  expr: pg_connections_active / pg_connections_max > 0.95
  for: 2m
  annotations:
    summary: "DB connections near limit"
```

### Warning (Slack notification)

```yaml
- alert: HighLatency
  expr: histogram_quantile(0.95, http_request_duration_seconds) > 0.5
  for: 5m

- alert: HighCPU
  expr: node_cpu_usage > 0.7
  for: 10m

- alert: RedisHighMemory
  expr: redis_memory_used / redis_memory_max > 0.7
  for: 5m
```

---

## 4. Grafana Dashboards

### Dashboard 1: API Performance
- Request rate (req/s) — line chart
- Error rate (%) — gauge + alert threshold
- p50, p95, p99 latency — percentile chart
- Top 10 slowest endpoints — table

### Dashboard 2: Real-time
- Active WebSocket connections — gauge
- Part reservations per minute — counter
- Redis pub/sub message rate

### Dashboard 3: Business KPIs
- New users today/week/month
- Khatmas created today
- Parts completed today
- Completion rate funnel

### Dashboard 4: Infrastructure
- CPU, Memory, Disk per server
- DB connections pool
- Redis memory + hit rate
- Network in/out

---

## 5. Log Management (Loki)

```typescript
// Structured logging with Winston + pino
logger.info({ 
  event: 'part_reserved',
  userId: user.id,
  khatmaId: khatma.id,
  partNumber: part.partNumber,
  durationMs: Date.now() - start
});

logger.error({
  event: 'reservation_failed',
  reason: 'concurrent_lock',
  userId: user.id,
  partId: part.id
});
```

**Log Retention:** 30 days in Loki  
**Log Levels:** error, warn (production) | debug, info (development)

---

## 6. Error Tracking (Sentry)

```typescript
// NestJS Sentry integration
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // 10% of requests
  // Don't log sensitive data:
  beforeSend(event) {
    if (event.request?.cookies) delete event.request.cookies;
    if (event.extra?.password) delete event.extra.password;
    return event;
  }
});

// Frontend Sentry
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.05,
});
```

**Alert:** Any new P0 error → immediate Slack notification  
**Weekly:** Review top 10 errors by volume

---

## 7. Uptime Monitoring

**Monitors:**
- `https://khatma.app` — every 1 min
- `https://api.khatma.app/api/health` — every 1 min
- `wss://api.khatma.app/socket.io/` — every 5 min

**Alert:** Downtime → SMS + Email to on-call + Slack #incidents

---

## 8. Weekly Health Report Template

```
Week of: [DATE]

📊 API Performance:
  - Average latency (p95): Xms
  - Error rate: X%
  - Total requests: X

👥 Users:
  - New registrations: X
  - Active users (DAU): X

📖 Khatmas:
  - Created: X
  - Completed: X
  - Parts reserved: X

🔴 Incidents:
  - Count: X
  - MTTR: X minutes

⚡ Performance vs. targets:
  - p95 < 500ms: ✅/❌
  - Error rate < 0.1%: ✅/❌
  - Uptime 99.9%: ✅/❌
```
