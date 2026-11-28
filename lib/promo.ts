/**
 * Promo videos on the public site — docs/promo-videos-dev-spec.md.
 *
 * The full promo is uploaded once to Cloudinary (signed, straight from the
 * dashboard). Everything else is derived from that one URL with Cloudinary
 * transforms: the 8 s muted teaser loop, the poster frame and the small
 * switcher thumbnail. So a project "has a promo" exactly when promo.videoUrl is set.
 *
 * Pure helpers only (no Prisma, no React) — safe to import from client and server.
 */
import { slugify } from '@/utils/slugify';

export const TEASER_SECONDS = 8;

// ─── Service pages ──────────────────────────────────────────────────────────

export type ServiceKind = 'app' | 'web';
type ServiceDef = { slug: string; kind: ServiceKind; labelEn: string; labelAr: string; accentEn: string; accentAr: string };

/** The /our-services/<slug> pages that render the "Built by N.I.T" section. */
export const PROMO_SERVICES: readonly ServiceDef[] = [
    { slug: 'ecommerce-app', kind: 'app', labelEn: 'eCommerce App', labelAr: 'تطبيق تجارة إلكترونية', accentEn: 'eCommerce apps we’ve shipped', accentAr: 'تطبيقات تجارة إلكترونية أطلقناها' },
    { slug: 'delivery-app', kind: 'app', labelEn: 'Delivery App', labelAr: 'تطبيق توصيل', accentEn: 'delivery apps we’ve shipped', accentAr: 'تطبيقات توصيل أطلقناها' },
    { slug: 'restaurant-app', kind: 'app', labelEn: 'Restaurant App', labelAr: 'تطبيق مطاعم', accentEn: 'restaurant apps we’ve shipped', accentAr: 'تطبيقات مطاعم أطلقناها' },
    { slug: 'loyalty-app', kind: 'app', labelEn: 'Loyalty App', labelAr: 'تطبيق ولاء', accentEn: 'loyalty apps we’ve shipped', accentAr: 'تطبيقات ولاء أطلقناها' },
    { slug: 'android-app', kind: 'app', labelEn: 'Android App', labelAr: 'تطبيق أندرويد', accentEn: 'Android apps we’ve shipped', accentAr: 'تطبيقات أندرويد أطلقناها' },
    { slug: 'ios-app', kind: 'app', labelEn: 'iOS App', labelAr: 'تطبيق iOS', accentEn: 'iOS apps we’ve shipped', accentAr: 'تطبيقات iOS أطلقناها' },
    { slug: 'educational-platforms', kind: 'web', labelEn: 'Educational Platform', labelAr: 'منصة تعليمية', accentEn: 'learning platforms we’ve built', accentAr: 'منصات تعليمية بنيناها' },
    { slug: 'ai-educational-platforms', kind: 'web', labelEn: 'AI Educational Platform', labelAr: 'منصة تعليم بالذكاء الاصطناعي', accentEn: 'AI learning platforms we’ve built', accentAr: 'منصات تعليم ذكية بنيناها' },
    { slug: 'moodle-lms', kind: 'web', labelEn: 'Moodle LMS', labelAr: 'منصة Moodle', accentEn: 'Moodle platforms we’ve launched', accentAr: 'منصات Moodle أطلقناها' },
    { slug: 'website-design', kind: 'web', labelEn: 'Website Design', labelAr: 'تصميم مواقع', accentEn: 'websites we’ve built', accentAr: 'مواقع بنيناها' },
    { slug: 'school-management', kind: 'web', labelEn: 'School Management', labelAr: 'إدارة مدارس', accentEn: 'school systems we’ve built', accentAr: 'أنظمة مدارس بنيناها' },
];

export const PROMO_SERVICE_SLUGS = PROMO_SERVICES.map((s) => s.slug);

export function serviceDef(slug: string): ServiceDef | undefined {
    return PROMO_SERVICES.find((s) => s.slug === slug);
}

// ─── Stored shape (Mongo) ───────────────────────────────────────────────────

export type StoredPromo = {
    videoUrl: string;
    publicId?: string | null;
    durationSec?: number | null;
    teaserStart?: number | null;
    posterAt?: number | null;
    uploadDate?: Date | string | null;
    captionsEn?: string | null;
    captionsAr?: string | null;
};

export type StoredProject = {
    id: string;
    img: string;
    title: string;
    titleEn?: string | null;
    description: string;
    descriptionEn?: string | null;
    types?: string[];
    links?: { headerEn: string; headerAr: string; link: string }[];
    order?: number;
    promo?: StoredPromo | null;
    featuredOrder?: number | null;
    services?: string[];
    categoryEn?: string | null;
    categoryAr?: string | null;
    features?: { en: string; ar: string }[];
    keyResults?: { value: string; labelEn: string; labelAr: string }[];
};

export const hasPromo = (p: { promo?: StoredPromo | null }): boolean => !!p.promo?.videoUrl;

// ─── Cloudinary URL derivation ──────────────────────────────────────────────

const CLD_VIDEO = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.+)$/;

/** Split a Cloudinary video URL into its base, optional version and extension-less public id. */
function splitVideoUrl(url: string): { base: string; version: string; id: string } | null {
    const m = CLD_VIDEO.exec(url);
    if (!m) return null;
    let rest = m[2];
    // Drop any transform segments already in the URL (a_b,c_d/…) — we add our own.
    while (/^[a-z]{1,4}_[^/]*\//.test(rest)) rest = rest.replace(/^[^/]*\//, '');
    const v = /^(v\d+\/)(.*)$/.exec(rest);
    const version = v ? v[1] : '';
    const path = v ? v[2] : rest;
    return { base: m[1], version, id: path.replace(/\.[a-z0-9]+$/i, '') };
}

const secs = (n: number) => Math.max(0, Math.round(n * 10) / 10);

/** The teaser window, kept inside the video when its length is known. */
export function teaserWindow(promo: StoredPromo): { start: number; end: number } {
    const dur = promo.durationSec ?? null;
    let start = secs(promo.teaserStart ?? 0);
    if (dur && dur > TEASER_SECONDS && start + TEASER_SECONDS > dur) start = secs(dur - TEASER_SECONDS);
    if (dur && dur <= TEASER_SECONDS) start = 0;
    const end = dur ? Math.min(secs(start + TEASER_SECONDS), secs(dur)) : secs(start + TEASER_SECONDS);
    return { start, end };
}

export type PromoUrls = {
    teaserMp4: string;
    teaserWebm: string;
    poster: string;
    thumb: string;
    full: string;
};

/** All the media URLs a promo needs, or null when videoUrl isn't one of ours. */
export function promoUrls(promo: StoredPromo): PromoUrls | null {
    const parts = splitVideoUrl(promo.videoUrl);
    if (!parts) return null;
    const { base, version, id } = parts;
    const url = (t: string, ext: string) => `${base}${t}/${version}${id}.${ext}`;
    const { start, end } = teaserWindow(promo);
    const posterAt = secs(promo.posterAt ?? start + 1);
    // 720p, no audio track, ~1 Mbps → an 8 s loop stays around 1 MB (spec §2: ≤ 1.5 MB).
    const teaser = `so_${start},eo_${end},ac_none,w_1280,h_720,c_limit,br_1m,q_auto:eco`;
    return {
        teaserMp4: url(`${teaser},vc_h264`, 'mp4'),
        teaserWebm: url(`${teaser},vc_vp9`, 'webm'),
        poster: url(`so_${posterAt},w_1280,h_720,c_limit,q_auto`, 'webp'),
        thumb: url(`so_${posterAt},w_320,h_180,c_fill,q_auto`, 'webp'),
        full: url('q_auto,vc_auto', 'mp4'),
    };
}

/** ISO 8601 duration for VideoObject, e.g. 45 → "PT45S", 75 → "PT1M15S". */
export function isoDuration(sec: number | null | undefined): string | undefined {
    if (!sec || sec <= 0) return undefined;
    const total = Math.round(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `PT${m ? `${m}M` : ''}${s || !m ? `${s}S` : ''}`;
}

// ─── Localised, client-safe view model ──────────────────────────────────────

export type PromoMedia = PromoUrls & {
    durationSec: number | null;
    uploadDate: string | null;
    captionsEn: string | null;
    captionsAr: string | null;
};

export type ShowcaseProject = {
    id: string;
    slug: string;
    title: string;
    description: string;
    img: string;
    category: string | null;
    features: string[];
    keyResults: { value: string; label: string }[];
    links: { label: string; href: string }[];
    promo: PromoMedia | null;
};

export function toShowcaseProject(p: StoredProject, locale: string): ShowcaseProject {
    const ar = locale === 'ar';
    const urls = p.promo ? promoUrls(p.promo) : null;
    const date = p.promo?.uploadDate ? new Date(p.promo.uploadDate) : null;
    return {
        id: p.id,
        slug: slugify(p.titleEn || p.title) || p.id,
        title: (ar ? p.title : p.titleEn) || p.title,
        description: (ar ? p.description : p.descriptionEn) || p.description,
        img: p.img,
        category: (ar ? p.categoryAr : p.categoryEn) || null,
        features: (p.features ?? []).map((f) => (ar ? f.ar : f.en)).filter(Boolean).slice(0, 3),
        keyResults: (p.keyResults ?? [])
            .filter((k) => k.value?.trim())
            .map((k) => ({ value: k.value, label: ar ? k.labelAr : k.labelEn })),
        links: (p.links ?? []).filter((l) => l.link).map((l) => ({ label: (ar ? l.headerAr : l.headerEn) || l.headerEn, href: l.link })),
        promo: urls && p.promo
            ? {
                ...urls,
                durationSec: p.promo.durationSec ?? null,
                uploadDate: date && !isNaN(date.getTime()) ? date.toISOString() : null,
                captionsEn: p.promo.captionsEn ?? null,
                captionsAr: p.promo.captionsAr ?? null,
            }
            : null,
    };
}

// ─── Which layout renders (spec §5 / §6) ────────────────────────────────────

export type ShowcaseState = 'multi' | 'single' | 'static' | 'hidden';

/** Service page section: 2+ promos → switcher, 1 → lead + "Also built by us", 0 → screenshots, none → hidden. */
export function showcaseState(projects: { promo: unknown }[]): ShowcaseState {
    if (projects.length === 0) return 'hidden';
    const withPromo = projects.filter((p) => p.promo).length;
    if (withPromo >= 2) return 'multi';
    if (withPromo === 1) return 'single';
    return 'static';
}

/** Projects with a promo first, then the editorial order. */
export function orderForShowcase<T extends { promo?: unknown; order?: number }>(projects: T[]): T[] {
    return [...projects].sort((a, b) => Number(!!b.promo) - Number(!!a.promo) || (a.order ?? 0) - (b.order ?? 0));
}

/** Our Projects Featured band: featuredOrder 1–3 with a promo, at most three. */
export function pickFeatured<T extends { promo?: StoredPromo | null; featuredOrder?: number | null }>(projects: T[]): T[] {
    return projects
        .filter((p) => hasPromo(p) && p.featuredOrder != null && p.featuredOrder >= 1 && p.featuredOrder <= 3)
        .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0))
        .slice(0, 3);
}

// ─── SEO ────────────────────────────────────────────────────────────────────

/** VideoObject JSON-LD for a promo that is actually rendered on the page (spec §10). */
export function videoObjectJsonLd(p: ShowcaseProject, locale: string): Record<string, unknown> | null {
    if (!p.promo) return null;
    return {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: locale === 'ar' ? `${p.title} — فيديو تعريفي` : `${p.title} — promo video`,
        description: p.description,
        thumbnailUrl: [p.promo.poster],
        ...(p.promo.uploadDate ? { uploadDate: p.promo.uploadDate } : {}),
        ...(isoDuration(p.promo.durationSec) ? { duration: isoDuration(p.promo.durationSec) } : {}),
        contentUrl: p.promo.full,
        inLanguage: locale,
    };
}

// ─── Dashboard input parsing (server side) ──────────────────────────────────

const num = (v: unknown): number | null => {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) ? n : null;
};

function ourUrl(url: unknown, cloudName: string, kind: 'video' | 'raw'): url is string {
    return typeof url === 'string' && !!cloudName && url.startsWith(`https://res.cloudinary.com/${cloudName}/${kind}/upload/`);
}

/** What the API writes: teaserStart is always set (schema default 0). */
export type PromoInput = StoredPromo & { teaserStart: number; uploadDate: Date };

export type PromoParse = { ok: true; value: PromoInput | null } | { ok: false; error: string };

/**
 * Validate the promo JSON posted by the dashboard. Only media in OUR Cloudinary
 * account is accepted — the URL ends up in a <video src> on the public site.
 * `null` / "" / "null" means "no promo" (removes it).
 */
export function parsePromoInput(raw: unknown, cloudName: string | undefined): PromoParse {
    if (raw == null || raw === '' || raw === 'null') return { ok: true, value: null };
    let v: Record<string, unknown>;
    try {
        v = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
    } catch {
        return { ok: false, error: 'Invalid promo data' };
    }
    if (!v || typeof v !== 'object') return { ok: false, error: 'Invalid promo data' };
    if (!cloudName) return { ok: false, error: 'Cloudinary is not configured on the server' };
    if (!ourUrl(v.videoUrl, cloudName, 'video')) return { ok: false, error: 'The promo video must be uploaded to our Cloudinary account' };
    for (const k of ['captionsEn', 'captionsAr'] as const) {
        if (v[k] != null && v[k] !== '' && !ourUrl(v[k], cloudName, 'raw')) return { ok: false, error: 'Captions must be .vtt files uploaded to our Cloudinary account' };
    }
    const duration = num(v.durationSec);
    const date = typeof v.uploadDate === 'string' && v.uploadDate ? new Date(v.uploadDate) : null;
    return {
        ok: true,
        value: {
            videoUrl: v.videoUrl,
            publicId: typeof v.publicId === 'string' && v.publicId ? v.publicId : null,
            durationSec: duration != null && duration > 0 ? duration : null,
            teaserStart: Math.max(0, num(v.teaserStart) ?? 0),
            posterAt: num(v.posterAt) != null ? Math.max(0, num(v.posterAt)!) : null,
            uploadDate: date && !isNaN(date.getTime()) ? date : new Date(),
            captionsEn: (v.captionsEn as string) || null,
            captionsAr: (v.captionsAr as string) || null,
        },
    };
}

/** 1–3, or null for "not featured". */
export function parseFeaturedOrder(raw: unknown): number | null {
    const n = num(raw);
    return n != null && Number.isInteger(n) && n >= 1 && n <= 3 ? n : null;
}

const parseJsonArray = (raw: unknown): unknown[] => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'string' || !raw) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
};

/** Known service slugs only, deduplicated. */
export function parseServices(raw: unknown): string[] {
    const out = parseJsonArray(raw).filter((s): s is string => typeof s === 'string' && PROMO_SERVICE_SLUGS.includes(s));
    return Array.from(new Set(out));
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function parseFeatures(raw: unknown): { en: string; ar: string }[] {
    return parseJsonArray(raw)
        .map((f) => ({ en: str((f as Record<string, unknown>)?.en), ar: str((f as Record<string, unknown>)?.ar) }))
        .filter((f) => f.en || f.ar)
        .slice(0, 3);
}

export type ShowcaseFields = Partial<{
    promo: PromoInput | null;
    featuredOrder: number | null;
    services: string[];
    categoryEn: string | null;
    categoryAr: string | null;
    features: { en: string; ar: string }[];
    keyResults: { value: string; labelEn: string; labelAr: string }[];
}>;

/**
 * Read the showcase fields from the dashboard's FormData. Only keys that were
 * sent are returned, so an older client (or a partial PUT) never wipes them.
 */
export function parseShowcaseForm(form: FormData, cloudName: string | undefined): { ok: true; data: ShowcaseFields } | { ok: false; error: string } {
    const data: ShowcaseFields = {};
    if (form.has('promo')) {
        const p = parsePromoInput(form.get('promo'), cloudName);
        if (!p.ok) return p;
        data.promo = p.value;
    }
    if (form.has('featuredOrder')) data.featuredOrder = parseFeaturedOrder(form.get('featuredOrder'));
    if (form.has('services')) data.services = parseServices(form.get('services'));
    if (form.has('categoryEn')) data.categoryEn = str(form.get('categoryEn')) || null;
    if (form.has('categoryAr')) data.categoryAr = str(form.get('categoryAr')) || null;
    if (form.has('features')) data.features = parseFeatures(form.get('features'));
    if (form.has('keyResults')) data.keyResults = parseKeyResults(form.get('keyResults'));
    return { ok: true, data };
}

export function parseKeyResults(raw: unknown): { value: string; labelEn: string; labelAr: string }[] {
    return parseJsonArray(raw)
        .map((k) => {
            const r = k as Record<string, unknown>;
            return { value: str(r?.value), labelEn: str(r?.labelEn), labelAr: str(r?.labelAr) };
        })
        .filter((k) => k.value)
        .slice(0, 4);
}
