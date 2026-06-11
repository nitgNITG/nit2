# MVP Scope
# ختمة — Khatma Platform

**Target Launch:** 8 weeks from kickoff  
**Philosophy:** أقل features قابلة للإطلاق + أعلى قيمة للمستخدم  

---

## MVP: الإطلاق الأولي (Weeks 1–8)

### ✅ In MVP

#### Auth
- [x] تسجيل بالبريد الإلكتروني + كلمة مرور
- [x] تسجيل الدخول
- [x] OTP عبر رقم الهاتف (اختياري عند التسجيل)
- [x] JWT + Refresh Token
- [x] إعادة تعيين كلمة المرور

#### Khatma Core
- [x] إنشاء ختمة جماعية
- [x] الأجزاء الثلاثون تُنشأ تلقائياً
- [x] حجز جزء (Real-time)
- [x] تسجيل إتمام الجزء
- [x] عرض تقدم الختمة (شبكة الأجزاء)
- [x] PUBLIC / PRIVATE visibility
- [x] مشاركة بالرابط
- [x] الانضمام بالرابط
- [x] طلب الانضمام + الموافقة
- [x] Allow/Deny Repeat Parts
- [x] تحديث فوري (WebSocket)

#### User
- [x] ملف شخصي أساسي (اسم، صورة)
- [x] لوحة "ختماتي"
- [x] إشعارات داخل التطبيق

#### Groups (Basic)
- [x] إنشاء مجموعة
- [x] دعوة الأعضاء
- [x] ختمة حصرية للمجموعة

### ❌ NOT in MVP (Phase 2+)

| Feature | Phase |
|---------|-------|
| تسجيل دخول Google | Phase 2 |
| Continuous Khatma | Phase 2 |
| Auto Redistribution | Phase 2 |
| إحصائيات متقدمة للمستخدم | Phase 2 |
| Push Notifications (Mobile) | Phase 2 |
| Individual Khatma | Phase 2 |
| Max Members enforcement | Phase 2 |
| Start/End Dates | Phase 2 |
| Admin Panel | Phase 2 |
| SEO / Explore page | Phase 2 |
| WhatsApp Integration | Phase 3 |
| AI Assistant | Phase 3 |
| Mobile Apps | Phase 3 |
| Gamification | Phase 3 |
| Tafsir Integration | Phase 3 |
| Charity Integration | Phase 3 |

---

## Phase 2: التحسين (Weeks 9–16)

- Individual Khatma (ختمة فردية)
- Continuous Khatma
- Auto Redistribution
- Start/End Dates + Reminders
- Admin Dashboard
- Advanced user statistics
- Email notifications
- SEO: Explore public khatmas
- Google OAuth
- Performance optimizations
- Mobile PWA improvements

---

## Phase 3: النمو والذكاء (Weeks 17+)

- AI Quran Reading Assistant
- Gamification (badges, streaks, leaderboards)
- Mobile Apps (React Native)
- WhatsApp Integration
- Voice Tracking
- Tafsir Integration
- Ramadan Campaigns
- Corporate Khatmas
- School Khatmas
- Charity Integration
- Advanced Analytics Dashboard
- Multi-language support (EN, FR, TR)
- Family Tree Khatmas
- Smart Recommendations

---

## MVP Technical Non-Negotiables

Even in MVP, the following cannot be compromised:

| Area | Minimum Standard |
|------|-----------------|
| Security | JWT, rate limiting, SQL injection prevention |
| Concurrency | Redis lock + DB unique constraint on reservations |
| Performance | API p95 < 500ms, WebSocket < 200ms |
| Reliability | PM2 cluster, restart on crash, health checks |
| RTL | كامل بدون استثناء |
| Mobile | يعمل على 375px+ |
| Error handling | كل خطأ يُعرض للمستخدم بوضوح |

---

## MVP Success Definition

الإطلاق يعتبر ناجحاً إذا:
- [ ] 100 مستخدم يكملون ختمة كاملة في الأسبوع الأول
- [ ] معدل نجاح حجز الأجزاء > 99% (بدون تعارضات)
- [ ] وقت الاستجابة < 500ms (p95)
- [ ] 0 bugs critical في أول 48 ساعة
- [ ] NPS > 30 من أول 50 مستخدم
