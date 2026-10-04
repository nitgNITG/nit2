// Licence feature catalogue — one flat list of toggles per product, shared by the
// licence editor and the public pricing page. Values live in License.features as
// {key: bool} and are pushed as-is: academies read them through local_license
// (has_feature), stores through the PlatformLicense definition (requireFeature in
// store-api/src/app.ts).
//
// `pending` marks a toggle the product does not gate on yet — it is stored and
// pushed, and starts biting the moment its module calls requireFeature/has_feature.

export type Product = "academy" | "store";

export type FeatureDef = {
    key: string;
    label: { en: string; ar: string };
    /** Enforcement not wired in the product yet. */
    pending?: boolean;
};

const BLOG: FeatureDef = { key: "blog", label: { en: "Blog", ar: "المدونة" } };
const OFFERS: FeatureDef = { key: "offers", label: { en: "Offers", ar: "العروض" } };
const ADS: FeatureDef = { key: "ads", label: { en: "Ads", ar: "الإعلانات" } };
const COUPONS: FeatureDef = { key: "coupons", label: { en: "Coupons", ar: "كوبونات الخصم" } };

export const FEATURES: Record<Product, FeatureDef[]> = {
    // The four sold on every plan, then the academy-only extras.
    academy: [
        { ...BLOG, pending: true },
        OFFERS,
        { ...ADS, pending: true },
        COUPONS,
        { key: "drm", label: { en: "Protected video (DRM)", ar: "فيديو محمي (DRM)" } },
        { key: "jitsi", label: { en: "Live sessions", ar: "الحصص المباشرة" } },
        { key: "subscriptions", label: { en: "Subscriptions", ar: "الاشتراكات" } },
        { key: "packages", label: { en: "Course bundles", ar: "الباقات" } },
    ],
    // Store: blog / ads / coupons are enforced by store-api; offers has no module yet.
    store: [
        BLOG,
        { ...OFFERS, pending: true },
        ADS,
        COUPONS,
        { key: "reports", label: { en: "Reports", ar: "التقارير" } },
        { key: "reviews", label: { en: "Product reviews", ar: "تقييمات المنتجات" }, pending: true },
        { key: "custom_domain", label: { en: "Custom domain", ar: "دومين خاص" } },
    ],
};

export const featureDefs = (product: Product): FeatureDef[] => FEATURES[product];
export const featureKeys = (product: Product): string[] => FEATURES[product].map((f) => f.key);

/** Label lookup (falls back to the key for legacy toggles like `banners`). */
export function featureLabel(product: Product, key: string, lang: "en" | "ar" = "en"): string {
    return FEATURES[product].find((f) => f.key === key)?.label[lang] ?? key;
}
