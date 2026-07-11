# خطة SEO — nitg-eg.com
**الهدف:** المركز الأول على كلمات "شركة برمجيات مصر"، "Moodle مصر"، "تطبيق تجارة إلكترونية"، وكلمات الخدمات الأساسية.

---

## ✅ المنجز بالفعل

| العنصر | الحالة |
|--------|--------|
| og:image 1200×630 | ✅ |
| hreflang AR/EN | ✅ |
| Service JSON-LD لكل الصفحات | ✅ |
| Organization + LocalBusiness schema | ✅ |
| Article JSON-LD + BreadcrumbList | ✅ |
| إزالة meta keywords | ✅ |
| CountUp → SSR static values | ✅ |
| lazy-load images | ✅ |
| sitemap.xml dynamic | ✅ |
| 27 مقالة في المدونة بـ Arabic slugs | ✅ |
| slug-based URLs للمقالات القديمة | ✅ |

---

## 📅 المرحلة الأولى — Technical SEO
**المدة:** أسبوعين | **التاريخ:** يوليو 2026

### الأسبوع الأول
- [x] **سرعة الموقع** — Lighthouse: Performance 43 / SEO 100 / Accessibility 99 / Best Practices 100
- [x] **favicon 404** — تم إضافة `/public/favicon.png` (32×32) + تحديث icons metadata
- [x] **robots.txt** — تم إنشاء `/public/robots.txt` مع Allow all + Sitemap
- [ ] **Nginx non-www → www** — في انتظار الـ nginx config من السيرفر
- [ ] **Google Search Console** — طلب re-indexing للصفحات المُصلحة

### الأسبوع الثاني
- [x] **سرعة الصور** — كل الصور على Cloudinary (WebP تلقائي)
- [x] **Core Web Vitals** — تم تقليل JS bundle: حذف animate.css (72KB) + lazy-load لـ 9 مكونات ثقيلة
- [x] **Canonical tags** — كل صفحة خدمة ومقالة وصفحة رئيسية عندها canonical صح

---

## 📅 المرحلة الثانية — Trust & E-E-A-T
**المدة:** أسبوعان | **التاريخ:** أغسطس 2026 (الأول)

> مستوحاة من الـ case study — دي النقطة اللي أحدثت فرق كبير

- [ ] **صفحة "من نحن"** — تفصيل أعمق: تاريخ الشركة، الفريق، الأرقام الحقيقية (150+ عميل، 12 سنة)
- [ ] **صفحة تقييمات العملاء** — جلب تقييمات Google Maps وعرضها بـ schema `Review`
- [ ] **شهادات موثّقة** — Case studies لمشاريع حقيقية مع أرقام (زيادة مبيعات، عدد مستخدمين)
- [x] **Privacy Policy + Terms** — تم إنشاء صفحة `/privacy-policy` (AR/EN) مع schema `WebPage` + رابط في الـ footer
- [x] **بيانات الاتصال في الـ footer** — ظاهرة في كل صفحة

---

## 📅 المرحلة الثالثة — Content Expansion
**المدة:** مستمر | **التاريخ:** أغسطس–سبتمبر 2026

> هدف: أي شخص يبحث عن خدماتنا يلاقي nitg-eg.com

### كلمات لم تُغطَّ بعد (مقالات مطلوبة)

| الكلمة | نوع المحتوى | الأولوية |
|--------|------------|---------|
| تطوير تطبيق Moodle | مقالة | ✅ تم |
| شركة برمجة في الإمارات | مقالة | ✅ تم |
| تطوير تطبيق في السعودية | مقالة | ✅ تم |
| أفضل تطبيق توصيل مصر | مقالة | ✅ تم |
| برمجة تطبيق مطعم | مقالة | ✅ تم |
| نظام إدارة مدرسة | مقالة | ✅ تم |
| تطبيق برنامج ولاء عملاء | مقالة | ✅ تم |
| كم تكلفة تطوير تطبيق Flutter | مقالة | ✅ تم |

**التردد المقترح:** مقالتان كل أسبوعين (أوتوميشن عبر Claude)

---

## 📅 المرحلة الرابعة — AI Search Optimization
**المدة:** أسبوعان | **التاريخ:** سبتمبر 2026

> الظهور في AI Overviews (Google SGE) وChatGPT وPerplexity

- [ ] **FAQPage schema** على كل صفحة خدمة (3–5 أسئلة شائعة)
- [ ] **محتوى يجيب أسئلة مباشرة** — "ما تكلفة Moodle في مصر؟" جواب واضح في أول 100 كلمة
- [ ] **HowTo schema** على الصفحات التعليمية
- [ ] **SpeakableSpecification** للمحتوى العربي

---

## 📅 المرحلة الخامسة — Off-Page & Authority
**المدة:** مستمر | **التاريخ:** أكتوبر 2026+

- [ ] **Google Business Profile** — تحديث كامل + صور + posts منتظمة
- [ ] **Backlinks** — نشر مقالات على مواقع عربية تقنية (Muqawil، Arab Hardware، إلخ)
- [ ] **LinkedIn Company Page** — نشر منتظم يربط بالمقالات
- [ ] **حضور في قوائم الشركات** — Clutch.co، GoodFirms، Upwork Agency

---

## 🤖 ما يمكن أتمتته مع Claude

| المهمة | التردد | الأداة |
|--------|--------|--------|
| كتابة مقالات SEO جديدة | كل أسبوعين | Claude + production API |
| مراجعة الـ Core Web Vitals | شهري | Claude + Lighthouse CLI |
| تحليل المنافسين الجديدين | شهري | Claude + WebSearch |
| اقتراح كلمات بحث جديدة | كل 3 أشهر | Claude + Search Console data |
| تحديث محتوى المقالات القديمة | كل 6 أشهر | Claude |

---

## 📊 KPIs — مقاييس النجاح

| المقياس | الحالي | الهدف (6 أشهر) |
|---------|--------|----------------|
| Lighthouse SEO Score | ~85 | 95+ |
| مقالات في المدونة | 27 | 50+ |
| صفحات مفهرسة في Google | ؟ | 80+ |
| كلمات في Top 10 | ؟ | 30+ |
| Organic Traffic شهري | ؟ | +200% |

---

## ⚡ الخطوات الفورية (هذا الأسبوع)

1. نشر المرحلة الأولى (Nginx + favicon + robots.txt)
2. Google Search Console → طلب indexing للمقالات الجديدة
3. موافقة على الخطة ← **محتاج approval منك**

