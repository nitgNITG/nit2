# Lighthouse Regression Fix Brief — nitg-eg.com

> Hand-off spec for an AI/dev agent. Self-contained: file paths, exact current
> code, target code, and rationale. Project: Next.js 14.2.5 (App Router) +
> next-intl, RTL/Arabic. Repo root contains `app/[locale]/...`.

## Background

Two deployments were compared with Google PageSpeed Insights (lab):

- **Production (old)** = before the last 4 commits → SEO 100, Best Practices 100, Perf 93 (mobile) / 98 (desktop), A11y 83/88.
- **Dev (new)** = after the last 4 commits (a large "SEO/GEO" commit) → SEO 92, Best Practices 96, Perf 78 (mobile) / 99 (desktop), A11y 87/95.

Net result of the new commits:
- ✅ Accessibility improved (+4 mobile / +7 desktop) — keep.
- ❌ Best Practices −4 (both form factors) — **confirmed cause below, fix it.**
- ❌ SEO −8 (both form factors) — **one runtime audit; needs report read, see task.**
- ❌ Mobile Performance −15 — **mostly environmental; verify, see task.**

Deterministic checks already done (do NOT redo): served HTML of dev vs prod is
SEO-identical (same title, meta description, `lang=ar`, viewport, canonical
`https://nitg-eg.com/ar`, `robots: index,follow`, 4 JSON-LD blocks, 0
non-crawlable anchors). Dev even fixed 2 empty `alt`s that prod still has. So the
SEO drop is NOT in static markup.

---

## FIX 1 (confirmed, do this) — Image aspect-ratio regression → Best Practices −4

### Problem
`next/image` is given intrinsic `width`/`height` but then forced to a different
size with `w-full h-full` (CSS) **without** `width:auto`/`height:auto`. This
trips Lighthouse Best Practices **"Displays images with incorrect aspect ratio"**
and emits the Next.js console warning *"Image with src … has either width or
height modified, but not the other…"*. The old `<img>` had no intrinsic size, so
it never failed this audit. This is the −4 Best-Practices regression.

### File: `app/[locale]/components/TrustedByStrip.tsx`

**Current (lines ~44–50):**
```tsx
<Image
    src={`/trusted/${logo.file}`}
    alt={isAr ? logo.ar : logo.en}
    width={88}
    height={50}
    className='w-full h-full object-contain grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300'
/>
```

**Change to** (let the image keep its own aspect ratio inside the 88×50 box):
```tsx
<Image
    src={`/trusted/${logo.file}`}
    alt={isAr ? logo.ar : logo.en}
    width={88}
    height={50}
    className='max-w-full max-h-full w-auto h-auto object-contain grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300'
/>
```
Key: replace `w-full h-full` → `max-w-full max-h-full w-auto h-auto`. This keeps
the logo within the fixed-size parent without distorting its intrinsic ratio.

### File: `app/[locale]/components/Sponsors.tsx` (weaker version of same risk)

The marquee item is a fixed 130×80 white card; the image uses `fill` +
`object-contain`, which is generally OK, but logos with extreme ratios can still
be flagged. This is **optional** — apply only if the audit still flags sponsor
images after FIX 1. Current (lines ~51–59):
```tsx
<div style={{ position: 'relative', width: '100%', height: '100%' }}>
    <Image
        src={sponsor.img}
        alt='شعار أحد شركاء وعملاء شركة NIT'
        fill
        sizes='130px'
        style={{ objectFit: 'contain' }}
    />
</div>
```
No change required unless Lighthouse keeps flagging sponsor images; `object-contain`
already preserves ratio. Leave as-is by default.

### Acceptance
- No Next.js *"width or height modified, but not the other"* warning in the
  browser console on the homepage.
- Lighthouse Best Practices "incorrect aspect ratio" audit passes; BP back to 100.

---

## FIX 2 (optional hardening) — Silence client console errors → protects Best Practices

### Problem
`Sponsors` logs `console.error('[Sponsors] fetch error:', …)` whenever
`/api/sponser` fails. Lighthouse Best Practices **"Browser errors logged to the
console"** counts `console.error`. If that API ever 4xx/5xx-es in production
(observed returning 400 in local testing), it will silently cost BP points.

### File: `app/[locale]/components/Sponsors.tsx`

**Current (lines ~10–19):**
```tsx
const fetchSponsors = useCallback(async () => {
    try {
        const { data } = await axios.get('/api/sponser')
        if (Array.isArray(data.sponsers)) {
            setSponsors(data.sponsers)
        }
    } catch (error: any) {
        console.error('[Sponsors] fetch error:', error.message)
    }
}, [])
```

**Change to** (fail silently — sponsors are non-critical UI):
```tsx
const fetchSponsors = useCallback(async () => {
    try {
        const { data } = await axios.get('/api/sponser')
        if (Array.isArray(data.sponsers)) {
            setSponsors(data.sponsers)
        }
    } catch {
        // Sponsors are non-critical; ignore fetch failures so they
        // don't surface as console errors (hurts Lighthouse Best Practices).
    }
}, [])
```
Apply the same treatment to any other client component that `console.error`s on a
non-critical fetch failure (e.g. `app/[locale]/blog/components/Articles.tsx` if it
does the same).

---

## TASK 3 (investigate, no blind edit) — SEO −8

Static markup is already confirmed SEO-clean and equal/better than prod, so the
−8 is exactly **one** runtime/JS-rendered Lighthouse SEO audit (13 audits, losing
one ≈ 12/13 = 92, which matches the score precisely).

**Do this:**
1. Open the dev PageSpeed report (or run the PSI API below) and read the single
   SEO audit flagged red. Most likely candidates: `crawlable-anchors` or
   `link-text` on API-loaded project/sponsor cards, or a transient capture blip.
2. Re-run PageSpeed once to rule out a transient before changing code.
3. PSI API (needs a key to avoid 429 rate limiting):
   ```
   https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://dev.nitg-eg.com/ar&strategy=mobile&category=seo&key=YOUR_KEY
   ```
   Inspect `lighthouseResult.categories.seo.auditRefs`, find the audit whose
   `lighthouseResult.audits[id].score < 1`.
4. Only then fix the specific audit (e.g. ensure every dynamically rendered link
   is a real `<a href>` with descriptive text).

---

## TASK 4 (verify, likely environmental) — Mobile Performance −15

Desktop perf is unaffected (99 vs 98); only throttled mobile dropped. Measured
directly: dev TTFB+download 1067 ms vs prod 921 ms; dev HTML 286 KB vs prod
271 KB (+6%, from new FAQ/Process/JSON-LD sections). Signature of
throttle-sensitivity + cold `/_next/image` optimizer cache on a fresh deploy +
possibly different dev infra — not a code defect.

**Do this:**
1. Re-measure mobile after the deploy is warm (optimizer cache populated).
2. If still low, in PSI check the LCP element and `total-blocking-time`; ensure
   the LCP image has `priority` and correct `sizes`, and trim above-the-fold DOM.
3. Confirm dev and prod run on equivalent infrastructure/CDN before attributing
   the gap to code.

---

## Constraints
- Do not revert the accessibility improvements or the `<img>`→`next/image`
  migration — those are wins.
- Keep RTL/Arabic behavior intact.
- Touch only the files named above for FIX 1/2; TASK 3/4 are investigation-first.
