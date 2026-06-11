# Scalability Plan
# ختمة — Khatma Platform

**Version:** 1.0.0  

---

## 1. Scalability Targets

| Phase | Users | Concurrent | Khatmas | Requests/min |
|-------|-------|------------|---------|-------------|
| MVP Launch | 10,000 | 500 | 1,000 | 5,000 |
| Month 3 | 50,000 | 3,000 | 10,000 | 30,000 |
| Month 6 | 200,000 | 15,000 | 50,000 | 150,000 |
| Year 1 | 1,000,000 | 50,000 | 200,000 | 500,000 |

---

## 2. Horizontal Scaling Strategy

### 2.1 Backend (NestJS)
```
PM2 Cluster Mode: 4 processes per server (CPU cores)
Load Balancer: Nginx upstream (round-robin)
Session: Stateless (JWT) → can scale freely
WebSocket: Redis Pub/Sub → all nodes subscribe

Scaling Trigger: CPU > 70% for 5 min → add instance
Auto-scale down: CPU < 20% for 30 min → remove instance
```

### 2.2 Database Scaling Strategy

**Phase 1 (MVP):**
- Single PostgreSQL primary
- PgBouncer connection pooling (100 connections)

**Phase 2 (50K users):**
- Add Read Replica
- Route SELECT queries to replica
- Prisma split client config

**Phase 3 (200K+ users):**
- Add second read replica
- Consider Citus for sharding (by khatmaId)
- Partial indexes for hot data

**Phase 4 (1M+ users):**
- Multi-region replicas
- Read from nearest region
- Evaluate TimescaleDB for analytics

### 2.3 Redis Scaling
```
Phase 1: Single Redis + AOF persistence
Phase 2: Redis Sentinel (1 primary + 2 replicas)
Phase 3: Redis Cluster (3 shards × 2 replicas)
          - Shard by: khatmaId hash
          - Pub/Sub on dedicated channel nodes
```

---

## 3. WebSocket Scalability

### Problem
Socket.io rooms are in-memory — won't work with multiple backend instances.

### Solution: Redis Adapter
```typescript
// app.module.ts
import { createAdapter } from '@socket.io/redis-adapter';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

### Room Strategy
```
Room per Khatma: "khatma:{khatmaId}"
Max users per room: 1,000 (enforce maxMembers)
Presence tracking: Redis HSET "khatma:{id}:online" userId 1
```

---

## 4. Caching Architecture

### 4.1 Cache Hierarchy
```
Level 1: Next.js ISR (edge) → 30–60 seconds
Level 2: Redis (API) → 10–300 seconds  
Level 3: PostgreSQL (source of truth)
```

### 4.2 Cache Keys Strategy
```
khatma:{id}:detail        → 30s TTL (invalidated on any change)
khatma:{id}:parts         → 10s TTL (high churn during active khatma)
user:{id}:profile         → 5min TTL
user:{id}:khatmas         → 1min TTL
explore:khatmas:page:{n}  → 60s TTL
stats:global              → 5min TTL
```

### 4.3 Cache Invalidation
```typescript
// Event-driven invalidation via Redis Pub/Sub
// When part is reserved:
await redis.del(`khatma:${khatmaId}:parts`);
await redis.del(`khatma:${khatmaId}:detail`);
// Emit invalidation event to all nodes
await pubClient.publish('cache:invalidate', JSON.stringify({
  keys: [`khatma:${khatmaId}:parts`]
}));
```

---

## 5. CDN Strategy

| Asset Type | Strategy | CDN TTL |
|-----------|----------|---------|
| JS/CSS bundles | Cloudflare + hash-busting | 1 year |
| User avatars | Cloudinary | 7 days |
| Static images | Cloudflare | 30 days |
| API responses | NOT cached at CDN | - |
| Khatma detail pages (public) | Cloudflare (ISR origin) | 30s |

---

## 6. Database Optimization

### 6.1 Query Optimization
```sql
-- Avoid N+1: always use Prisma include for related data
-- Bad:
const khatma = await prisma.khatma.findUnique({ where: { id } });
const parts = await prisma.quranPart.findMany({ where: { khatmaId: id } });

-- Good:
const khatma = await prisma.khatma.findUnique({
  where: { id },
  include: { 
    parts: { include: { reservation: { include: { user: true } } } }
  }
});
```

### 6.2 Pagination Strategy
```typescript
// Cursor-based for feeds (infinite scroll)
const items = await prisma.khatma.findMany({
  take: 20,
  skip: 1,
  cursor: { id: lastId },
  orderBy: { createdAt: 'desc' }
});

// Offset for admin/reports
const items = await prisma.khatma.findMany({
  take: 20,
  skip: (page - 1) * 20,
  orderBy: { createdAt: 'desc' }
});
```

### 6.3 Slow Query Prevention
```
- All queries analyzed with EXPLAIN ANALYZE before production
- Queries > 100ms logged as warnings
- Queries > 500ms trigger alert
- Weekly query performance review
- pg_stat_statements enabled
```

---

## 7. Performance Targets & Monitoring

| Metric | Warning | Critical |
|--------|---------|---------|
| API p95 latency | > 300ms | > 1000ms |
| DB query time (p95) | > 100ms | > 500ms |
| Redis operation time | > 10ms | > 50ms |
| WebSocket latency | > 200ms | > 1000ms |
| Error rate | > 0.1% | > 1% |
| CPU usage | > 70% | > 90% |
| Memory usage | > 75% | > 90% |

---

## 8. Load Testing Plan

### Before Launch
```bash
# k6 load test
k6 run --vus 500 --duration 5m load-tests/reserve-part.js
k6 run --vus 1000 --duration 10m load-tests/browse-khatmas.js

# Target scenarios:
1. 500 users all trying to reserve parts in same khatma simultaneously
2. 1000 users browsing khatmas list
3. 200 WebSocket connections to same khatma room
4. Auth endpoints: 100 logins/second
```

### Soak Test
```bash
# 48-hour soak test at 30% expected peak load
# Looking for: memory leaks, connection pool exhaustion, disk growth
```

---

## 9. Graceful Degradation

| Service Down | Behavior |
|-------------|---------|
| Redis | Fallback to DB-only (no caching, reduced performance) |
| WebSocket server | Users see stale data, must refresh manually |
| Read Replica | Route all queries to primary (monitor load) |
| Notification service | Queue notifications, process when back |
| Email/SMS provider | Queue, retry with exponential backoff |

---

## 10. Capacity Planning

### Storage Growth (Year 1)
```
Users: 1M × ~500 bytes = 500 MB
Khatmas: 200K × ~2KB = 400 MB
Quran Parts: 200K × 30 × ~200 bytes = 1.2 GB
Reserved Parts: 5M records × ~300 bytes = 1.5 GB
Notifications: 50M records × ~500 bytes = 25 GB
Audit Logs: 100M records × ~500 bytes = 50 GB
                                    Total: ~80 GB/year

With 2-year audit log retention: ~160 GB DB size
```

### Redis Memory (Year 1 Peak)
```
Active khatma cache: 50K × 5KB = 250 MB
Online presence: 50K users × 100 bytes = 5 MB
Rate limiting: 100K keys × 200 bytes = 20 MB
Sessions: 100K × 1KB = 100 MB
                         Total: ~400 MB
```
