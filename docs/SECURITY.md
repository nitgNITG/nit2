# Security Plan
# ختمة — Khatma Platform

**Version:** 1.0.0  
**Owner:** Security Engineer  

---

## 1. Threat Model

### 1.1 Attack Surface
| Surface | Risk | Mitigation |
|---------|------|-----------|
| Auth endpoints | Brute force, credential stuffing | Rate limiting, lockout, OTP |
| Part reservation | Race condition, double reservation | Redis lock + DB constraint |
| WebSocket | Connection flooding, message injection | Auth required, rate limiting |
| File uploads | Malicious files, path traversal | Cloudinary + type validation |
| Admin panel | Privilege escalation | RBAC + audit logging |
| Public khatma links | Scraping, spam joins | Rate limiting, CAPTCHA |

### 1.2 OWASP Top 10 Coverage
| Risk | Status | Implementation |
|------|--------|---------------|
| A01: Broken Access Control | Mitigated | RBAC Guards, ownership checks |
| A02: Cryptographic Failures | Mitigated | bcrypt (12 rounds), HTTPS, secure cookies |
| A03: Injection | Mitigated | Prisma ORM (parameterized), Zod validation |
| A04: Insecure Design | Mitigated | Threat modeling, security reviews |
| A05: Security Misconfiguration | Mitigated | Helmet.js, CSP, security headers |
| A06: Vulnerable Components | Monitored | Dependabot, `npm audit` in CI |
| A07: Auth Failures | Mitigated | JWT rotation, session management |
| A08: SSRF | Mitigated | No external URL fetching from user input |
| A09: Logging Failures | Mitigated | Structured audit logs, Sentry |
| A10: SSRF/XXE | N/A | No XML processing |

---

## 2. Authentication Security

### 2.1 Password Policy
```
Minimum length: 8 characters
Must contain: 1 uppercase, 1 number, 1 special character
Hashing: bcrypt with cost factor 12
Never stored in plaintext
Never logged
Never returned in API responses
```

### 2.2 JWT Configuration
```typescript
// Access Token
{
  algorithm: 'RS256',        // Asymmetric signing
  expiresIn: '15m',          // Short-lived
  issuer: 'khatma.app',
  audience: 'khatma-users'
}

// Refresh Token
{
  algorithm: 'RS256',
  expiresIn: '7d',
  stored: 'httpOnly SameSite=Strict cookie'
  // Also stored in Redis for revocation
}
```

### 2.3 Refresh Token Rotation
```
1. Client sends refresh token via cookie
2. Server verifies token is in Redis (not revoked)
3. Server deletes OLD token from Redis (revoke)
4. Server issues NEW access + refresh tokens
5. New refresh token stored in Redis
→ If old token reuse detected: revoke ALL user sessions
```

### 2.4 OTP Security
```
- 6-digit numeric OTP
- TTL: 5 minutes in Redis
- Max attempts: 3 per OTP (then force new OTP)
- Rate limit: 3 OTPs per phone per 10 minutes
- OTP is invalidated after successful use
- Constant-time comparison (prevent timing attacks)
```

---

## 3. Authorization (RBAC)

### 3.1 Global Roles
| Role | Permissions |
|------|------------|
| USER | Standard user operations |
| MODERATOR | View reports, suspend users |
| ADMIN | Full admin panel, user management |
| SUPER_ADMIN | System configuration, other admin management |

### 3.2 Khatma-Level Roles
| Role | Permissions |
|------|------------|
| OWNER | Full control, delete khatma, manage all members |
| ADMIN | Manage members, approve joins, reassign parts |
| MEMBER | Reserve/complete parts, leave |

### 3.3 Implementation
```typescript
// NestJS Guard
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Get('/admin/stats')
getAdminStats() { ... }

// Ownership check in service
async reservePart(userId: string, khatmaId: string, partId: string) {
  const participant = await this.prisma.khatmaParticipant.findUnique({
    where: { khatmaId_userId: { khatmaId, userId } }
  });
  if (!participant || participant.status !== 'ACTIVE') {
    throw new ForbiddenException();
  }
}
```

---

## 4. Input Validation & Sanitization

### 4.1 Zod Schemas (shared FE + BE)
```typescript
export const CreateKhatmaSchema = z.object({
  title: z.string().min(3).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  type: z.enum(['INDIVIDUAL', 'COLLECTIVE']),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'GROUP_ONLY']),
  maxMembers: z.number().int().min(1).max(1000).optional(),
  // ... strict schema, no extra keys allowed
}).strict();
```

### 4.2 HTML Sanitization
```typescript
import DOMPurify from 'isomorphic-dompurify';

// Any user-generated content displayed as HTML
const safeDescription = DOMPurify.sanitize(description);
```

### 4.3 File Upload Validation
```
- Allow JPEG, PNG, WebP only
- Max size: 2MB
- Upload via Cloudinary (server-side API, not direct)
- Strip EXIF metadata
- Scan with Cloudinary's moderation API
```

---

## 5. Network Security

### 5.1 Nginx Security Configuration
```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=ws:10m rate=5r/s;

# Security headers
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

# CSP
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'nonce-{NONCE}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://res.cloudinary.com;
  connect-src 'self' wss://api.khatma.app;
  font-src 'self';
  frame-ancestors 'none';
" always;
```

### 5.2 CORS Configuration
```typescript
// NestJS CORS
app.enableCors({
  origin: ['https://khatma.app', 'https://www.khatma.app'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Authorization', 'Content-Type']
});
```

---

## 6. Database Security

### 6.1 Connection Security
```
- TLS enforced for all DB connections
- Separate DB users per service (principle of least privilege)
  - khatma_app: SELECT, INSERT, UPDATE, DELETE on app tables
  - khatma_readonly: SELECT only (for analytics/reports)
  - khatma_admin: Full access (admin panel only)
- Credentials via environment variables only
- Connection pooling via PgBouncer
```

### 6.2 SQL Injection Prevention
```
- Prisma ORM: all queries are parameterized
- No raw SQL in application code (except monitored migrations)
- If raw SQL needed: Prisma.$queryRaw with Prisma.sql template tag
```

---

## 7. Abuse Prevention

### 7.1 Rate Limiting Strategy
```typescript
// Sliding window rate limiter (Redis)
async checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  const pipeline = this.redis.pipeline();
  pipeline.zremrangebyscore(key, '-inf', windowStart);
  pipeline.zadd(key, now, `${now}-${Math.random()}`);
  pipeline.zcard(key);
  pipeline.expire(key, Math.ceil(windowMs / 1000));
  
  const results = await pipeline.exec();
  const count = results[2][1] as number;
  
  return { allowed: count <= limit, count, limit };
}
```

### 7.2 Suspicious Activity Detection
```
Rules flagged for review:
- 50+ failed login attempts from same IP in 1 hour
- 100+ OTP requests from same phone in 24 hours
- 10+ account registrations from same IP in 1 hour
- User joins 20+ khatmas in 1 hour
- User sends 100+ invitations in 1 day
```

### 7.3 Bot Protection
- Google reCAPTCHA v3 on: Register, Login, Join Khatma
- Honeypot fields in forms
- User-Agent validation for API endpoints

---

## 8. Secrets Management

```
Environment Variables Only:
- DATABASE_URL
- REDIS_URL
- JWT_PRIVATE_KEY
- JWT_PUBLIC_KEY
- CLOUDINARY_SECRET
- OTP_SERVICE_KEY

Rules:
- Never commit secrets to git
- .env files in .gitignore
- Use Doppler / Vault in production
- Rotate keys quarterly
- Different secrets per environment (dev/staging/prod)
```

---

## 9. Audit Logging

All sensitive operations are logged to `audit_logs`:

| Action | Logged Data |
|--------|------------|
| Login success/fail | userId, IP, userAgent |
| Register | userId, IP |
| Reserve part | userId, khatmaId, partId |
| Join khatma | userId, khatmaId |
| Khatma created/deleted | userId, khatmaId, settings |
| User suspended | adminId, targetUserId, reason |
| Admin actions | adminId, action, affected entity |

---

## 10. Security Testing Requirements

Before each release:
- [ ] OWASP ZAP automated scan
- [ ] `npm audit` — 0 critical/high
- [ ] Auth bypass attempts on protected routes
- [ ] SQL injection attempts (automated)
- [ ] XSS payload testing
- [ ] Rate limiting verification
- [ ] CORS misconfig check
- [ ] Sensitive data in logs check
