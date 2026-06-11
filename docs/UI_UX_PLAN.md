# UI/UX Plan
# ختمة — Khatma Platform

**Version:** 1.0.0  
**Owner:** UI/UX Designer  

---

## 1. Design Principles

1. **البساطة أولاً** — كل شاشة تُنجز مهمة واحدة بوضوح
2. **RTL Native** — ليس مجرد mirror، بل تجربة عربية أصيلة
3. **السرعة المحسوسة** — Optimistic UI، skeleton screens، لا انتظار
4. **الجماعية** — تصميم يُشعر بوجود الآخرين (avatars، progress)
5. **الروحانية** — ألوان وتصميم يعكس الطابع القرآني

---

## 2. Design System

### 2.1 Color Palette

```
Primary:    #1B6B4A  (أخضر إسلامي عميق)
Secondary:  #C8A84B  (ذهبي / عقيق)
Background: #F8F5EE  (عاجي دافئ)
Surface:    #FFFFFF
Text Main:  #1A1A2E
Text Muted: #6B7280

Status Colors:
  Available:  #22C55E  (أخضر فاتح)
  Reserved:   #F59E0B  (عنبري)
  Completed:  #6B7280  (رمادي)
  
Semantic:
  Success: #16A34A
  Error:   #DC2626
  Warning: #D97706
  Info:    #2563EB
```

### 2.2 Typography

```
الخط العربي الأساسي: IBM Plex Sans Arabic (Google Fonts)
  - Regular (400): نص عادي
  - Medium (500): عناوين فرعية
  - Bold (700): عناوين رئيسية، أزرار

الخط القرآني (للأجزاء): Noto Naskh Arabic
  - الأرقام والأسماء القرآنية

خط الأرقام: Tabular numbers للإحصائيات

Font Sizes (RTL-optimized):
  xs: 12px | sm: 14px | base: 16px
  lg: 18px | xl: 20px | 2xl: 24px
  3xl: 30px | 4xl: 36px
```

### 2.3 Spacing Scale
```
4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128 px
```

### 2.4 Border Radius
```
sm: 4px | md: 8px | lg: 12px | xl: 16px | full: 9999px
```

---

## 3. Screen Inventory

### 3.1 Public Screens

| Screen | Route | Type |
|--------|-------|------|
| Landing Page | / | SSG |
| Explore Khatmas | /explore | ISR |
| Khatma Preview (public) | /khatma/[id] | ISR |
| Join via Link | /join/[token] | SSR |

### 3.2 Auth Screens

| Screen | Route |
|--------|-------|
| Login | /login |
| Register | /register |
| Forgot Password | /forgot-password |
| OTP Verification | /verify-otp |

### 3.3 Dashboard Screens

| Screen | Route |
|--------|-------|
| My Dashboard | /dashboard |
| My Khatmas | /my-khatmas |
| Create Khatma | /khatma/new |
| Khatma Detail (member) | /khatma/[id] |
| My Groups | /groups |
| Create Group | /groups/new |
| Group Detail | /groups/[id] |
| Profile | /profile |
| Notifications | /notifications |
| Settings | /settings |

---

## 4. Key Screen Wireframes (Text-based)

### 4.1 Khatma Detail Page (Core Screen)

```
┌─────────────────────────────────────────────┐
│  ← ختمة رمضان 1446                [⋮ خيارات]│
│  8 مشاركين • تنتهي في 25 يوم              │
│                                              │
│  ██████████████████████░░░░░ 60%            │
│  18 مكتمل / 7 محجوز / 5 متاح             │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │           شبكة الأجزاء 5×6            │ │
│  │  ①  ②  ③  ④  ⑤  ⑥               │ │
│  │  ⑦  ⑧  ⑨  ⑩  ⑪  ⑫               │ │
│  │  ...                                   │ │
│  │                                        │ │
│  │  الألوان:                               │ │
│  │  🟢 متاح  🟡 محجوز  ⬜ مكتمل           │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  المشاركون (8)                               │
│  [👤 أحمد] [👤 فاطمة] [👤 محمد] [+5]       │
│                                              │
│  [      احجز جزءاً الآن      ]              │
└─────────────────────────────────────────────┘
```

### 4.2 Part Selection Modal

```
┌─────────────────────────────────────────────┐
│           اختر الجزء للحجز            ✕   │
│                                              │
│  الأجزاء المتاحة:                            │
│                                              │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│  │ 3  │ │ 7  │ │ 11 │ │ 14 │ │ 22 │        │
│  │ متاح│ │ متاح│ │ متاح│ │ متاح│ │ متاح│   │
│  └────┘ └────┘ └────┘ └────┘ └────┘        │
│                                              │
│  الجزء الثالث:                               │
│  سورة البقرة (ج. 3) - من آية 253           │
│                                              │
│  [  حجز الجزء الثالث  ]                    │
└─────────────────────────────────────────────┘
```

### 4.3 Landing Page Structure

```
Hero:
  "اختم القرآن مع من تحب"
  "أنشئ ختمة جماعية في ثوانٍ"
  [ابدأ مجاناً] [استعرض الختمات]

Stats Bar:
  10,000+ ختمة • 500,000+ جزء مُتمَّم • 50,000+ مستخدم

How It Works:
  1. أنشئ ختمة  →  2. ادعُ أصدقاءك  →  3. احجز واقرأ  →  4. ✅

Featured Khatmas (Public ones)

CTA Section: "انضم لمجتمع القراء"
```

---

## 5. User Journey Maps

### 5.1 منشئ الختمة

```
Awareness → Landing Page
    ↓
Interest → يرى كيف يعمل التطبيق
    ↓
Registration → نموذج بسيط (3 حقول)
    ↓
Create Khatma → Wizard في 3 خطوات:
  1. اسم الختمة ونوعها
  2. الخصوصية والإعدادات
  3. مشاركة الرابط
    ↓
Invite → يشارك الرابط (WhatsApp, Copy)
    ↓
Monitor → يتابع التقدم
    ↓
Celebrate → الختمة تكتمل 🎉
```

### 5.2 المشارك الجديد

```
Receives Link → صفحة Landing مع معاينة الختمة
    ↓
Register/Login → (إذا لم يكن مسجلاً)
    ↓
Join Khatma → زر واحد
    ↓
See Parts Grid → يرى الأجزاء الملونة
    ↓
Reserve Part → نقرة واحدة + تأكيد
    ↓
Read → يتذكر جزءه المحجوز
    ↓
Complete → يسجل الإتمام
    ↓
View Progress → يرى تقدم الجميع
```

---

## 6. Component States

### 6.1 Quran Part Card

```
AVAILABLE:  border-green, bg-green-50, cursor-pointer, hover effect
RESERVED:   border-amber, bg-amber-50, shows avatar + name, NOT clickable (if not yours)
COMPLETED:  border-gray, bg-gray-100, opacity-75, checkmark icon
LOADING:    skeleton pulse animation
MY_PART:    border-blue, bg-blue-50, "جزءك" badge, "تمام" button visible
```

### 6.2 Form States

```
DEFAULT:    standard border
FOCUSED:    primary color border
VALID:      green check icon
INVALID:    red border + error message below
LOADING:    spinner on submit button, fields disabled
SUCCESS:    green banner + redirect
```

### 6.3 Page States

```
LOADING:    Skeleton screens (not spinners)
EMPTY:      Illustration + CTA
ERROR:      Error card + retry button
OFFLINE:    "أنت غير متصل بالإنترنت" banner
```

---

## 7. Mobile UX Guidelines

- **Min touch target:** 44×44px for all interactive elements
- **Bottom navigation:** 5 items max (Dashboard, Khatmas, Groups, Notifications, Profile)
- **Sticky CTA:** "احجز جزءاً" button sticks to bottom on khatma detail
- **Pull to refresh:** On khatma detail page
- **Swipe actions:** Swipe part card → quick reserve
- **Haptic feedback:** On successful reservation (if supported)

---

## 8. RTL-Specific Considerations

```
1. شبكة الأجزاء تبدأ من اليمين: 1, 2, 3... يساراً
   (القرآن يُقرأ من اليمين لليسار — الجزء 1 في اليمين)

2. Progress bars: تمتلئ من اليمين لليسار

3. Breadcrumbs: الصفحة الرئيسية > ختمتي > ختمة رمضان
   تكتب: ختمة رمضان < ختمتي < الصفحة الرئيسية
   (الأعمق على اليسار)

4. Toasts/Notifications: تظهر من اليمين-أعلى

5. Modal close button: يسار-أعلى (ليس يمين)

6. Back button: يمين (←) لأن الاتجاه RTL

7. Avatars في القائمة: الصورة على اليمين، النص على اليسار
```

---

## 9. Micro-interactions

| تفاعل | التأثير |
|-------|---------|
| حجز جزء | pulse animation على الجزء → تغيير لون متدرج → confetti خفيف |
| إتمام جزء | checkmark animation → progress bar يتحرك |
| اكتمال الختمة | full-screen celebration → confetti + "أتممتم ختم القرآن" |
| انضمام عضو جديد | avatar يظهر في قائمة الأعضاء بـfade-in |
| تحديث فوري | جزء يتغير لونه بـtransition لطيف (300ms) |

---

## 10. Gamification Elements (MVP Lite)

- **Progress Circle:** دائرة نسبة الإتمام على بطاقة الختمة
- **Streak** (Phase 2): أيام متتالية من القراءة
- **Badges** (Phase 2): "أول ختمة"، "قارئ دائم"، "منظم الختمات"
- **Leaderboard** (Phase 3): ترتيب المجموعة بعدد الأجزاء
