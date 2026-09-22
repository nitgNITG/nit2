// Licence feature catalogue — one place for the toggle keys, their labels and
// the tab each one lives under in the licence editor (Add-ons / Blog / Offers /
// Ads / Coupons), for both products. Values are stored in License.features as
// {key: bool} and pushed as-is: academies read them through local_license
// (has_feature), stores through the PlatformLicense definition (requireFeature).
//
// Keys marked `pending` are stored and pushed but not enforced by the app yet
// (the toggle starts working the moment the app gates on it) — the editor says so.

export type Product = "academy" | "store";

export type FeatureDef = {
    key: string;
    label: { en: string; ar: string };
    /** Enforcement not wired in the product yet. */
    pending?: boolean;
};

export type FeatureTab = { id: "addons" | "blog" | "offers" | "ads" | "coupons"; label: string; academy: FeatureDef[]; store: FeatureDef[] };

export const FEATURE_TABS: FeatureTab[] = [
    {
        id: "addons", label: "Add-ons",
        academy: [
            { key: "drm", label: { en: "Protected video (DRM)", ar: "فيديو محمي (DRM)" } },
            { key: "jitsi", label: { en: "Live sessions", ar: "الحصص المباشرة" } },
            { key: "subscriptions", label: { en: "Subscriptions", ar: "الاشتراكات" } },
            { key: "packages", label: { en: "Course bundles", ar: "الباقات" } },
        ],
        store: [
            { key: "custom_domain", label: { en: "Custom domain", ar: "دومين خاص" } },
            { key: "reviews", label: { en: "Product reviews", ar: "تقييمات المنتجات" }, pending: true },
            { key: "reports", label: { en: "Reports", ar: "التقارير" }, pending: true },
        ],
    },
    {
        id: "blog", label: "Blog",
        academy: [{ key: "blog", label: { en: "Blog", ar: "المدونة" }, pending: true }],
        store: [{ key: "blog", label: { en: "Blog", ar: "المدونة" } }],
    },
    {
        id: "offers", label: "Offers",
        academy: [{ key: "offers", label: { en: "Offers", ar: "العروض" } }],
        store: [{ key: "offers", label: { en: "Offers", ar: "العروض" }, pending: true }],
    },
    {
        id: "ads", label: "Ads",
        academy: [{ key: "ads", label: { en: "Ads / banners", ar: "الإعلانات والبانرات" }, pending: true }],
        store: [{ key: "ads", label: { en: "Ads / banners", ar: "الإعلانات والبانرات" }, pending: true }],
    },
    {
        id: "coupons", label: "Coupons",
        academy: [{ key: "coupons", label: { en: "Discount coupons", ar: "كوبونات الخصم" } }],
        store: [{ key: "coupons", label: { en: "Discount coupons", ar: "كوبونات الخصم" }, pending: true }],
    },
];

/** All feature defs for a product, in tab order. */
export function featureDefs(product: Product): FeatureDef[] {
    return FEATURE_TABS.flatMap((t) => t[product]);
}

export function featureKeys(product: Product): string[] {
    return featureDefs(product).map((f) => f.key);
}

/** Label lookup (falls back to the key for legacy toggles like `banners`). */
export function featureLabel(product: Product, key: string, lang: "en" | "ar" = "en"): string {
    return featureDefs(product).find((f) => f.key === key)?.label[lang] ?? key;
}
