# Test Strategy
# ختمة — Khatma Platform

**Version:** 1.0.0  
**Owner:** QA Lead  

---

## 1. Testing Philosophy

> "لا يُعتبر Feature مكتملاً حتى يمر جميع Test Cases الخاصة به."

- كل feature تُكتب Test Cases لها قبل التطوير (TDD حيثما أمكن)
- لا Push بدون اجتياز Unit + Integration Tests
- لا Merge لـ main بدون اجتياز E2E + Regression Tests
- Race conditions تُختبر بشكل خاص

---

## 2. Test Pyramid

```
        ┌─────┐
        │ E2E │  5% — Playwright (critical flows only)
       ┌┴─────┴┐
       │  Int. │ 25% — Supertest (API integration)
      ┌┴───────┴┐
      │  Unit   │ 70% — Jest (services, utils, validators)
      └─────────┘
```

---

## 3. Test Types & Tools

| Type | Tool | Scope | When Run |
|------|------|-------|---------|
| Unit | Jest + ts-jest | Services, utils, validators, guards | Every commit |
| Integration | Jest + Supertest | API endpoints (against real DB) | Every PR |
| E2E | Playwright | Critical user flows in browser | Before merge to main |
| Performance | k6 | Load, stress, spike tests | Before release |
| Security | OWASP ZAP + manual | OWASP Top 10 | Before release |
| Visual Regression | Playwright screenshots | UI consistency | Before release |
| Accessibility | axe-core + Playwright | WCAG 2.1 AA | Before release |
| Concurrent | Custom k6 scripts | Race conditions | Before release |

---

## 4. Test Environment Strategy

| Env | Purpose | DB | Reset |
|-----|---------|----|-------|
| local | Developer testing | Docker Postgres (test DB) | Per test suite |
| CI | Automated tests | Ephemeral Docker DB | Per workflow run |
| staging | E2E, QA manual | Staging DB (seeded) | Weekly reset |
| production | Smoke tests only | Production DB | Never reset |

---

## 5. Coverage Requirements

| Layer | Minimum Coverage |
|-------|-----------------|
| Services (BE) | 85% |
| Controllers (BE) | 80% |
| Guards/Middlewares | 90% |
| Utilities | 95% |
| Frontend Components | 60% |
| Frontend Hooks | 80% |

---

## 6. Test Data Strategy

```typescript
// test/fixtures/
export const testUser = {
  email: 'test@khatma.app',
  password: 'TestPass123!',
  displayName: 'مستخدم اختبار'
};

export const testKhatma = {
  title: 'ختمة اختبار',
  type: 'COLLECTIVE',
  visibility: 'PUBLIC'
};

// Use factory functions for varied data:
export const createTestUser = (overrides = {}) => ({
  ...testUser,
  email: `test-${Date.now()}@khatma.app`,
  ...overrides
});
```

---

## 7. Test Naming Convention

```typescript
describe('ReservationService', () => {
  describe('reservePart', () => {
    it('should reserve an available part successfully', () => {});
    it('should throw ConflictException when part is already reserved', () => {});
    it('should throw ForbiddenException when user is not a participant', () => {});
    it('should prevent double reservation from same user', () => {});
    it('should handle concurrent reservation from two users atomically', () => {});
  });
});
```

---

## 8. CI Test Execution Order

```yaml
# GitHub Actions
steps:
  1. ESLint (2 min)
  2. TypeScript check (1 min)
  3. Unit tests + coverage (5 min)
  4. Integration tests (10 min)  ← requires DB + Redis
  5. Build validation (3 min)
  6. Docker build (5 min)
  # On merge to main only:
  7. E2E tests (15 min)
  8. Security scan (10 min)
  # On release branch only:
  9. Performance tests (30 min)
  10. Full regression suite (20 min)
```

---

## 9. Bug Classification

| Severity | Definition | SLA to Fix |
|----------|-----------|-----------|
| P0 Critical | App unusable, data loss, security breach | Fix before any deploy |
| P1 High | Core feature broken, workaround exists | Fix within 24h |
| P2 Medium | Feature degraded, workaround easy | Fix within 1 week |
| P3 Low | Cosmetic, minor UX | Fix in next sprint |

---

## 10. Regression Policy

Before any production deploy:
1. Run full regression suite automatically via CI
2. QA manually tests the 10 most critical flows
3. Zero P0 and P1 bugs open
4. Performance benchmarks within 10% of baseline
5. Sign-off from QA Lead

---

## 11. Special Test Requirements

### Concurrent Reservation Test
```typescript
// This is a P0 test — must always pass before deploy
it('should handle 50 concurrent reservation attempts on same part', async () => {
  // Setup: 50 users all try to reserve Part 1 simultaneously
  const promises = Array.from({ length: 50 }, (_, i) =>
    request.post(`/khatmas/${khatmaId}/parts/${partId}/reserve`)
      .set('Authorization', `Bearer ${tokens[i]}`)
  );
  
  const results = await Promise.allSettled(promises);
  const successes = results.filter(r => r.status === 'fulfilled' && r.value.status === 200);
  const failures = results.filter(r => r.status === 'fulfilled' && r.value.status === 409);
  
  expect(successes.length).toBe(1);  // Exactly one success
  expect(failures.length).toBe(49); // All others fail cleanly
  
  // Verify DB integrity
  const reservations = await prisma.reservedPart.count({ where: { partId } });
  expect(reservations).toBe(1);  // Only one record
});
```
