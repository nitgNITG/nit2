# Execution Plan
# ختمة — Khatma Platform

**Total Estimated Duration:** 8 Weeks MVP  
**Team Size:** 5 people (Backend Dev, Frontend Dev, QA, DevOps, UI/UX)  
**Note:** All estimates are in minutes/hours of actual work time  

---

## Milestones Overview

| Milestone | Deliverable | End of Week |
|-----------|-------------|-------------|
| M1: Foundation | DB schema, Auth APIs, DevOps setup | Week 1 |
| M2: Core Backend | Khatma CRUD + Reservation APIs | Week 2 |
| M3: Real-time | WebSocket + Redis integration | Week 3 |
| M4: Frontend Core | Auth + Dashboard + Khatma views | Week 4 |
| M5: Real-time FE | Live part reservation UI | Week 5 |
| M6: Groups | Group management FE + BE | Week 6 |
| M7: Polish | QA, performance, SEO | Week 7 |
| M8: Launch | Staging → Production deployment | Week 8 |

---

## WEEK 1: Foundation (M1)

### Sprint Goal: Infrastructure + Auth working end-to-end

---

### EPIC: DevOps Setup
**Owner:** DevOps Engineer | **Total:** 480 min (8h)

#### TASK-001: Docker Environment Setup
- **Owner:** DevOps
- **Priority:** P0 (Blocking)
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Write `docker-compose.yml` (Postgres, Redis, Backend, Frontend, Nginx) | 60 min |
  | Configure Nginx reverse proxy config | 45 min |
  | Write `.env.example` + secrets management docs | 30 min |
  | Test full local boot: `docker-compose up` → all healthy | 30 min |
  | Write Makefile with shortcuts (dev, test, build, clean) | 20 min |
- **Total:** 185 min (~3.1h)
- **Definition of Done:** `docker-compose up` brings up all 5 services, health checks pass

#### TASK-002: CI/CD Pipeline (GitHub Actions)
- **Owner:** DevOps
- **Priority:** P0
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Write lint + typecheck workflow | 30 min |
  | Write test workflow (unit + integration) | 45 min |
  | Write build validation workflow | 30 min |
  | Write Docker build + push to registry | 45 min |
  | Write deploy-to-staging workflow | 60 min |
  | Test all pipelines end-to-end | 45 min |
- **Total:** 255 min (~4.3h)
- **Definition of Done:** Push to any branch triggers CI; merge to develop triggers staging deploy

---

### EPIC: Database Setup
**Owner:** Backend Dev | **Total:** 360 min (6h)

#### TASK-003: Prisma Schema Implementation
- **Owner:** Backend Dev
- **Priority:** P0 (Blocking all BE work)
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Write full Prisma schema (all 12 models) | 90 min |
  | Review schema with tech lead | 30 min |
  | Create initial migration | 20 min |
  | Write seed script (admin user, test data) | 45 min |
  | Test migration on clean DB | 20 min |
  | Add DB indexes (see DATABASE_DESIGN.md) | 30 min |
  | Write Prisma service (NestJS module) | 25 min |
- **Total:** 260 min (~4.3h)
- **Definition of Done:** `prisma migrate dev` runs clean, seed creates test data, all models queryable

#### TASK-004: Redis Service Setup
- **Owner:** Backend Dev
- **Priority:** P0
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | NestJS Redis module setup (`ioredis`) | 30 min |
  | Redis service with typed methods | 45 min |
  | Test Redis connection + basic operations | 15 min |
  | Implement rate limiter service | 30 min |
- **Total:** 120 min (2h)

---

### EPIC: Authentication Backend
**Owner:** Backend Dev | **Total:** 720 min (12h)

#### TASK-005: Auth Module
- **Owner:** Backend Dev
- **Priority:** P0
- **Dependencies:** TASK-003 (DB), TASK-004 (Redis)
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | NestJS AuthModule scaffold | 20 min |
  | JWT RS256 keypair generation + config | 20 min |
  | Register endpoint (email/password) + Zod validation | 60 min |
  | Login endpoint + bcrypt compare | 45 min |
  | JWT access token generation (15min) | 30 min |
  | Refresh token generation + Redis storage | 60 min |
  | httpOnly cookie setup for refresh token | 30 min |
  | Token refresh endpoint + rotation logic | 60 min |
  | Logout endpoint + token revocation | 30 min |
  | JWT Guard + Passport strategy | 45 min |
  | OTP generation + Redis TTL storage | 45 min |
  | OTP verification endpoint | 30 min |
  | Password reset flow (OTP-based) | 60 min |
  | Rate limiting on all auth routes | 30 min |
  | Unit tests for auth service | 60 min |
  | Integration tests for all auth routes | 60 min |
- **Total:** 686 min (~11.4h)
- **Definition of Done:** All auth endpoints pass integration tests; rate limiting verified; token rotation tested

---

### EPIC: Project Setup
**Owner:** Frontend Dev | **Total:** 240 min (4h)

#### TASK-006: Next.js 14 Project Setup
- **Owner:** Frontend Dev
- **Priority:** P0
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Next.js 14 + TypeScript + TailwindCSS init | 20 min |
  | Arabic RTL config (html dir, fonts) | 30 min |
  | TailwindCSS RTL plugin + custom config | 20 min |
  | Folder structure setup (see SYSTEM_ARCHITECTURE.md) | 15 min |
  | Zustand store setup (auth, notifications) | 30 min |
  | React Query + Axios instance setup | 30 min |
  | Next.js middleware (auth redirect) | 30 min |
  | Environment variables setup | 15 min |
  | shadcn/ui init + base components | 30 min |
- **Total:** 220 min (~3.7h)

---

**WEEK 1 TOTAL:** ~2,326 min (~38.8h actual work)  
**Critical Path:** TASK-003 → TASK-005 (DB must be done before Auth)  

---

## WEEK 2: Core Backend (M2)

### Sprint Goal: All Khatma CRUD + Reservation APIs working

---

#### TASK-007: Khatma Module Backend
- **Owner:** Backend Dev
- **Priority:** P0
- **Dependencies:** TASK-005 (Auth)
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Create Khatma endpoint + auto-create 30 QuranParts | 60 min |
  | Get Khatma detail with parts + participants | 45 min |
  | List Khatmas (paginated, filtered) | 45 min |
  | Update Khatma settings | 30 min |
  | Delete Khatma (soft delete) | 20 min |
  | Join Khatma (direct + approval flow) | 60 min |
  | Leave Khatma (release reservation if any) | 30 min |
  | Approve/Reject join request | 30 min |
  | Invitation system (generate token, validate) | 60 min |
  | Share link generation | 20 min |
  | Unit tests | 60 min |
  | Integration tests | 90 min |
- **Total:** 550 min (~9.2h)

#### TASK-008: Reservation Service
- **Owner:** Backend Dev
- **Priority:** P0 (Core feature)
- **Dependencies:** TASK-007
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Redis distributed lock implementation | 45 min |
  | Reserve part endpoint with lock + DB transaction | 60 min |
  | Complete part endpoint + khatma completion check | 45 min |
  | Release part logic (manual + auto) | 30 min |
  | Continuous khatma restart logic | 45 min |
  | Anti-double-booking middleware | 30 min |
  | Race condition unit tests (concurrent requests) | 90 min |
  | Integration tests | 60 min |
- **Total:** 405 min (~6.75h)

#### TASK-009: User Profile APIs
- **Owner:** Backend Dev
- **Priority:** P1
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Get user profile (with stats) | 30 min |
  | Update profile (name, avatar) | 30 min |
  | Upload avatar (Cloudinary integration) | 45 min |
  | Get user's khatmas | 20 min |
  | User stats calculation | 30 min |
- **Total:** 155 min (~2.6h)

---

## WEEK 3: Real-time (M3)

#### TASK-010: WebSocket Gateway
- **Owner:** Backend Dev
- **Priority:** P0
- **Dependencies:** TASK-008
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | NestJS Socket.io Gateway setup | 45 min |
  | JWT authentication for WebSocket connections | 45 min |
  | Join/leave khatma room events | 30 min |
  | Redis Pub/Sub adapter (multi-instance) | 60 min |
  | Broadcast part_reserved event | 30 min |
  | Broadcast part_completed event | 20 min |
  | Broadcast khatma_completed event | 20 min |
  | Online presence tracking (Redis) | 30 min |
  | WebSocket error handling | 30 min |
  | Load test: 200 concurrent WS connections | 45 min |
- **Total:** 355 min (~5.9h)

#### TASK-011: Notification Service
- **Owner:** Backend Dev
- **Priority:** P1
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Notification model + CRUD | 30 min |
  | Create notification on key events | 45 min |
  | Get notifications API (paginated) | 20 min |
  | Mark as read / mark all read | 20 min |
  | Unread count | 10 min |
- **Total:** 125 min (~2.1h)

---

## WEEK 4: Frontend Core (M4)

#### TASK-012: Auth UI
- **Owner:** Frontend Dev
- **Priority:** P0
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Login page (form, validation, error states) | 90 min |
  | Register page | 90 min |
  | OTP input component | 45 min |
  | Forgot password flow | 60 min |
  | Auth store (Zustand) + persistence | 30 min |
  | Protected route middleware | 20 min |
  | Auto refresh token on 401 | 30 min |
- **Total:** 365 min (~6.1h)

#### TASK-013: Khatma List + Detail UI
- **Owner:** Frontend Dev + UI/UX
- **Priority:** P0
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Dashboard layout (Navbar, Sidebar) | 60 min |
  | My Khatmas list view | 45 min |
  | Create Khatma form (all settings) | 90 min |
  | Khatma detail page layout | 45 min |
  | Quran Parts Grid component (30 parts) | 90 min |
  | Part status colors (available/reserved/completed) | 30 min |
  | Participant list component | 30 min |
  | Progress bar / percentage display | 30 min |
  | Loading states + skeleton screens | 45 min |
  | Empty states | 20 min |
  | Error states | 20 min |
- **Total:** 505 min (~8.4h)

---

## WEEK 5: Real-time Frontend (M5)

#### TASK-014: WebSocket Integration (Frontend)
- **Owner:** Frontend Dev
- **Priority:** P0
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Socket.io-client setup + auth | 30 min |
  | `useRealtime` custom hook | 45 min |
  | Connect to khatma room on page load | 20 min |
  | Handle `part_reserved` event → update UI | 45 min |
  | Handle `part_completed` event | 30 min |
  | Handle `khatma_completed` event → celebration UI | 45 min |
  | Optimistic UI update on reserve | 45 min |
  | Rollback on reservation failure | 30 min |
  | Connection status indicator | 20 min |
  | Reconnection logic | 20 min |
- **Total:** 330 min (~5.5h)

#### TASK-015: Reserve Part Interaction
- **Owner:** Frontend Dev
- **Priority:** P0
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Reserve part button + confirmation modal | 45 min |
  | Complete part button | 30 min |
  | Tooltip showing who reserved each part | 30 min |
  | Prevent reserve if user has active reservation | 20 min |
  | Animation on part state change | 30 min |
- **Total:** 155 min (~2.6h)

---

## WEEK 6: Groups (M6)

#### TASK-016: Groups Backend
- **Owner:** Backend Dev
- **Priority:** P1
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Group CRUD APIs | 90 min |
  | Group member management | 60 min |
  | Group invite system | 45 min |
  | Group khatma filtering | 30 min |
  | Tests | 60 min |
- **Total:** 285 min (~4.75h)

#### TASK-017: Groups Frontend
- **Owner:** Frontend Dev
- **Priority:** P1
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Groups list page | 45 min |
  | Create group form | 45 min |
  | Group detail + members list | 60 min |
  | Invite member flow | 45 min |
  | Group khatmas view | 30 min |
- **Total:** 225 min (~3.75h)

---

## WEEK 7: QA & Polish (M7)

#### TASK-018: QA Execution
- **Owner:** QA Lead
- **Priority:** P0
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Execute all P0 test cases | 180 min |
  | Race condition tests (concurrent reservation) | 60 min |
  | Mobile responsive testing (5 devices) | 90 min |
  | RTL testing | 45 min |
  | Security test (auth bypass, injection) | 90 min |
  | Performance: k6 load test | 60 min |
  | Bug fixes from QA findings | 120 min |
  | Regression tests after fixes | 60 min |
- **Total:** 705 min (~11.75h)

#### TASK-019: SEO & Performance
- **Owner:** Frontend Dev
- **Priority:** P1
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Next.js metadata API (title, description, OG) | 45 min |
  | ISR for khatma detail pages | 30 min |
  | Sitemap generation | 30 min |
  | Image optimization (next/image) | 30 min |
  | Font optimization | 20 min |
  | Core Web Vitals check + fixes | 60 min |
- **Total:** 215 min (~3.6h)

---

## WEEK 8: Launch (M8)

#### TASK-020: Production Deployment
- **Owner:** DevOps
- **Priority:** P0
- **Subtasks:**
  | Subtask | Minutes |
  |---------|---------|
  | Production server setup (VPS/Cloud) | 60 min |
  | Domain + SSL certificate | 30 min |
  | Cloudflare configuration | 30 min |
  | Production DB setup + migration | 30 min |
  | Redis production config | 20 min |
  | Deploy backend + frontend | 45 min |
  | Smoke tests on production | 30 min |
  | Monitoring setup (Prometheus + Grafana) | 60 min |
  | Sentry error tracking | 30 min |
  | Backup automation setup | 30 min |
- **Total:** 365 min (~6.1h)

---

## Total Time Summary by Role

| Role | Week 1 | Week 2 | Week 3 | Week 4 | Week 5 | Week 6 | Week 7 | Week 8 | Total Hours |
|------|--------|--------|--------|--------|--------|--------|--------|--------|-------------|
| Backend Dev | 22h | 18.5h | 8h | - | - | 4.75h | 2h | 1h | **56.25h** |
| Frontend Dev | 3.7h | - | - | 14.5h | 8.1h | 3.75h | 3.6h | 1h | **34.65h** |
| DevOps | 12.4h | - | - | - | - | - | 1h | 6.1h | **19.5h** |
| QA Lead | 2h | 2h | 2h | 3h | 3h | 3h | 11.75h | 2h | **28.75h** |
| UI/UX | 4h | 2h | - | 6h | 2h | 2h | 2h | - | **18h** |
| **Total** | **44.1h** | **22.5h** | **10h** | **23.5h** | **13.1h** | **13.5h** | **19.35h** | **10.1h** | **~157h** |

---

## Critical Path

```
TASK-003 (DB Schema)
    ↓
TASK-004 (Redis) + TASK-005 (Auth)
    ↓
TASK-007 (Khatma Module)
    ↓
TASK-008 (Reservation Service)  ←── CRITICAL
    ↓
TASK-010 (WebSocket)
    ↓
TASK-014 (WS Frontend)
    ↓
TASK-015 (Reserve Part UI)
    ↓
TASK-018 (QA)
    ↓
TASK-020 (Deploy)
```

**Bottleneck:** TASK-008 — the reservation service with distributed locking is the most complex single task. If it's delayed, everything downstream shifts.

---

## Parallel Execution Opportunities

| Week | Parallel Tracks |
|------|----------------|
| Week 1 | BE: DB+Auth in parallel with FE: Project setup |
| Week 2 | BE: Khatma APIs + DevOps: CI/CD pipeline |
| Week 3 | BE: WebSocket + FE: Auth UI |
| Week 4 | FE: Khatma UI + BE: Notifications |
| Week 5 | FE: Real-time + QA: Writing test cases |
| Week 6 | BE: Groups + FE: Groups UI (sequential within track) |
| Week 7 | QA: Testing + FE: SEO + DevOps: Prod setup |
| Week 8 | Deploy + monitoring setup in parallel |
