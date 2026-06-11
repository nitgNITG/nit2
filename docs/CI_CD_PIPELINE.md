# CI/CD Pipeline
# ختمة — Khatma Platform

**Version:** 1.0.0  

---

## 1. Git Branching Strategy

```
main          ← Production (protected, no direct push)
  ↑
staging       ← Staging environment (auto-deploy)
  ↑
develop       ← Integration branch
  ↑
feature/*     ← Feature branches
hotfix/*      ← Emergency fixes (branches from main)
release/*     ← Release candidates
```

**Branch Rules:**
- `main`: Requires 2 approvals + all CI checks
- `staging`: Requires 1 approval + CI checks
- `develop`: Requires 1 approval + lint + unit tests
- No force pushes on protected branches

---

## 2. Workflow Overview

```
Developer
    │
    ├── git push feature/reserve-part
    │       ↓
    │   CI: lint + typecheck + unit tests (3 min)
    │       ↓ passes
    │   Open Pull Request to develop
    │       ↓
    │   CI: full test suite (15 min)
    │       ↓ passes + Code Review
    │   Merge to develop
    │       ↓
    │   Auto-deploy to Staging
    │       ↓
    │   QA validation on staging
    │       ↓
    │   Merge develop → staging → main
    │       ↓
    │   Auto-deploy to Production
    │       ↓
    │   Smoke tests on production
```

---

## 3. GitHub Actions Workflows

### 3.1 `ci.yml` — Runs on every push/PR

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [develop, staging, main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  unit-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          fail_ci_if_error: true
          minimum_coverage: 80

  integration-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: unit-tests
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: khatma_test
          POSTGRES_USER: khatma
          POSTGRES_PASSWORD: testpass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://khatma:testpass@localhost:5432/khatma_test
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://khatma:testpass@localhost:5432/khatma_test
          REDIS_URL: redis://localhost:6379

  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - run: docker build -t khatma-backend ./backend
      - run: docker build -t khatma-frontend ./frontend
```

---

### 3.2 `e2e.yml` — Runs on PR to main/staging

```yaml
name: E2E Tests

on:
  pull_request:
    branches: [staging, main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: docker-compose -f docker-compose.test.yml up -d
      - run: npm run e2e
        env:
          BASE_URL: http://localhost:3000
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

### 3.3 `deploy-staging.yml` — Auto-deploy on develop merge

```yaml
name: Deploy Staging

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker images
        run: |
          docker build -t $REGISTRY/khatma-backend:${{ github.sha }} ./backend
          docker build -t $REGISTRY/khatma-frontend:${{ github.sha }} ./frontend
          docker push $REGISTRY/khatma-backend:${{ github.sha }}
          docker push $REGISTRY/khatma-frontend:${{ github.sha }}
      - name: Deploy to staging server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: deploy
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /app/khatma
            export IMAGE_TAG=${{ github.sha }}
            docker-compose pull
            docker-compose up -d --no-deps backend frontend
            docker-compose exec backend npx prisma migrate deploy
      - name: Smoke test staging
        run: |
          sleep 30
          curl -f https://staging.khatma.app/api/health || exit 1
```

---

### 3.4 `deploy-production.yml` — Manual trigger on main

```yaml
name: Deploy Production

on:
  push:
    branches: [main]
  workflow_dispatch:     # Manual trigger with confirmation

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production    # Requires manual approval in GitHub Environments
    steps:
      - uses: actions/checkout@v4
      - name: Run full regression
        run: npm run test:regression
      - name: Deploy to production
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: deploy
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /app/khatma
            export IMAGE_TAG=${{ github.sha }}
            # Blue-green deploy
            docker-compose -f docker-compose.prod.yml up -d --scale backend=4
            docker-compose exec backend npx prisma migrate deploy
      - name: Smoke test production
        run: |
          sleep 60
          curl -f https://khatma.app/api/health || exit 1
      - name: Notify Slack on success
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -d '{"text": "✅ Production deploy successful: '${{ github.sha }}'"}' 
```

---

## 4. Environment Variables per Environment

| Variable | dev | staging | production |
|----------|-----|---------|------------|
| NODE_ENV | development | staging | production |
| DATABASE_URL | localhost | staging-db | prod-db (RDS) |
| REDIS_URL | localhost | staging-redis | prod-redis (cluster) |
| JWT_PRIVATE_KEY | dev-key | staging-key | prod-key (rotated) |
| SENTRY_DSN | - | staging-dsn | prod-dsn |
| LOG_LEVEL | debug | info | warn |

---

## 5. Rollback Strategy

```bash
# Fast rollback: revert to previous image
ssh deploy@prod-server
cd /app/khatma
export IMAGE_TAG=<previous-sha>
docker-compose up -d --no-deps backend frontend
# Verify:
curl https://khatma.app/api/health

# If DB migration needs reverting:
docker-compose exec backend npx prisma migrate resolve --rolled-back <migration-name>
```

**RTO (Recovery Time Objective):** < 10 minutes for rollback  
**Rollback Decision:** If > 1% error rate for > 5 minutes after deploy  

---

## 6. Quality Gates

No deploy proceeds unless:

| Gate | Metric | Threshold |
|------|--------|-----------|
| Unit Tests | Pass rate | 100% |
| Integration Tests | Pass rate | 100% |
| Coverage | Lines covered | ≥ 80% |
| Build | Exit code | 0 |
| E2E (main only) | P0 scenarios | 100% pass |
| Security scan | npm audit | 0 critical/high |
| Bundle size | Frontend bundle | < 500KB gzipped |
| Docker image | Build success | Required |
