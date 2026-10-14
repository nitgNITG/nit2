# Promo Videos on nitg-eg.com — Web Dev Spec

**Mockup (design canvas):** https://claude.ai/artifact/DsD5muM9p3Qu28EU9K4L1V
**Pages in scope:** `/en/our-projects`, every `/en/our-services/*` page, and their Arabic (`/ar/...`) versions.

## 1. Goal

Add short promo videos for our top projects to the pages where clients decide whether to contact us.

- **Service pages:** today they show no real projects at all. Each one gets a "Built by N.I.T" section that shows the projects we built in that category.
- **Our Projects page:** gets a Featured band under the hero, plus a play badge on the cards that have a video.

Most projects will **not** have a promo at first. Some categories will have one, and some will have none. The layout must adapt on its own based on which videos exist, with no design work needed per project.

---

## 2. Data model

Add **optional** fields to the project record, wherever projects are managed today (the card images come from `/uploads/projects/`).

| Field | Type | Notes |
|---|---|---|
| `promo.teaser` | file (MP4, optional WebM) | 6–10 s muted loop, 720p, ≤ 1.5 MB |
| `promo.full` | file (MP4) **or** YouTube ID | 30–60 s with sound |
| `promo.poster` | image (WebP) | First frame / key frame, 16:9, ≤ 150 KB |
| `promo.durationSec` | number | Used for the badge and the SEO schema |
| `promo.uploadDate` | date | Used for the SEO schema |
| `promo.captionsEn` / `promo.captionsAr` | `.vtt` (optional) | Only needed if captions are not burned into the video |
| `featuredOrder` | number \| null | 1–3 = shown in the Featured band on Our Projects |
| `services` | string[] | Service slugs this project belongs to (see §3) |
| `keyResults` | `{ value, label }[]` (optional) | E.g. `{ value: "50K+", label: "downloads" }`. **Real numbers only.** If empty, the result boxes are hidden. |

**A project "has a promo" when `promo.teaser` and `promo.poster` both exist.** The `full` video is what opens in the lightbox. If `full` is missing, hide the play button and the "Watch the full promo" link, and show only the teaser.

---

## 3. Service → project mapping (initial)

| Service page slug | Projects |
|---|---|
| `ecommerce-app` | Tawreedat Go, Buzz |
| `delivery-app` | Tawreedat Go, Buzz |
| `restaurant-app` | Buzz |
| `loyalty-app` | PayPoins |
| `educational-platforms` | Loghat, Step to English, Academy of Excellence, 3alemny |
| `ai-educational-platforms` | Loghat |
| `moodle-lms` | Vocational Training Academy, PM Lounge, Academy of Excellence |
| `android-app` / `ios-app` | Any project with a store link (Loghat, Step to English, Tawreedat Go, Buzz, PayPoins) |
| `website-design`, `school-management` | To be decided — no matching project yet → section hidden |

Within a page, order projects with promos first, then by an editorial order field.

---

## 4. Components

| Component | Used on | Responsibility |
|---|---|---|
| `PromoPlayer` | Both pages | Poster → muted teaser loop, play button, progress line, "Preview · muted loop" chip |
| `PromoLightbox` | Both pages | Full video with sound, captions EN/AR toggle, "Start a similar project" call-to-action |
| `ProjectShowcaseSection` | Service pages | The "Built by N.I.T" section and its 4 states (§5) |
| `FeaturedProjectsBand` | Our Projects | Featured band and its 3 states (§6) |
| `ProjectCard` (existing) | Our Projects | Add the "Watch promo" badge and the desktop hover preview |

One `PromoLightbox` instance per page is enough; open it with the selected project.

---

## 5. Service pages — "Built by N.I.T" section

**Position:** between the existing **"What we build"** and **"Implementation process"** sections, on every service page.

| Projects with promo in this category | What renders |
|---|---|
| **2 or more** | Player on the left, project details on the right, thumbnail switcher below (each thumbnail swaps the player and details) |
| **Exactly 1** | That project leads with the player. No switcher. The category's other projects show in an **"Also built by us"** row: screenshot + name + category, linking to the project |
| **0, but the category has projects** | Same layout, but the player becomes a **static screenshot collage** (3 phone frames, or a browser frame for web platforms). No play button, no "Watch the full promo" link. The heading reads "Built by N.I.T — …" instead of "See it running — …" |
| **No projects in the category** | Don't render the section |

**Details column:** category label, project name, a 2-line description, 3 feature chips, optional key results, "Start a similar project" (goes to contact, with the project name prefilled if possible), and store/web links.

**Layout:**
- Container max-width 1200 px. Section padding 88 / 96 px vertical (desktop).
- Player and details sit in a wrapping flex row: player `flex: 1 1 600px`, details `flex: 1 1 380px`, gap 48 px. They stack below about 1030 px.
- Player: 16:9, radius 18 px, 1 px border `rgba(0,255,205,.28)`, soft shadow.
- On mobile the switcher becomes a horizontally scrolling row of chips.

**Theme:** dark by default (same teal as the hero). There is a light variant (`#F2F3FA`) if the dark band feels too heavy next to the neighbouring sections.

---

## 6. Our Projects page — Featured band

**Position:** directly under the hero stats. The band overlaps the bottom of the hero (hero bottom padding about 200 px, band `margin-top: -150px`, white card, radius 24).

| Projects with `featuredOrder` and a promo | What renders |
|---|---|
| **2–3** | Player + vertical tabs (number · short label · name · progress line for the active tab) + call-to-action |
| **1** | Player + that project's details panel (category, name, description, call-to-action, store links). No tabs |
| **0** | Don't render the band. The hero keeps its normal bottom padding (about 96 px), so the page looks exactly like today |

**Cards (existing grid):**
- Cards with a promo get a "Watch promo" pill badge at the bottom-left of the image: dark `#0B2923` pill with a mint play circle.
- Cards without a promo don't change.
- **Desktop hover** (only for `@media (hover: hover) and (pointer: fine)`): after a delay of about 150 ms, swap the image for the muted teaser and show a progress line. Revert on mouse leave.
- **Click / tap** on the badge or image opens the lightbox.
- Never autoplay more than one card at a time.

---

## 7. Player behaviour

- **Teaser:** `<video muted loop playsinline preload="none" poster=…>`.
  - Start it with an `IntersectionObserver` when at least 50 % of it is visible; pause it when it leaves.
  - Only one teaser plays at a time.
- **Reduced motion:** `prefers-reduced-motion: reduce` → show the poster only, never autoplay. The play button still opens the lightbox.
- **Data saver:** if `navigator.connection.saveData` is on, behave the same as reduced motion.
- **Lightbox:**
  - Built as `role="dialog"` with `aria-modal="true"`.
  - Keyboard focus stays inside it; Esc and the close button close it; focus returns to the element that opened it.
  - The page behind it doesn't scroll.
  - The full video loads only when the lightbox opens, starts with sound, and pauses and resets on close.
- **Captions:** EN/AR toggle. Default to the page locale (`/ar` → Arabic). With burned-in captions, offer separate EN/AR video files instead of `.vtt` tracks.
- **Analytics events** (with `project_slug` and `page`): `promo_teaser_view`, `promo_open`, `promo_progress_25/50/75`, `promo_complete`, `promo_cta_click`.

---

## 8. Arabic / RTL

- Mirror the layouts on `/ar` pages. Use logical properties (`margin-inline-start`, `text-align: start`, `inset-inline-*`) rather than left/right.
- The play icon itself is **not** mirrored.
- Labels need Arabic copy: "Watch promo", "Also built by us", "Preview · muted loop", "Start a similar project", and so on.

---

## 9. Hosting & performance

- **Teasers and posters:** self-host next to the other uploads (e.g. `/uploads/promos/`), served with long cache headers.
- **Full promos — recommendation:** self-host the MP4. Alternatively, use a YouTube upload with a lightweight embed on `youtube-nocookie.com` that loads the iframe only on click; this also helps the video get discovered on YouTube. Either way, nothing heavy loads before the click.
- **Posters:** use `next/image` with correct `sizes`. The Featured band's poster is above the fold → load it eagerly with `priority`. Every other poster loads lazily.
- **Budgets:**
  - Page weight must not grow by more than the teasers that are actually on screen.
  - No layout shift: reserve the 16:9 box with `aspect-ratio`.
  - LCP must stay as today: the poster is an image and the video never becomes the LCP element.

---

## 10. SEO

- On every page that **renders** a promo, add a `VideoObject` JSON-LD per video:
  - `name`, `description`, `thumbnailUrl` (poster), `uploadDate`, `duration` (ISO 8601, e.g. `PT45S`)
  - `contentUrl` (MP4) or `embedUrl` (YouTube)
- Don't add the schema on pages where the video isn't shown.
- Optional: a video sitemap.

---

## 11. Accessibility

- Every control is a real `<button>` / `<a>`. Icon-only buttons have an `aria-label` (e.g. "Play the full promo with sound", "Close video").
- Touch targets are at least 44 × 44 px.
- Text contrast is at least 4.5:1. The mint `#00FFCD` is for dark backgrounds only; on light backgrounds use `#00795F` for text.
- Switcher thumbnails / tabs expose the selected state: `aria-pressed` or `role="tab"` + `aria-selected`.
- Captions are available on every full promo.

---

## 12. Design tokens (from the live site)

| Token | Value |
|---|---|
| Font | Cairo (400 / 600 / 700 / 800) |
| Dark background | `#0B2923` (+ grid lines `rgba(0,255,205,.05)`, 48 px) |
| Mint accent (on dark) | `#00FFCD` |
| Green accent / accent text on light | `#00997A` / `#00795F` |
| Light section background | `#F2F3FA` |
| Primary button | `linear-gradient(#1E7D67, #0B2923)`, radius 8 px, white text |
| Body text on light | `#0B2923`, secondary `#46524F` |

---

## 13. Acceptance criteria

- [ ] Each service page renders the correct state for 2+ / 1 / 0 promos, and hides the section when the category has no projects.
- [ ] Our Projects renders the band for 3 / 1 featured promos and hides it for 0, with no gap left in the hero.
- [ ] Adding or removing a promo in the CMS changes the layout with no code change.
- [ ] Only one teaser plays at a time; teasers pause off-screen; reduced motion and Data Saver show posters only.
- [ ] The lightbox is keyboard-accessible (focus stays inside, Esc closes, focus returns) and starts with sound.
- [ ] Arabic pages are mirrored and show Arabic captions by default.
- [ ] `VideoObject` schema validates in Google's Rich Results Test.
- [ ] No layout shift added; LCP unchanged on all affected pages (compare Lighthouse before and after).
- [ ] Analytics events fire with the project slug.

## 14. Open questions

1. Where do projects live today (headless CMS, admin panel, static JSON)? The new fields go there.
2. Full promos: self-hosted MP4, or YouTube?
3. Who provides the `keyResults` numbers? They stay hidden until there are real figures.
4. Captions: burned-in (separate EN/AR files) or `.vtt` tracks?
