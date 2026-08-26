// Per-client branding collected on the build form, applied automatically during
// provisioning (see provisioning/apply_brand.php + apply-branding.sh) so the
// client never opens Moodle's admin settings. Every field is optional.
// Shared by POST /api/academies (create) and POST /api/academies/<slug>/branding
// (re-apply to a live academy).

export type BrandImage = { filename: string; data_b64: string };
export type Brand = {
    fullname_ar?: string;
    fullname_en?: string;
    shortname_ar?: string;
    shortname_en?: string;
    colors?: Record<string, string>; // brand-colour roles (hex) chosen in the build form
    contact_phone?: string;
    contact_whatsapp?: string;
    social?: Record<string, string>;
    logo?: BrandImage;
    logocompact?: BrandImage;
    favicon?: BrandImage;
    hero?: BrandImage;
    about?: BrandImage;
    login?: BrandImage;
    about_bullets?: string[];
    gallery?: BrandImage[];
    links?: Record<string, string>; // per-academy legal links (terms/privacy/about/faq)
};

const MAX_NAME_LEN = 200;
const MAX_IMG_B64 = 4_400_000; // ~3.3 MB decoded; provision-server re-validates type/size.

// Keep only well-formed, size-bounded branding — never trust the client blindly.
export function sanitizeBrand(raw: unknown): Brand {
    const out: Brand = {};
    if (!raw || typeof raw !== "object") return out;
    const b = raw as Record<string, unknown>;
    for (const k of ["fullname_ar", "fullname_en", "shortname_ar", "shortname_en"] as const) {
        const v = b[k];
        if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, MAX_NAME_LEN);
    }
    // Contact details (plain text).
    for (const k of ["contact_phone", "contact_whatsapp"] as const) {
        const v = b[k];
        if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 40);
    }
    // Social links — http(s) URLs only, known networks.
    if (b.social && typeof b.social === "object") {
        const sin = b.social as Record<string, unknown>;
        const sout: Record<string, string> = {};
        for (const k of ["facebook", "instagram", "youtube", "tiktok", "website"]) {
            const v = sin[k];
            if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) sout[k] = v.trim().slice(0, 300);
        }
        if (Object.keys(sout).length) out.social = sout;
    }
    // Per-academy legal links — http(s) URLs only.
    if (b.links && typeof b.links === "object") {
        const lin = b.links as Record<string, unknown>;
        const lout: Record<string, string> = {};
        for (const k of ["terms", "privacy", "about", "faq"]) {
            const v = lin[k];
            if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) lout[k] = v.trim().slice(0, 500);
        }
        if (Object.keys(lout).length) out.links = lout;
    }
    // Brand colours — keep only the known roles with valid #rrggbb hex.
    if (b.colors && typeof b.colors === "object") {
        const cin = b.colors as Record<string, unknown>;
        const cout: Record<string, string> = {};
        for (const k of ["primary", "secondary", "background", "surface", "text", "accent"]) {
            const v = cin[k];
            if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim())) cout[k] = v.trim();
        }
        if (Object.keys(cout).length) out.colors = cout;
    }
    const validImage = (img: unknown): BrandImage | null => {
        if (!img || typeof img !== "object") return null;
        const { filename, data_b64 } = img as Record<string, unknown>;
        if (typeof filename === "string" && filename &&
            typeof data_b64 === "string" && data_b64 && data_b64.length <= MAX_IMG_B64) {
            return { filename: filename.slice(0, 120), data_b64 };
        }
        return null;
    };
    for (const k of ["logo", "logocompact", "favicon", "hero", "about", "login"] as const) {
        const v = validImage(b[k]);
        if (v) out[k] = v;
    }
    // About bullet points (chips) — plain text, cap 8.
    if (Array.isArray(b.about_bullets)) {
        const items = b.about_bullets
            .filter((x): x is string => typeof x === "string" && x.trim() !== "")
            .map((x) => x.trim().slice(0, 200))
            .slice(0, 8);
        if (items.length) out.about_bullets = items;
    }
    // Gallery — an array of images (cap 8).
    if (Array.isArray(b.gallery)) {
        const imgs = b.gallery.map(validImage).filter((x): x is BrandImage => x !== null).slice(0, 8);
        if (imgs.length) out.gallery = imgs;
    }
    return out;
}
