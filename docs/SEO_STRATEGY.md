# SEO Strategy
# ختمة — Khatma Platform

**Version:** 1.0.0  

---

## 1. SEO Goals

| Metric | Target (Month 6) |
|--------|-----------------|
| Organic traffic | 30% of total traffic |
| Core Web Vitals | All green |
| Google Search Console coverage | > 95% |
| Indexed pages | All public pages |
| Arabic keyword ranking | Top 10 for primary keywords |

---

## 2. Target Keywords

### Primary Keywords (Arabic)
- ختمة قرآن جماعية
- ختم القرآن اون لاين
- ختمة رمضان
- حجز جزء قرآن
- ختمة إلكترونية

### Long-tail Keywords
- كيف أنشئ ختمة قرآنية مع العائلة
- ختمة قرآن مجانية أونلاين
- برنامج ختم القرآن الجماعي

---

## 3. Technical SEO Implementation

### 3.1 Next.js Metadata API

```typescript
// app/khatma/[id]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const khatma = await getKhatma(params.id);
  
  return {
    title: `${khatma.title} — ختمة`,
    description: `انضم لختمة "${khatma.title}" واحجز جزءاً من القرآن الكريم. ${khatma.participantCount} مشارك — ${khatma.completionPercentage}% مكتمل`,
    keywords: ['ختمة', 'قرآن', khatma.title, 'ختم القرآن'],
    openGraph: {
      title: khatma.title,
      description: `ختمة جماعية — ${khatma.completionPercentage}% مكتمل`,
      images: [{ url: `https://khatma.app/api/og?id=${khatma.id}`, width: 1200, height: 630 }],
      type: 'website',
      locale: 'ar_SA',
    },
    twitter: {
      card: 'summary_large_image',
      title: khatma.title,
      description: `شارك في ختم القرآن الكريم`,
    },
    alternates: {
      canonical: `https://khatma.app/khatma/${params.id}`,
    },
  };
}
```

### 3.2 Dynamic OG Image

```typescript
// app/api/og/route.tsx
// Uses @vercel/og or satori to generate dynamic images
// Shows: khatma title, progress ring, participant count
// Arabic text support via Arabic font
```

### 3.3 Structured Data (JSON-LD)

```typescript
// For khatma pages:
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": khatma.title,
  "description": khatma.description,
  "startDate": khatma.startDate,
  "endDate": khatma.endDate,
  "organizer": {
    "@type": "Person",
    "name": khatma.creator.displayName
  },
  "maximumAttendeeCapacity": khatma.maxMembers,
  "eventAttendanceMode": "OnlineEventAttendanceMode",
  "inLanguage": "ar"
}

// For the website:
{
  "@type": "WebApplication",
  "name": "ختمة",
  "description": "منصة ختم القرآن الكريم جماعياً",
  "applicationCategory": "ReligionApplication",
  "inLanguage": "ar",
  "offers": { "@type": "Offer", "price": "0" }
}
```

---

## 4. Rendering Strategy

| Page | Strategy | Reason |
|------|----------|--------|
| Landing `/` | SSG | Static, indexed by Google |
| Explore `/explore` | ISR (60s) | Updated regularly, SEO needed |
| Khatma Detail `/khatma/[id]` (public) | ISR (30s) | SEO for public khatmas |
| Auth pages | SSR | No SEO needed |
| Dashboard | CSR | Behind auth, no SEO |

---

## 5. Sitemap

```typescript
// app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicKhatmas = await getPublicKhatmas();
  
  return [
    { url: 'https://khatma.app', priority: 1.0, changeFrequency: 'weekly' },
    { url: 'https://khatma.app/explore', priority: 0.9, changeFrequency: 'hourly' },
    ...publicKhatmas.map(k => ({
      url: `https://khatma.app/khatma/${k.id}`,
      priority: 0.7,
      changeFrequency: 'hourly',
      lastModified: k.updatedAt
    }))
  ];
}
```

---

## 6. Performance (Core Web Vitals)

| Metric | Target | Strategy |
|--------|--------|---------|
| LCP | < 2.5s | ISR + CDN + next/image |
| FID/INP | < 100ms | Minimize JS, defer non-critical |
| CLS | < 0.1 | Explicit image dimensions, no layout shifts |
| TTFB | < 600ms | Edge caching, fast API |

### Key Optimizations:
```typescript
// 1. Font optimization
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],
  display: 'swap',
  preload: true,
});

// 2. Image optimization
<Image
  src={khatma.creatorAvatar}
  alt={khatma.creator.displayName}
  width={40}
  height={40}
  loading="lazy"
  placeholder="blur"
/>

// 3. Critical CSS inline for above-the-fold
// 4. Lazy load below-fold components
const KhatmaList = dynamic(() => import('./KhatmaList'), { ssr: false });
```

---

## 7. robots.txt

```
User-agent: *
Allow: /
Allow: /explore
Allow: /khatma/
Disallow: /dashboard
Disallow: /admin
Disallow: /api/
Disallow: /join/

Sitemap: https://khatma.app/sitemap.xml
```

---

## 8. Arabic SEO Considerations

- `<html lang="ar" dir="rtl">` على جميع الصفحات
- Canonical URLs تشير للنسخة العربية
- الأوصاف والعناوين تُكتَب بالعربية الفصيحة
- Internal linking بين الختمات العامة المرتبطة
- Page speed مُحسَّن للشبكات الخليجية
