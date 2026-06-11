# Test Cases
# ختمة — Khatma Platform

**Version:** 1.0.0  
**Owner:** QA Lead  

---

## Module: Authentication

### TC-AUTH-001
- **ID:** TC-AUTH-001
- **Module:** Authentication
- **Title:** تسجيل مستخدم جديد بإيميل وكلمة مرور
- **Type:** Functional / Integration
- **Priority:** P0
- **Estimated Execution:** 5 min
- **Preconditions:** قاعدة البيانات نظيفة، الإيميل غير مستخدم
- **Steps:**
  1. POST /auth/register مع بيانات صحيحة
  2. التحقق من الـStatus Code
  3. التحقق من الـResponse body
  4. التحقق من DB (user موجود، password مُشفَّر)
- **Expected Result:** Status 201، user موجود في DB، password مُشفَّر بـbcrypt، JWT access token في response، refresh token في httpOnly cookie
- **Test Type:** Functional

---

### TC-AUTH-002
- **ID:** TC-AUTH-002
- **Module:** Authentication
- **Title:** رفض تسجيل مستخدم بإيميل مكرر
- **Type:** Functional
- **Priority:** P0
- **Steps:**
  1. تسجيل مستخدم بإيميل X
  2. محاولة تسجيل مستخدم ثانٍ بنفس الإيميل
- **Expected Result:** Status 409، message "البريد الإلكتروني مستخدم"، لا يُنشأ حساب ثانٍ

---

### TC-AUTH-003
- **ID:** TC-AUTH-003
- **Module:** Authentication
- **Title:** تسجيل الدخول بإيميل وكلمة مرور صحيحة
- **Type:** Functional
- **Priority:** P0
- **Steps:** POST /auth/login ببيانات صحيحة
- **Expected Result:** Status 200، access token، refresh token cookie

---

### TC-AUTH-004
- **ID:** TC-AUTH-004
- **Module:** Authentication
- **Title:** رفض الدخول بكلمة مرور خاطئة
- **Type:** Functional / Security
- **Priority:** P0
- **Steps:** POST /auth/login بكلمة مرور خاطئة
- **Expected Result:** Status 401، message عامة (لا تكشف عن وجود الحساب)

---

### TC-AUTH-005
- **ID:** TC-AUTH-005
- **Module:** Authentication
- **Title:** Rate limiting على تسجيل الدخول
- **Type:** Security
- **Priority:** P0
- **Steps:**
  1. إرسال 11 طلب تسجيل دخول فاشل في أقل من 15 دقيقة
- **Expected Result:** الطلب الـ11 يُرجع Status 429 مع Retry-After header

---

### TC-AUTH-006
- **ID:** TC-AUTH-006
- **Module:** Authentication
- **Title:** تجديد الـAccess Token
- **Type:** Functional
- **Priority:** P0
- **Steps:**
  1. تسجيل الدخول للحصول على tokens
  2. انتظار انتهاء صلاحية access token (أو تجاوزها)
  3. POST /auth/refresh مع الـcookie
- **Expected Result:** Status 200، access token جديد، refresh token جديد في cookie

---

### TC-AUTH-007
- **ID:** TC-AUTH-007
- **Module:** Authentication
- **Title:** منع إعادة استخدام Refresh Token القديم
- **Type:** Security
- **Priority:** P0
- **Steps:**
  1. تسجيل الدخول
  2. طلب refresh → token جديد
  3. إعادة استخدام الـtoken القديم
- **Expected Result:** Status 401، يُلغى token الجديد أيضاً (Security: token reuse detection)

---

### TC-AUTH-008
- **ID:** TC-AUTH-008
- **Module:** Authentication
- **Title:** تسجيل الخروج وإلغاء الجلسة
- **Type:** Functional
- **Priority:** P0
- **Steps:**
  1. تسجيل الدخول
  2. POST /auth/logout
  3. محاولة استخدام access token القديم
- **Expected Result:** بعد logout: Status 401 على أي طلب بالـtoken القديم

---

## Module: Khatma Management

### TC-KHATMA-001
- **ID:** TC-KHATMA-001
- **Module:** Khatma Management
- **Title:** إنشاء ختمة جماعية
- **Type:** Functional
- **Priority:** P0
- **Estimated Execution:** 5 min
- **Preconditions:** مستخدم مسجل ومؤكد
- **Steps:**
  1. POST /khatmas بإعدادات صحيحة
- **Expected Result:** Status 201، khatma موجودة في DB، 30 QuranParts تُنشأ تلقائياً بحالة AVAILABLE، shareCode فريد

---

### TC-KHATMA-002
- **ID:** TC-KHATMA-002
- **Module:** Khatma Management
- **Title:** الانضمام لختمة عامة مباشرة
- **Type:** Functional
- **Priority:** P0
- **Steps:**
  1. إنشاء ختمة PUBLIC بدون requireApproval
  2. مستخدم ثانٍ: POST /khatmas/:id/join
- **Expected Result:** Status 200، participant status ACTIVE

---

### TC-KHATMA-003
- **ID:** TC-KHATMA-003
- **Module:** Khatma Management
- **Title:** الانضمام لختمة تتطلب موافقة
- **Type:** Functional
- **Priority:** P0
- **Steps:**
  1. إنشاء ختمة مع requireApproval = true
  2. مستخدم ثانٍ يطلب الانضمام
- **Expected Result:** Status 202، participant status PENDING، إشعار للمنشئ

---

### TC-KHATMA-004
- **ID:** TC-KHATMA-004
- **Module:** Khatma Management
- **Title:** منع الانضمام مرتين
- **Type:** Functional
- **Priority:** P0
- **Steps:**
  1. مستخدم ينضم لختمة
  2. نفس المستخدم يحاول الانضمام مرة ثانية
- **Expected Result:** Status 409، message "أنت عضو بالفعل"

---

## Module: Part Reservation

### TC-RESERVE-001
- **ID:** TC-RESERVE-001
- **Module:** Part Reservation
- **Title:** حجز جزء متاح بنجاح
- **Type:** Functional / E2E
- **Priority:** P0
- **Estimated Execution:** 5 min
- **Preconditions:** مستخدم عضو نشط في الختمة
- **Steps:**
  1. GET /khatmas/:id → التحقق من وجود أجزاء AVAILABLE
  2. POST /khatmas/:id/parts/:partId/reserve
- **Expected Result:** Status 200، part status RESERVED في DB، reservation موجودة، WebSocket event يُرسَل

---

### TC-RESERVE-002
- **ID:** TC-RESERVE-002
- **Module:** Part Reservation
- **Title:** منع حجز جزء محجوز
- **Type:** Functional
- **Priority:** P0
- **Steps:**
  1. مستخدم A يحجز الجزء 1
  2. مستخدم B يحاول حجز الجزء 1
- **Expected Result:** Status 409، message "الجزء محجوز"، DB يحتوي reservation واحدة فقط

---

### TC-RESERVE-003
- **ID:** TC-RESERVE-003
- **Module:** Part Reservation
- **Title:** منع حجز جزء ثانٍ (allowRepeat = false)
- **Type:** Functional
- **Priority:** P0
- **Steps:**
  1. مستخدم يحجز الجزء 1
  2. نفس المستخدم يحاول حجز الجزء 2 (allowRepeat = false)
- **Expected Result:** Status 409، message "لديك جزء محجوز بالفعل"

---

### TC-RESERVE-004
- **ID:** TC-RESERVE-004
- **Module:** Part Reservation
- **Title:** Race Condition — مستخدمان يحجزان نفس الجزء في نفس الوقت
- **Type:** Concurrent / Integration
- **Priority:** P0 (Critical)
- **Estimated Execution:** 10 min
- **Steps:**
  1. إنشاء ختمة مع 2 مستخدمين نشطين
  2. إرسال طلبَي حجز للجزء 1 في نفس الوقت (Promise.all)
  3. الفحص: status responses
  4. فحص DB: عدد reservations للجزء 1
- **Expected Result:**
  - Response واحد بـStatus 200
  - Response ثانٍ بـStatus 409
  - DB: reserved_parts تحتوي سجلاً واحداً للجزء 1
  - quran_parts: الجزء 1 حالته RESERVED

---

### TC-RESERVE-005
- **ID:** TC-RESERVE-005
- **Module:** Part Reservation
- **Title:** إتمام جزء محجوز
- **Type:** Functional
- **Priority:** P0
- **Steps:**
  1. مستخدم يحجز الجزء 5
  2. POST /khatmas/:id/parts/:partId/complete
- **Expected Result:** Status 200، reservation status COMPLETED، QuranPart status COMPLETED، إشعار لجميع المشاركين

---

### TC-RESERVE-006
- **ID:** TC-RESERVE-006
- **Module:** Part Reservation
- **Title:** اكتمال الختمة عند إتمام الجزء 30
- **Type:** Functional / Integration
- **Priority:** P0
- **Estimated Execution:** 15 min
- **Steps:**
  1. إنشاء ختمة
  2. إتمام 29 جزءاً يدوياً (DB seed)
  3. إتمام الجزء 30 عبر API
- **Expected Result:** khatma.status = COMPLETED، notification لجميع المشاركين، WebSocket event khatma_completed

---

### TC-RESERVE-007
- **ID:** TC-RESERVE-007
- **Module:** Part Reservation
- **Title:** منع حجز جزء من مستخدم غير عضو
- **Type:** Security / Functional
- **Priority:** P0
- **Steps:**
  1. إنشاء ختمة
  2. مستخدم غير عضو يرسل طلب حجز
- **Expected Result:** Status 403

---

## Module: Real-time Updates

### TC-RT-001
- **ID:** TC-RT-001
- **Module:** Real-time
- **Title:** استلام حدث part_reserved عبر WebSocket
- **Type:** Integration
- **Priority:** P0
- **Steps:**
  1. مستخدم A و B متصلان بنفس غرفة الختمة
  2. مستخدم A يحجز جزءاً
- **Expected Result:** مستخدم B يتلقى حدث part_reserved خلال < 500ms بيانات صحيحة

---

### TC-RT-002
- **ID:** TC-RT-002
- **Module:** Real-time
- **Title:** التحديث الفوري عبر WebSocket لـ50 مستخدم متزامن
- **Type:** Performance
- **Priority:** P1
- **Steps:**
  1. 50 مستخدم متصلون بنفس الختمة
  2. مستخدم واحد يحجز جزءاً
- **Expected Result:** جميع الـ49 الآخرين يتلقون الحدث خلال < 1000ms

---

## Module: Groups

### TC-GROUP-001
- **ID:** TC-GROUP-001
- **Module:** Groups
- **Title:** إنشاء مجموعة وإضافة عضو
- **Type:** Functional
- **Priority:** P1
- **Steps:**
  1. إنشاء مجموعة
  2. إنشاء رابط دعوة
  3. مستخدم ثانٍ ينضم بالرابط
- **Expected Result:** GroupMember موجود، role = MEMBER

---

## Module: Security

### TC-SEC-001
- **ID:** TC-SEC-001
- **Module:** Security
- **Title:** حماية كل نقطة API تتطلب تسجيل الدخول
- **Type:** Security
- **Priority:** P0
- **Steps:**
  1. محاولة الوصول لـ GET /khatmas بدون token
- **Expected Result:** Status 401

---

### TC-SEC-002
- **ID:** TC-SEC-002
- **Module:** Security
- **Title:** RBAC — مستخدم عادي لا يصل للـAdmin APIs
- **Type:** Security
- **Priority:** P0
- **Steps:**
  1. تسجيل الدخول كـUSER
  2. GET /admin/stats
- **Expected Result:** Status 403

---

### TC-SEC-003
- **ID:** TC-SEC-003
- **Module:** Security
- **Title:** SQL Injection في حقل البحث
- **Type:** Security
- **Priority:** P0
- **Steps:**
  1. GET /khatmas?q='; DROP TABLE khatmas;--
- **Expected Result:** Status 200 مع نتائج فارغة أو Status 422، لا يحدث أي تغيير في DB

---

### TC-SEC-004
- **ID:** TC-SEC-004
- **Module:** Security
- **Title:** XSS في حقل العنوان
- **Type:** Security
- **Priority:** P0
- **Steps:**
  1. إنشاء ختمة بعنوان يحتوي `<script>alert('XSS')</script>`
- **Expected Result:** النص يُعرض كنص (escaped)، لا يُنفَّذ كـscript

---

## Module: UI/UX

### TC-UI-001
- **ID:** TC-UI-001
- **Module:** UI/UX — RTL
- **Title:** التحقق من RTL الكامل
- **Type:** Visual / Functional
- **Priority:** P0
- **Steps:**
  1. فتح التطبيق
  2. فحص الـdir و text-align في جميع الصفحات
- **Expected Result:** dir="rtl"، النصوص يمين، القوائم يمين، الأزرار في الأماكن الصحيحة

---

### TC-UI-002
- **ID:** TC-UI-002
- **Module:** UI/UX — Mobile
- **Title:** التجاوب على شاشة 375px
- **Type:** Visual / Functional
- **Priority:** P0
- **Steps:**
  1. فتح التطبيق على تحديد 375×812 (iPhone SE)
  2. فحص جميع الصفحات الرئيسية
- **Expected Result:** لا overflow، لا نصوص مقطوعة، الأزرار قابلة للنقر (min 44px)

---

### TC-UI-003
- **ID:** TC-UI-003
- **Module:** UI/UX — Loading States
- **Title:** عرض Loading State أثناء حجز الجزء
- **Type:** Functional / UX
- **Priority:** P1
- **Steps:**
  1. النقر على "حجز الجزء"
  2. ملاحظة الـUI خلال الـAPI call
- **Expected Result:** الزر يتحول لـloading spinner، لا يمكن النقر عليه مرة ثانية

---

## Module: Performance

### TC-PERF-001
- **ID:** TC-PERF-001
- **Module:** Performance
- **Title:** وقت استجابة حجز الجزء < 300ms
- **Type:** Performance
- **Priority:** P0
- **Estimated Execution:** 30 min
- **Steps:**
  1. k6 script: 100 VUs يرسلون طلبات حجز
  2. قياس p50, p95, p99
- **Expected Result:** p95 < 300ms، p99 < 1000ms، error rate < 0.1%

---

### TC-PERF-002
- **ID:** TC-PERF-002
- **Module:** Performance
- **Title:** 1000 مستخدم يتصفحون قائمة الختمات في نفس الوقت
- **Type:** Performance / Scalability
- **Priority:** P1
- **Steps:**
  1. k6: 1000 VUs → GET /khatmas لمدة 5 دقائق
- **Expected Result:** p95 < 200ms، error rate 0%، Redis cache hit rate > 90%
