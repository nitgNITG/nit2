// Seed data for the evals: a small, fixed catalog so every price and project the
// assistant may mention is known (rules check replies against these numbers).
import { DEFAULT_CONFIG } from "@/lib/agent/config";

export const LICENSES = [
    { key: "demo", name: "Demo", product: "academy", priceEgp: 0, priceEgpMonthly: 0, price: 0, maxCourses: 5, maxTeachers: 1, storageGb: 1, supportedApp: false, order: 0 },
    { key: "basic", name: "Basic", product: "academy", priceEgp: 6000, priceEgpMonthly: 600, price: 120, maxCourses: 50, maxTeachers: 5, storageGb: 10, order: 1 },
    { key: "standard", name: "Standard", product: "academy", priceEgp: 12000, priceEgpMonthly: 1200, price: 240, maxCourses: 300, maxTeachers: 20, storageGb: 50, features: { drm: true, coupons: true }, order: 2 },
    { key: "professional", name: "Professional", product: "academy", priceEgp: 0, priceEgpMonthly: 0, price: 0, contactSales: true, order: 3 },
    { key: "store-basic", name: "Store Basic", product: "store", priceEgp: 5000, priceEgpMonthly: 500, price: 100, order: 0 },
    { key: "store-pro", name: "Store Pro", product: "store", priceEgp: 9000, priceEgpMonthly: 900, price: 180, order: 1 },
];

export const SERVICE_PLANS = [
    { service: "moodle", nameAr: "منصة Moodle", nameEn: "Moodle platform", price: 1500, featuresAr: ["تصميم", "استضافة"], featuresEn: ["Design", "Hosting"], order: 0 },
    { service: "ecommerce", nameAr: "تطبيق متجر", nameEn: "Store app", price: 2000, featuresAr: ["أندرويد", "iOS"], featuresEn: ["Android", "iOS"], order: 1 },
];

export const PRICE_RANGES = [
    { category: "custom_lms", labelAr: "منصة تعليمية مخصصة", labelEn: "Custom LMS", minUsd: 8000, maxUsd: 20000, notesEn: "Depends on integrations, apps and scale.", notesAr: "يعتمد على التكاملات والتطبيقات وحجم المستخدمين.", updatedBy: "eval" },
];

export const PROJECTS = [
    { title: "أكاديمية التدريب السعودية", titleEn: "Saudi Training Academy", description: "منصة Moodle لشركة تدريب", descriptionEn: "Moodle LMS for a corporate training company in Riyadh", img: "x", types: ["lms"], important: true },
    { title: "منصة الوزارة التعليمية", titleEn: "Ministry LMS", description: "منصة تعليمية حكومية", descriptionEn: "Government eLearning platform with 50,000 users", img: "x", types: ["lms"] },
    { title: "متجر الخليج", titleEn: "Gulf eCommerce Store", description: "متجر إلكتروني وتطبيق", descriptionEn: "Online store with Android and iOS apps", img: "x", types: ["ecommerce"] },
];
export const PROJECT_TITLES = PROJECTS.flatMap((p) => [p.title, p.titleEn]);

/** Every number the tools can legitimately return (plus approved facts). */
export const ALLOWED_NUMBERS = Array.from(new Set([
    ...LICENSES.flatMap((l) => [l.priceEgp, l.priceEgpMonthly, l.price, l.maxCourses ?? 0, l.maxTeachers ?? 0, l.storageGb ?? 0]),
    ...SERVICE_PLANS.map((p) => p.price),
    ...PRICE_RANGES.flatMap((r) => [r.minUsd, r.maxUsd]),
    150, 2013, 2026, 50_000, 365, 100, 200, 500, 1000, 2000, 5000, 20_000, // facts, durations and numbers visitors type back
]));

export const EVAL_CONFIG = {
    ...DEFAULT_CONFIG,
    version: 1,
    enabled: { web: true, whatsapp: false },
    dailyBudgetUsd: 100,
    // Always "open" so handoff wording doesn't depend on when the eval runs.
    workingHours: { days: [0, 1, 2, 3, 4, 5, 6], from: "00:00", to: "23:59", tz: "Africa/Cairo" },
};
