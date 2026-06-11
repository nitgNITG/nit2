# Final Release Checklist
# ختمة — Khatma Platform — v1.0.0

**Date:** _____________  
**Release Manager:** _____________  
**Environment:** Production  

---

## PRE-RELEASE CHECKLIST

### ✅ Section 1: Code Quality

- [ ] All features from MVP_SCOPE.md are implemented
- [ ] Zero open P0 and P1 bugs in issue tracker
- [ ] Code review completed for all PRs
- [ ] No TODO/FIXME/HACK comments in production code
- [ ] TypeScript errors: 0
- [ ] ESLint errors: 0
- [ ] Dead code removed
- [ ] `console.log` statements removed (only structured logger)
- [ ] Sensitive data removed from code (no hardcoded keys)

---

### ✅ Section 2: Testing

- [ ] Unit test coverage ≥ 80%
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass (especially P0 scenarios)
- [ ] Race condition tests pass (TC-RESERVE-004)
- [ ] Security tests pass (TC-SEC-001 through TC-SEC-004)
- [ ] Performance tests: p95 < 500ms at 500 concurrent users
- [ ] Mobile responsive: tested on iOS Safari + Android Chrome
- [ ] RTL tested on all main screens
- [ ] Regression checklist fully signed off

---

### ✅ Section 3: Security

- [ ] All API endpoints require auth (unless explicitly public)
- [ ] Rate limiting configured and tested
- [ ] HTTPS enforced (HTTP → HTTPS redirect)
- [ ] Security headers present (X-Frame-Options, CSP, HSTS, etc.)
- [ ] CORS configured (whitelist only)
- [ ] JWT keys are environment variables (not committed)
- [ ] Passwords are bcrypt hashed (cost 12)
- [ ] OTP expires in 5 minutes
- [ ] `npm audit` shows 0 critical/high vulnerabilities
- [ ] OWASP ZAP scan completed — no critical findings
- [ ] Admin panel accessible to ADMIN role only
- [ ] No sensitive data in logs (passwords, tokens, PII)

---

### ✅ Section 4: Database

- [ ] All migrations applied to production DB
- [ ] `prisma migrate status` shows all migrations applied
- [ ] DB indexes created (run `\d+ table_name` to verify)
- [ ] DB connections via PgBouncer pooler
- [ ] Read replica connected and routing configured
- [ ] Automated backup running (daily full + hourly WAL)
- [ ] Backup restore tested (verify recovery works)
- [ ] DB credentials rotated from dev/staging values
- [ ] `prisma validate` passes

---

### ✅ Section 5: Infrastructure

- [ ] Production server specs: minimum 4 CPU, 8GB RAM
- [ ] Docker containers running and healthy
- [ ] PM2 cluster mode: 4 workers
- [ ] Redis running with persistence (AOF)
- [ ] Nginx configured (SSL, gzip, rate limits, security headers)
- [ ] Cloudflare DNS + proxy enabled
- [ ] SSL certificate valid (Let's Encrypt auto-renew configured)
- [ ] Health check endpoint: `GET /api/health` returns 200
- [ ] Auto-restart configured (PM2 on crash)
- [ ] Log rotation configured
- [ ] Disk space: ≥ 50GB available on DB server

---

### ✅ Section 6: Monitoring & Alerting

- [ ] Prometheus scraping metrics
- [ ] Grafana dashboards configured:
  - [ ] API latency dashboard
  - [ ] Error rate dashboard
  - [ ] DB connection pool dashboard
  - [ ] WebSocket connections dashboard
- [ ] Sentry configured for both FE and BE
- [ ] Uptime monitor (Uptime Robot or similar) pinging `/api/health` every 1 min
- [ ] Alerts configured:
  - [ ] API error rate > 1% → PagerDuty/Slack
  - [ ] DB connections > 80% → Slack
  - [ ] Server down → PagerDuty (immediate)
  - [ ] High memory (> 90%) → Slack
- [ ] On-call rotation set up

---

### ✅ Section 7: SEO & Analytics

- [ ] `sitemap.xml` accessible at `/sitemap.xml`
- [ ] `robots.txt` configured
- [ ] Structured data valid (Google Rich Results test)
- [ ] Open Graph images working (test with Facebook Debugger)
- [ ] Google Search Console property verified
- [ ] Google Analytics / Plausible configured
- [ ] Core Web Vitals in green (PageSpeed Insights)

---

### ✅ Section 8: Content & UX

- [ ] All Arabic text reviewed by native speaker
- [ ] No placeholder text (Lorem ipsum, etc.)
- [ ] All error messages are in Arabic and helpful
- [ ] All empty states have clear CTAs
- [ ] Favicon, Apple touch icons, PWA manifest set
- [ ] 404 and 500 error pages styled and in Arabic
- [ ] Terms of Service and Privacy Policy pages exist
- [ ] Contact/support method accessible
- [ ] Loading states on all async operations

---

### ✅ Section 9: Performance

- [ ] LCP < 2.5s (mobile, 3G connection)
- [ ] FID/INP < 100ms
- [ ] CLS < 0.1
- [ ] Frontend bundle < 500KB gzipped
- [ ] Images served from CDN with correct Content-Type
- [ ] API responses include appropriate Cache-Control headers
- [ ] Redis caching working (verify with cache hit logs)

---

### ✅ Section 10: Launch Readiness

- [ ] Staging deploy completed successfully
- [ ] QA team signed off on staging
- [ ] Rollback plan documented and tested
- [ ] Team available for first 48 hours post-launch
- [ ] Support channel (Slack/Telegram) created for launch day
- [ ] Social media announcement prepared
- [ ] Beta testers notified of launch

---

## LAUNCH DAY PROCEDURE

```
T-60 min: Final staging smoke test
T-30 min: Notify team "Launch in 30 minutes"
T-0:      
  1. git push main → CI/CD triggers deploy
  2. Monitor GitHub Actions logs
  3. After deploy: run production smoke tests
  4. Monitor Grafana for 30 minutes
  5. Check Sentry for new errors
  6. Post launch announcement
T+1h:     First health report to team
T+24h:    Full launch review
```

---

## ROLLBACK TRIGGERS

Roll back immediately if:
- [ ] Error rate > 5% for 5 minutes
- [ ] API response time p95 > 3 seconds for 5 minutes  
- [ ] Any P0 security vulnerability discovered
- [ ] DB data corruption detected
- [ ] Critical feature completely broken (reservation not working)

---

## POST-LAUNCH (Day 1-7)

- [ ] T+1h: Error rate check
- [ ] T+24h: Performance review
- [ ] T+48h: User feedback review
- [ ] T+7d: Week 1 metrics review
  - New users registered
  - Khatmas created
  - Parts reserved successfully
  - Error rate average
  - P95 latency average

---

## Sign-offs Required

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Tech Lead | | | |
| QA Lead | | | |
| DevOps | | | |
| Product Manager | | | |

> **ALL SIGN-OFFS REQUIRED BEFORE DEPLOY TO PRODUCTION**
