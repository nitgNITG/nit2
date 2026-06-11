# Risks & Edge Cases
# ختمة — Khatma Platform

**Version:** 1.0.0  

---

## 1. Technical Risks

### RISK-001: Race Condition في حجز الأجزاء
- **Probability:** High (without mitigation)
- **Impact:** Critical — مستخدمان يحجزان نفس الجزء
- **Mitigation:** Redis Distributed Lock + DB Unique Constraint
- **Residual Risk:** Low — محدودة جداً بعد التطبيق
- **Test:** TC-RESERVE-004

---

### RISK-002: WebSocket Scalability
- **Probability:** Medium
- **Impact:** High — التحديثات الفورية تتوقف مع نمو المستخدمين
- **Mitigation:** Redis Pub/Sub Adapter لـSocket.io
- **Trigger:** > 3 backend instances
- **Test:** TC-RT-002

---

### RISK-003: Database Connection Exhaustion
- **Probability:** Medium under high load
- **Impact:** High — الـAPI يتوقف
- **Mitigation:** PgBouncer (connection pooling)، max connections configured
- **Monitor:** pg_stat_activity query في Grafana
- **Alert:** > 80% connection pool utilization

---

### RISK-004: Redis Failure
- **Probability:** Low
- **Impact:** High — Rate limiting / sessions fail
- **Mitigation:** Redis Sentinel (failover) in production
- **Fallback:** Graceful degradation — تعمل الأساسيات بدون Redis
- **RTO:** < 5 minutes for Redis Sentinel failover

---

### RISK-005: Memory Leak في WebSocket
- **Probability:** Medium (common in Socket.io)
- **Impact:** Medium — Server needs restart after days
- **Mitigation:** Proper cleanup on disconnect، periodic monitoring
- **Monitor:** PM2 memory threshold alerts

---

## 2. Business Risks

### RISK-006: Abuse — Spam Khatmas
- **Scenario:** مستخدم ينشئ مئات الختمات الوهمية
- **Impact:** DB pollution، bad UX في Explore
- **Mitigation:**
  - Rate limit: 20 khatmas/user/day
  - IP-based rate limit for registration
  - Admin moderation tools

---

### RISK-007: Impersonation / Fake Accounts
- **Scenario:** أحد يتظاهر بأنه شخص معروف
- **Impact:** Trust damage
- **Mitigation:**
  - Email/Phone verification required
  - Report user feature (Phase 2)

---

### RISK-008: Ramadan Traffic Spike
- **Scenario:** ضغط هائل في أول رمضان (10× normal load)
- **Impact:** Downtime في أحرج الأوقات
- **Mitigation:**
  - Load test before Ramadan
  - Pre-scale infrastructure
  - Auto-scaling configured
  - CDN caching for static assets

---

## 3. Edge Cases

### EC-001: مستخدم يحاول حجز جزء في ختمة مكتملة
```
IF khatma.status === 'COMPLETED'
THEN throw KhatmaCompletedException('الختمة مكتملة')
RETURN 422
```

---

### EC-002: مستخدم يغادر الختمة والجزء المحجوز لديه
```
ON leave_khatma:
  1. جلب participant.reservedParts (status=RESERVED)
  2. لكل جزء:
     - reservation.status = 'RELEASED'
     - quranPart.status = 'AVAILABLE'
  3. حذف KhatmaParticipant
  4. إرسال إشعار للمنشئ بتحرير الأجزاء
```

---

### EC-003: حذف المنشئ لحسابه وعنده ختمة نشطة
```
ON user deletion (soft delete):
  1. إيجاد الختمات التي المستخدم منشئها
  2. إذا كانت لا تزال ACTIVE:
     - إذا كان هناك ADMIN في الختمة: نقل الملكية
     - إذا لم يكن: الختمة تنتقل لـ"ختمة مجهولة" (orphaned)
  3. تسجيل في AuditLog
```

---

### EC-004: ختمة بدأت ولم يكتمل فيها أي جزء لفترة طويلة
```
IF khatma.endDate < NOW AND completedParts === 0:
  - لا يتم الحذف التلقائي (قرار تجاري)
  - يُرسَل إشعار تذكير للمنشئ
  - يُعرَّض كـ"غير نشطة" في الـExplore
```

---

### EC-005: allowRepeat = true وكل الأجزاء محجوزة
```
IF allowRepeat = true:
  مستخدم يحجز جزءاً مرة ثانية متاح لكن:
  - لا يمكن حجز جزء محجوز من شخص آخر حالياً
  - فقط الأجزاء AVAILABLE يمكن حجزها
  - إذا كان لدى المستخدم جزء RESERVED: لا يمكنه حجز آخر
  - إذا أتم جزءه: يمكنه حجز جزء جديد
```

---

### EC-006: مستخدمان يرسلان طلب رفض/قبول في نفس الوقت
```
Admin A و Admin B يوافقان على نفس طلب الانضمام في نفس الوقت:
→ DB Unique Constraint على (khatmaId, userId) يمنع التكرار
→ الثاني يتلقى خطأ "المستخدم عضو بالفعل" — يُعالَج بلطف
```

---

### EC-007: رابط الدعوة منتهٍ أو مُلغى
```
IF invitation.status !== 'PENDING' OR invitation.expiresAt < NOW:
  RETURN 410 (Gone)
  MESSAGE: "الرابط منتهٍ أو غير صالح"
  SUGGESTION: اطلب رابطاً جديداً من منشئ الختمة
```

---

### EC-008: الختمة الفردية يحاول شخص ثانٍ الانضمام
```
IF khatma.type === 'INDIVIDUAL' AND joining_user !== creator:
  RETURN 403
  MESSAGE: "هذه ختمة فردية"
```

---

### EC-009: إتمام جزء غير محجوز من المستخدم
```
IF reservation.userId !== currentUser.id:
  RETURN 403
  MESSAGE: "لا يمكنك تسجيل إتمام جزء لم تحجزه"
```

---

### EC-010: مستخدم بلا إنترنت يحاول الحجز (Offline)
```
FE: اكتشاف offline → تعطيل زر الحجز
Banner: "أنت غير متصل — لا يمكن الحجز"
WS: محاولة reconnect كل 3 ثوانٍ
```

---

### EC-011: ختمة مستمرة تُكتمل وجميع الأعضاء غير نشطين
```
IF isContinuous = true AND khatma.completedAt IS SET:
  Reset logic runs regardless of online status
  All parts back to AVAILABLE
  Notifications queued for offline users
```

---

### EC-012: حجز الأجزاء الأخيرة تحديداً (الجزء 29 و 30)
```
No special logic needed, but:
Edge case in autoRedistribute:
  IF parts 29 and 30 are reserved but not completed near deadline:
  Send extra urgent reminder (2× frequency)
```

---

## 4. Data Integrity Scenarios

### DI-001: Khatma completedParts count drift
```
Problem: completedParts counter could drift from actual DB count
Solution: Never use stored counter — always compute from DB:
  SELECT COUNT(*) FROM quran_parts WHERE khatmaId=X AND status='COMPLETED'
Trade-off: Slightly more DB load, perfect accuracy
```

---

### DI-002: Orphaned QuranParts after khatma deletion
```
Solution: Prisma cascade delete on Khatma model:
  parts QuranPart[] onDelete: Cascade
  participants KhatmaParticipant[] onDelete: Cascade
Soft delete: khatma.deletedAt IS SET, records preserved for audit
```

---

## 5. Security Edge Cases

### SE-001: JWT الصادر لمستخدم معلَّق لاحقاً
```
Problem: User has valid JWT but account was suspended after login
Solution:
  1. Check user.status on every request (via Guard)
  2. Cache user status in Redis (TTL: 1 min)
  3. If SUSPENDED: return 403 immediately, even with valid JWT
```

---

### SE-002: Timing Attack على OTP verification
```
Wrong approach: if (otp === storedOtp) → timing difference reveals info
Correct approach: 
  const isValid = timingSafeEqual(Buffer.from(otp), Buffer.from(storedOtp))
```
