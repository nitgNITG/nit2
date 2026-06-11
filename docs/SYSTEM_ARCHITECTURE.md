# System Architecture
# ختمة — Khatma Platform

**Version:** 1.0.0  
**Status:** Approved  

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │          Next.js 14 App Router (SSR/ISR)             │  │
│   │  TypeScript · TailwindCSS · Zustand · React Query    │  │
│   │  Socket.io-client · PWA Support                      │  │
│   └──────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS / WSS
┌────────────────────────────▼────────────────────────────────┐
│                        CDN / EDGE                            │
│            Cloudflare (Static Assets + DDoS)                 │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                       API GATEWAY                            │
│                   Nginx (Reverse Proxy)                      │
│          Rate Limiting · SSL Termination · Load Balance      │
└──────────┬──────────────────────────────────┬───────────────┘
           │                                  │
┌──────────▼───────────┐         ┌────────────▼──────────────┐
│   REST API Server    │         │   WebSocket Server         │
│   Node.js + NestJS   │         │   Socket.io Gateway        │
│   Port: 3001         │         │   Port: 3002               │
└──────────┬───────────┘         └────────────┬──────────────┘
           │                                  │
┌──────────▼──────────────────────────────────▼──────────────┐
│                       SERVICE LAYER                          │
│  AuthService · KhatmaService · GroupService · NotifService  │
│  ReservationService · ProgressService · AdminService        │
└──────────┬──────────────────────────────────┬──────────────┘
           │                                  │
┌──────────▼───────────┐         ┌────────────▼──────────────┐
│   PostgreSQL (Main)  │         │   Redis Cluster            │
│   Primary + Replica  │         │   Cache · Sessions · Pub/Sub│
│   Port: 5432         │         │   Port: 6379               │
└──────────────────────┘         └───────────────────────────┘
```

---

## 2. Frontend Architecture

### 2.1 Next.js 14 Structure

```
src/
├── app/                          # App Router
│   ├── (public)/                 # Public routes (SSR)
│   │   ├── page.tsx              # Landing page
│   │   ├── explore/page.tsx      # Browse public khatmas
│   │   └── khatma/[id]/page.tsx  # Khatma detail (SSG/ISR)
│   ├── (auth)/                   # Auth routes
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (dashboard)/              # Protected routes
│   │   ├── dashboard/page.tsx
│   │   ├── my-khatmas/page.tsx
│   │   ├── groups/page.tsx
│   │   └── settings/page.tsx
│   ├── admin/                    # Admin panel
│   ├── api/                      # Next.js API routes (BFF)
│   ├── layout.tsx                # Root layout (RTL, fonts)
│   └── globals.css
│
├── components/
│   ├── ui/                       # Base components (shadcn/ui)
│   ├── khatma/                   # Khatma-specific components
│   ├── group/                    # Group components
│   ├── quran/                    # Quran parts grid
│   ├── auth/                     # Auth forms
│   ├── layout/                   # Navbar, Sidebar, Footer
│   └── shared/                   # Reusable components
│
├── hooks/                        # Custom React hooks
│   ├── useKhatma.ts
│   ├── useReservation.ts
│   ├── useRealtime.ts
│   └── useAuth.ts
│
├── store/                        # Zustand stores
│   ├── authStore.ts
│   ├── khatmaStore.ts
│   └── notificationStore.ts
│
├── lib/
│   ├── api.ts                    # Axios instance
│   ├── socket.ts                 # Socket.io client
│   ├── queryClient.ts            # React Query config
│   └── utils.ts
│
├── types/                        # TypeScript interfaces
└── constants/                    # App constants
```

### 2.2 State Management Strategy

| Layer | Tool | Usage |
|-------|------|-------|
| Server State | React Query (TanStack Query) | API data, caching, refetching |
| Global UI State | Zustand | Auth, notifications, modals |
| Real-time State | Socket.io + Zustand | Live khatma updates |
| Form State | React Hook Form + Zod | All forms |
| URL State | Next.js router | Filters, pagination |

### 2.3 Rendering Strategy

| Page | Strategy | Reason |
|------|----------|--------|
| Landing | SSG | Static marketing content |
| Explore Khatmas | ISR (60s) | Frequently updated, SEO needed |
| Khatma Detail (public) | ISR (30s) | SEO + real-time via WS |
| Dashboard | CSR | Personal data, no SEO needed |
| Admin | CSR | Behind auth, no SEO |
| API routes | Server | BFF pattern |

### 2.4 RTL Strategy
```typescript
// app/layout.tsx
<html lang="ar" dir="rtl">
  <body className="font-arabic">
    {children}
  </body>
</html>

// TailwindCSS RTL config
// tailwind.config.ts
plugins: [require('tailwindcss-rtl')]

// CSS logical properties
// ms-4 (margin-start) instead of ml-4/mr-4
// ps-4 (padding-start) instead of pl-4/pr-4
```

---

## 3. Backend Architecture

### 3.1 NestJS Structure

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/          # JWT, Local strategies
│   │   │   ├── guards/              # JwtAuthGuard, RolesGuard
│   │   │   └── dto/
│   │   │
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── khatma/
│   │   │   ├── khatma.module.ts
│   │   │   ├── khatma.controller.ts
│   │   │   ├── khatma.service.ts
│   │   │   ├── reservation.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── groups/
│   │   ├── notifications/
│   │   ├── admin/
│   │   └── websocket/
│   │       ├── khatma.gateway.ts    # Socket.io gateway
│   │       └── events.ts
│   │
│   ├── common/
│   │   ├── filters/                 # Exception filters
│   │   ├── interceptors/            # Logging, transform
│   │   ├── pipes/                   # Validation pipes
│   │   ├── decorators/              # Custom decorators
│   │   └── middleware/              # Rate limit, logger
│   │
│   ├── config/                      # ConfigModule setup
│   ├── database/                    # Prisma service
│   └── redis/                       # Redis service
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── test/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── Dockerfile
```

### 3.2 Service Layer Pattern

```
Controller (HTTP) → Guard → Pipe → Controller Method
                                        ↓
                                   Service Layer
                                        ↓
                              Repository (Prisma)
                                        ↓
                                   PostgreSQL
```

### 3.3 Authentication Flow

```
1. Register/Login
   POST /auth/register → hash password → create user → return JWT + Refresh
   POST /auth/login    → verify password → return JWT (15min) + Refresh (7d)

2. Token Refresh
   POST /auth/refresh
   → Verify refresh token from httpOnly cookie
   → Rotate refresh token (invalidate old, issue new)
   → Return new access JWT

3. Logout
   POST /auth/logout
   → Blacklist refresh token in Redis
   → Clear httpOnly cookie

4. OTP Flow
   POST /auth/send-otp  → generate 6-digit OTP → store in Redis (5min TTL)
   POST /auth/verify-otp → compare → issue JWT
```

### 3.4 WebSocket Architecture

```
Client                    Socket.io Gateway              Redis Pub/Sub
  │                              │                             │
  │─── connect(JWT) ────────────▶│                             │
  │                              │─── join room: khatma:{id} ─▶│
  │                              │                             │
  │── reservePart({partId}) ────▶│                             │
  │                              │─── DB Transaction ──────────│
  │                              │                             │
  │                              │── publish: part_reserved ──▶│
  │                              │                             │
  │◀── part_updated ─────────────│◀── subscribe broadcast ─────│
  │ (all clients in room)        │                             │
```

### 3.5 Caching Strategy

| Data | TTL | Strategy |
|------|-----|----------|
| Khatma detail | 30s | Cache-aside |
| User profile | 5min | Write-through |
| OTP codes | 5min | TTL auto-expire |
| Refresh tokens | 7d | Store in Redis |
| Rate limit counters | 1min | Sliding window |
| Leaderboard/stats | 1min | Cache-aside |

---

## 4. Database Architecture

### 4.1 PostgreSQL Configuration
- **Primary:** Read + Write
- **Read Replica:** SELECT queries (progress, stats)
- **Connection Pooling:** PgBouncer (max 200 connections)
- **Backup:** Daily full + hourly WAL shipping

### 4.2 Redis Configuration
- **Mode:** Redis Cluster (3 shards × 2 replicas)
- **Use Cases:**
  - Session storage
  - OTP codes
  - Rate limiting
  - Real-time Pub/Sub
  - Distributed locks (for reservation)
  - Hot data caching

---

## 5. DevOps Architecture

### 5.1 Docker Compose (Development)

```yaml
services:
  frontend:    # Next.js
  backend:     # NestJS
  postgres:    # PostgreSQL 16
  redis:       # Redis 7 Cluster
  nginx:       # Reverse proxy
```

### 5.2 Production Infrastructure

```
Internet → Cloudflare → Load Balancer (Nginx)
                              ↓
           ┌──────────────────┼──────────────────┐
           ↓                  ↓                  ↓
       Backend-1          Backend-2          Backend-3
       (NestJS)           (NestJS)           (NestJS)
           └──────────────────┼──────────────────┘
                              ↓
              ┌───────────────┼───────────────┐
              ↓               ↓               ↓
           PostgreSQL      Redis           PostgreSQL
            Primary        Cluster          Replica
```

### 5.3 Monitoring Stack

| Tool | Purpose |
|------|---------|
| Prometheus | Metrics collection |
| Grafana | Dashboards & alerting |
| Loki | Log aggregation |
| Sentry | Error tracking (FE + BE) |
| Uptime Robot | Uptime monitoring |
| pg_stat_statements | DB query analysis |

---

## 6. Security Architecture

### 6.1 Defense in Depth

```
Layer 1: Cloudflare (DDoS, WAF, Bot protection)
Layer 2: Nginx (Rate limiting, SSL, Headers)
Layer 3: NestJS Guards (Auth, RBAC)
Layer 4: Service Layer (Business logic validation)
Layer 5: Prisma (Parameterized queries, type safety)
Layer 6: PostgreSQL (Row-level constraints, transactions)
```

### 6.2 Security Headers (Nginx)
```nginx
add_header X-Frame-Options "DENY";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Content-Security-Policy "default-src 'self'...";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
```

---

## 7. Folder Naming Conventions

| Layer | Convention | Example |
|-------|------------|---------|
| Components | PascalCase | `KhatmaCard.tsx` |
| Hooks | camelCase + use prefix | `useKhatma.ts` |
| Services | camelCase | `khatma.service.ts` |
| DTOs | PascalCase + DTO suffix | `CreateKhatmaDto.ts` |
| Constants | SCREAMING_SNAKE | `MAX_PARTS = 30` |
| DB Tables | snake_case plural | `khatma_participants` |
| API Routes | kebab-case | `/api/khatma-parts` |
