// One creation path for stores — used by the free route (POST /api/stores), the
// Kashier webhook (purpose new_store) and the admin retry. The caller has
// already run the gates (lib/tenants/gates.ts) and the health gate; this
// function only: generates + stores the owner password, asks the provisioner to
// queue the build, records the Tenant row (status "queued"), and alerts admins.
// The provisioner reports every step back to POST /api/tenants/<slug>/progress.
import prisma from "@/lib/prismaMysql";
import { generateAdminPassword, encryptSecret } from "@/lib/secretBox";
import { alertAdmins } from "@/lib/adminAlert";
import { notifyTelegram } from "@/lib/telegram";
import { formatHealth } from "@/lib/serverHealth";
import { computeUpgradable } from "@/lib/licenseDefinition";
import {
    STORE_PRODUCT, storeOps, storeLicensePayload, fetchStoreHealth, storeLiveUrl,
    type StoreProvisionRequest,
} from "@/lib/products/store";
import { nitAdminEmail as nitAdminEmailSetting } from "@/lib/storeSettings";

export type StoreSettingsInput = StoreProvisionRequest["store"];

export type CreateStoreInput = {
    slug: string;
    name: string;
    nameAr?: string | null;
    store: StoreSettingsInput;
    /** Licence row (product store). durationDays drives the term. */
    lic: { key: string; name: string; durationDays: number; limits: unknown; features: unknown };
    /** Active store licences, for the "upgradable" flag. */
    rank: { key: string; active: boolean; order: number; priceEgp: number }[];
    /** Term length in days (0 = never expires); monthly checkouts pass 30. */
    durationDays: number;
    owner: { id: string; email: string; name: string; locale: "ar" | "en" };
    /** Which Kashier mode the licence was paid in; null for free / admin comp. */
    licenseMode?: "live" | "test" | null;
    /** Retry: let the provisioner clean a half-created store before creating it again. */
    force?: boolean;
};

export type CreateStoreResult =
    | { ok: true; slug: string; job: number; url: string }
    | { ok: false; error: string; status: number };

/** Sanitise the merchant-facing settings block from a request body. */
export function sanitizeStoreSettings(raw: any): StoreSettingsInput {
    const s = raw && typeof raw === "object" ? raw : {};
    const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
    const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined);
    const out: StoreSettingsInput = {};
    const country = str(s.country, 2)?.toUpperCase(); if (country && /^[A-Z]{2}$/.test(country)) out.country = country;
    const currency = str(s.currency, 3)?.toUpperCase(); if (currency && /^[A-Z]{3}$/.test(currency)) out.currency = currency;
    const tz = str(s.timezone, 64); if (tz && /^[A-Za-z_]+\/[A-Za-z_]+$/.test(tz)) out.timezone = tz;
    if (s.default_locale === "en" || s.default_locale === "ar") out.default_locale = s.default_locale;
    if (typeof s.vat_rate === "number" && s.vat_rate >= 0 && s.vat_rate <= 100) out.vat_rate = s.vat_rate;
    if (typeof s.prices_include_vat === "boolean") out.prices_include_vat = s.prices_include_vat;
    const theme = obj(s.theme); if (theme) out.theme = theme;
    const contact = obj(s.contact); if (contact) out.contact = contact;
    const social = obj(s.social); if (social) out.social = social;
    const seo = str(s.seo_title, 191); if (seo) out.seo_title = seo;
    const seoAr = str(s.seo_title_ar, 191); if (seoAr) out.seo_title_ar = seoAr;
    const logo = obj(s.logo);
    if (logo && typeof logo.filename === "string" && typeof logo.data_b64 === "string" && logo.data_b64.length < 8_000_000) {
        out.logo = { filename: logo.filename.slice(0, 120), data_b64: logo.data_b64 };
    }
    return out;
}

export async function createStore(input: CreateStoreInput): Promise<CreateStoreResult> {
    const slug = input.slug;
    try {
        const existing = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
        if (existing) return { ok: false, error: "المعرّف ده مستخدم بالفعل، اختار غيره.", status: 409 };
    } catch (e) {
        console.warn("[stores] duplicate pre-check skipped (DB unavailable)", e);
    }

    const now = new Date();
    const validUntil = input.durationDays > 0 ? new Date(now.getTime() + input.durationDays * 86_400_000) : null;
    // nit2 generates the owner's temporary dashboard password so it can be stored
    // (encrypted) for recovery; the store forces a change on first login. The NIT
    // support login (like the academies' `admin`) gets its own random password,
    // stored encrypted in nitAdminPasswordEnc and never e-mailed.
    const ownerPassword = generateAdminPassword();
    const nitAdminPassword = generateAdminPassword();
    const nitAdminEmail = await nitAdminEmailSetting();

    const req: StoreProvisionRequest = {
        slug,
        name: input.name,
        name_ar: input.nameAr ?? null,
        owner: { email: input.owner.email, name: input.owner.name || input.owner.email.split("@")[0], locale: input.owner.locale, password: ownerPassword },
        store: input.store,
        license: storeLicensePayload(input.lic, { subscribedAt: now, validUntil, upgradable: computeUpgradable(input.lic.key, input.rank) }),
        nit_admin: { email: nitAdminEmail, name: "NIT Support", password: nitAdminPassword },
        ...(input.force ? { force: true } : {}),
    };

    const r = await storeOps.provision(req);
    if (!r.ok) {
        console.error("[stores] provision request failed", slug, r.status, r.error);
        if (r.status === 409) return { ok: false, error: "المعرّف ده مستخدم بالفعل على خادم المتاجر.", status: 409 };
        return { ok: false, error: "خادم المتاجر غير متاح حالياً، حاول تاني بعد قليل.", status: r.status === 0 ? 503 : 502 };
    }

    try {
        await prisma.tenant.create({
            data: {
                product: STORE_PRODUCT, name: input.name, slug, branch: null, status: "queued",
                tier: input.lic.key, ownerId: input.owner.id, subscribedAt: now, validUntil,
                licenseMode: input.licenseMode ?? null,
                adminPasswordEnc: encryptSecret(ownerPassword),
                nitAdminPasswordEnc: encryptSecret(nitAdminPassword),
                progressJson: { job: r.data.job, kind: "create", step: 0, total: 0, label: "Queued", at: now.toISOString() },
            },
        });
    } catch (e: any) {
        if (e?.code === "P2002") return { ok: false, error: "المعرّف ده مستخدم بالفعل، اختار غيره.", status: 409 };
        console.error("[stores] persist failed after provision request", e);
        await notifyTelegram(`⚠️ Store ${slug}: provisioning queued (job ${r.data.job}) but NOT recorded in the control plane — needs manual fix.`);
        return { ok: false, error: "تعذّر تسجيل المتجر، تواصل مع الدعم.", status: 500 };
    }

    // Best effort: the store is queued and recorded by now — never fail the
    // request over the admin notification.
    try {
        await alertAdmins(
            `🛒 New store: ${slug} ("${input.name}") — tier ${input.lic.key} · ${input.owner.email}`,
            formatHealth(await fetchStoreHealth(), "Store host health"),
        );
    } catch (e) {
        console.error("[stores] admin alert failed", slug, e);
    }
    return { ok: true, slug, job: r.data.job, url: storeLiveUrl(slug) };
}
