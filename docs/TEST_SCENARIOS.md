# Test Scenarios
# ختمة — Khatma Platform

**Version:** 1.0.0  

---

## Scenario 1: Happy Path — ختمة جماعية كاملة

**Title:** Complete end-to-end collective khatma flow  
**Type:** E2E  
**Priority:** P0  
**Estimated Time:** 45 min  

```
1. أحمد يسجل حساباً جديداً
2. أحمد ينشئ ختمة "ختمة رمضان" (PUBLIC، allowRepeat=false)
3. أحمد يحجز الجزء 1
4. أحمد يشارك رابط الختمة
5. فاطمة (مستخدمة جديدة) تفتح الرابط وتسجل حساباً
6. فاطمة تنضم للختمة
7. فاطمة ترى الجزء 1 محجوزاً لأحمد في الوقت الفعلي
8. فاطمة تحجز الجزء 2
9. أحمد يتلقى إشعاراً بأن فاطمة حجزت الجزء 2
10. أحمد يتمم الجزء 1
11. الجزء 1 يتحول لـCOMPLETED
12. تكرر 3-11 لـ28 جزءاً إضافياً (أو seed في DB)
13. الجزء 30 يُتمَّم
14. الختمة تُكتمل تلقائياً
15. جميع المشاركين يتلقون "تم ختم القرآن الكريم!"

Expected: كل خطوة تعمل بلا أخطاء، وقت الاستجابة < 500ms
```

---

## Scenario 2: Race Condition — 30 مستخدم لجزء واحد

**Title:** Mass concurrent reservation attempt  
**Type:** Concurrent / Performance  
**Priority:** P0  
**Estimated Time:** 20 min  

```
1. إنشاء ختمة مع 30 مشاركاً نشطاً
2. جميعهم يرون الجزء 1 متاحاً
3. 30 طلب reserve يُرسَل في نفس الوقت (Promise.all)

Expected:
- 1 نجاح فقط
- 29 خطأ 409
- DB: reservedPart سجل واحد فقط
- quran_part.status = RESERVED
- لا deadlocks، لا DB errors
- وقت الاستجابة < 500ms لجميع الطلبات
```

---

## Scenario 3: مسار الختمة الخاصة مع الموافقة

**Title:** Private khatma with join approval flow  
**Type:** Functional / E2E  
**Priority:** P0  

```
1. منشئ ينشئ ختمة PRIVATE مع requireApproval=true
2. مستخدم B يحاول الانضمام بدون رابط → 403
3. المنشئ ينشئ رابط دعوة
4. مستخدم B يفتح الرابط ويطلب الانضمام
5. حالة B = PENDING
6. B لا يستطيع حجز أي جزء (PENDING)
7. المنشئ يرى طلب B ويوافق
8. حالة B = ACTIVE
9. B يحجز جزءاً بنجاح

Negative:
10. مستخدم C يطلب الانضمام
11. المنشئ يرفض
12. C يتلقى إشعار الرفض
13. C لا يستطيع الوصول للختمة
```

---

## Scenario 4: الختمة المستمرة

**Title:** Continuous khatma auto-restart  
**Type:** Functional  
**Priority:** P1  

```
1. إنشاء ختمة مع isContinuous=true
2. إتمام جميع الـ30 جزء
3. النظام يُعيد الختمة تلقائياً (iteration = 2)
4. جميع الأجزاء تعود AVAILABLE
5. المشاركون يتلقون إشعار بدء الدورة الجديدة
6. المشاركون يحجزون أجزاء جديدة

Expected:
- khatma.iteration = 2
- 30 quran_parts جديدة بحالة AVAILABLE
- تاريخ الدورة السابقة محفوظ في AuditLog
```

---

## Scenario 5: مسار انتهاء مدة الحجز

**Title:** Reservation deadline and auto-release  
**Type:** Functional  
**Priority:** P1  

```
1. إنشاء ختمة بتاريخ نهاية قريب
2. مستخدم يحجز جزءاً
3. انتهاء deadline بدون إتمام
4. Cron Job يُشغَّل

Expected:
- reservation.status = RELEASED
- quran_part.status = AVAILABLE
- إشعار للمستخدم: "تم تحرير الجزء X"
- إشعار للمنشئ
- الجزء قابل للحجز من شخص آخر
```

---

## Scenario 6: مسار المجموعة المغلقة

**Title:** Closed group khatma access control  
**Type:** Security / Functional  
**Priority:** P1  

```
1. إنشاء مجموعة PRIVATE
2. إنشاء ختمة GROUP_ONLY داخل المجموعة
3. مستخدم خارج المجموعة يحاول الوصول للختمة

Expected:
- الختمة لا تظهر في Explore
- الوصول المباشر بالرابط: 403
- الانضمام للمجموعة ثم الوصول: ✅
```

---

## Scenario 7: إدارة الأعضاء في الختمة

**Title:** Admin manages khatma participants  
**Type:** Functional  
**Priority:** P1  

```
1. منشئ الختمة يرفع عضواً لـADMIN
2. العضو الجديد يوافق على طلبات الانضمام
3. المنشئ يُزيل عضواً مسيئاً
4. العضو المُزال يحاول الوصول للختمة

Expected:
- العضو المُزال لا يستطيع حجز أجزاء
- جزؤه المحجوز يُحرَّر تلقائياً
```

---

## Scenario 8: تسجيل الدخول من أجهزة متعددة

**Title:** Multi-device session management  
**Type:** Security  
**Priority:** P1  

```
1. مستخدم يسجل الدخول من الهاتف
2. نفس المستخدم يسجل الدخول من اللابتوب
3. كلا الجهازين يعملان بشكل مستقل
4. المستخدم يسجل خروج من اللابتوب
5. التحقق: الهاتف لا يزال يعمل
6. المستخدم يسجل خروج من جميع الأجهزة
7. التحقق: اللابتوب والهاتف كلاهما يُرجعان 401
```

---

## Scenario 9: أداء اللحظة الحرجة (Ramp Up)

**Title:** Ramp-up load test — simulating Ramadan peak  
**Type:** Performance  
**Priority:** P0  

```
Using k6:

Stage 1: 0 → 100 users (2 min ramp-up)
Stage 2: 100 users × 5 min (sustained)
Stage 3: 100 → 500 users (3 min spike)
Stage 4: 500 users × 5 min (peak sustained)
Stage 5: 500 → 0 (2 min ramp-down)

Monitored:
- API p95 latency
- WebSocket message delivery time
- DB connection pool utilization
- Redis memory
- Error rate

Expected:
- p95 < 500ms throughout
- Error rate < 0.5%
- No DB connection exhaustion
- Redis hit rate > 85%
```

---

## Scenario 10: استرداد من فشل الـRedis

**Title:** Redis failure graceful degradation  
**Type:** Reliability  
**Priority:** P1  

```
1. إيقاف Redis (docker stop redis)
2. محاولة حجز جزء
3. محاولة تسجيل الدخول
4. إعادة تشغيل Redis

Expected:
- حجز الجزء: يعمل عبر DB-level locking فقط (أبطأ لكن آمن)
- تسجيل الدخول: يعمل (بدون refresh token caching)
- بعد إعادة تشغيل Redis: استئناف طبيعي
- لا data corruption
```

---

## Scenario 11: Abuse Prevention — Spam Joins

**Title:** User tries to spam join multiple khatmas  
**Type:** Security  
**Priority:** P1  

```
1. مستخدم يحاول الانضمام لـ15 ختمة في دقيقة واحدة
Expected: يتوقف عند الـ11 بـStatus 429

2. مستخدم ينشئ حسابات متعددة من نفس IP
Expected: تُحظر الطلبات بعد 5 تسجيلات من نفس IP/ساعة
```

---

## Scenario 12: SEO & Accessibility

**Title:** SEO metadata and accessibility verification  
**Type:** Non-functional  
**Priority:** P1  
**Estimated Time:** 30 min  

```
1. فتح صفحة ختمة عامة كـSearch Engine crawler (بدون JS)
Expected:
- title موجود ومناسب
- description موجود
- og:image و og:title موجودان
- البيانات الأساسية قابلة للفهرسة

2. اختبار Accessibility:
- جميع الصور لها alt text
- تباين اللون > 4.5:1
- Tab navigation يعمل
- Screen reader يقرأ المحتوى بترتيب منطقي
```
