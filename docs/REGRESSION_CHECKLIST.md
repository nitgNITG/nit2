# Regression Checklist
# ختمة — Khatma Platform

**Run before every production deployment**  
**Owner:** QA Lead  
**Estimated Total Time:** 90 min  

---

## Instructions

1. يُنفَّذ هذا الـChecklist قبل كل Deploy لـProduction
2. كل بند يجب أن يكون ✅ قبل المتابعة
3. إذا فشل أي بند P0: **يتوقف Deploy فوراً**
4. إذا فشل أي بند P1: يُقيَّم بالتشاور مع Tech Lead

---

## Section 1: Automated Checks (CI/CD Must Pass)

- [ ] ESLint: 0 errors
- [ ] TypeScript: 0 type errors
- [ ] Unit Tests: 100% pass rate
- [ ] Integration Tests: 100% pass rate
- [ ] Build: successful (no errors)
- [ ] Docker Build: successful
- [ ] E2E Tests: all P0 scenarios pass

---

## Section 2: Authentication (Manual — 15 min)

- [ ] **REG-001** تسجيل مستخدم جديد بإيميل يعمل
- [ ] **REG-002** تسجيل الدخول يعمل
- [ ] **REG-003** رابط نسيت كلمة المرور يُرسَل ويعمل
- [ ] **REG-004** الجلسة تبقى بعد إغلاق التبويب وإعادة الفتح
- [ ] **REG-005** تسجيل الخروج يُنهي الجلسة فوراً
- [ ] **REG-006** محاولة الوصول بـtoken منتهٍ تُرجع 401

---

## Section 3: Khatma Core (Manual — 20 min)

- [ ] **REG-010** إنشاء ختمة جديدة ينشئ 30 جزءاً
- [ ] **REG-011** الانضمام لختمة عامة يعمل فوراً
- [ ] **REG-012** الانضمام لختمة خاصة يتطلب موافقة
- [ ] **REG-013** مشاركة الرابط: الرابط يفتح الختمة الصحيحة
- [ ] **REG-014** شبكة الأجزاء تُعرض صحيحة (30 جزء)
- [ ] **REG-015** ألوان الحالات صحيحة (أخضر=متاح، أصفر=محجوز، رمادي=مكتمل)

---

## Section 4: Part Reservation (Manual — 20 min) — CRITICAL

- [ ] **REG-020** حجز جزء متاح يعمل (< 3 ثوانٍ)
- [ ] **REG-021** الجزء المحجوز يتغير لونه فوراً
- [ ] **REG-022** التحديث الفوري يظهر على نافذة ثانية (WebSocket)
- [ ] **REG-023** محاولة حجز جزء محجوز تُرجع رسالة واضحة
- [ ] **REG-024** تسجيل إتمام الجزء يعمل
- [ ] **REG-025** لا يمكن حجز جزئين (allowRepeat=false)
- [ ] **REG-026** مغادرة الختمة تُحرر الجزء المحجوز

---

## Section 5: Real-time (Manual — 10 min)

- [ ] **REG-030** فتح نافذتين لنفس الختمة — الحجز يظهر في كلاهما
- [ ] **REG-031** الإتمام يظهر في الوقت الفعلي
- [ ] **REG-032** اكتمال الختمة يظهر إشعاراً لجميع المشاركين
- [ ] **REG-033** قطع الإنترنت وإعادته: WebSocket يتصل تلقائياً

---

## Section 6: Groups (Manual — 10 min)

- [ ] **REG-040** إنشاء مجموعة يعمل
- [ ] **REG-041** رابط الدعوة للمجموعة يعمل
- [ ] **REG-042** ختمة المجموعة لا تظهر لغير الأعضاء

---

## Section 7: UI/UX (Manual — 15 min)

- [ ] **REG-050** RTL صحيح في جميع الصفحات الرئيسية
- [ ] **REG-051** الموقع يعمل على هاتف (375px)
- [ ] **REG-052** لا overflow أفقي على أي شاشة
- [ ] **REG-053** Loading states تظهر عند الانتظار
- [ ] **REG-054** رسائل الخطأ تظهر بوضوح
- [ ] **REG-055** حالات الفراغ (Empty States) تظهر بشكل مناسب

---

## Section 8: Performance (Automated — 5 min)

- [ ] **REG-060** صفحة الختمة تُحمَّل < 3 ثوانٍ (LCP)
- [ ] **REG-061** API response time p95 < 500ms (k6 quick test — 20 VUs × 1 min)
- [ ] **REG-062** لا memory leaks بعد 10 دقائق تحت load

---

## Section 9: Security (Quick checks — 5 min)

- [ ] **REG-070** API بدون token تُرجع 401 ✗
- [ ] **REG-071** HTTPS مُفعَّل، HTTP يُعاد توجيهه
- [ ] **REG-072** Security headers موجودة (X-Frame-Options, CSP)
- [ ] **REG-073** لا sensitive data في response headers

---

## Regression Sign-off

| Check | Tester | Time | Status |
|-------|--------|------|--------|
| Automated CI | CI/CD | Auto | ☐ |
| Auth section | QA | 15 min | ☐ |
| Khatma section | QA | 20 min | ☐ |
| Reservation section | QA | 20 min | ☐ |
| Real-time section | QA | 10 min | ☐ |
| UI/UX section | QA | 15 min | ☐ |
| Performance | DevOps | 5 min | ☐ |
| Security | QA | 5 min | ☐ |

**QA Lead Sign-off:** _____________ **Date:** _______  
**Tech Lead Sign-off:** _____________ **Date:** _______  

> ✅ Approved for Production Deploy  
> ❌ Deploy Blocked — Issues Found  
