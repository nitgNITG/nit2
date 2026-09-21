// Store product adapter — everything nit2 does to the STORE provisioner
// (provisioning-store/provision-server.py) lives here, the way
// lib/provisionAcademy.ts owns the academy provisioner. Env:
//   STORE_PROVISION_URL     e.g. http://127.0.0.1:9098 (same box) or https://…/store-provision
//   STORE_PROVISION_SECRET  X-Provision-Secret for that service
//   STORE_CLIENT_DOMAIN     base domain: a store is https://<slug>.<domain>  (commerce.nitg-eg.com)
//
// All calls are short (15 s) and return a typed result instead of throwing:
// creation is queued on the provisioner and reported back step by step to
// POST /api/tenants/<slug>/progress, so nothing here waits for a build.
import prisma from "@/lib/prismaMysql";
import { serverMinFreePct, type HealthVerdict, type ServerHealth } from "@/lib/serverHealth";

export const STORE_PRODUCT = "store" as const;
export const STORE_DOMAIN = process.env.STORE_CLIENT_DOMAIN ?? "commerce.nitg-eg.com";

export function storeProvisioningConfigured(): boolean {
    return !!process.env.STORE_PROVISION_URL && !!process.env.STORE_PROVISION_SECRET;
}

export function storeLiveUrl(slug: string): string {
    return `https://${slug}.${STORE_DOMAIN}`;
}

export type StoreCallResult<T = any> =
    | { ok: true; status: number; data: T }
    | { ok: false; status: number; error: string; data?: any };

/** One HTTP call to the store provisioner. Never throws. */
export async function storeProvisionerCall<T = any>(
    path: string,
    init: { method?: "GET" | "POST" | "DELETE"; body?: unknown; timeoutMs?: number } = {},
): Promise<StoreCallResult<T>> {
    const base = process.env.STORE_PROVISION_URL;
    const secret = process.env.STORE_PROVISION_SECRET;
    if (!base || !secret) return { ok: false, status: 0, error: "store provisioner not configured" };
    const url = new URL(base);
    url.pathname = (url.pathname.replace(/\/$/, "") + path).replace(/\/{2,}/g, "/");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15_000);
    try {
        const res = await fetch(url.toString(), {
            method: init.method ?? (init.body ? "POST" : "GET"),
            headers: { "Content-Type": "application/json", "X-Provision-Secret": secret },
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
            cache: "no-store",
            signal: ctrl.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, status: res.status, error: String(data?.error ?? `HTTP ${res.status}`), data };
        return { ok: true, status: res.status, data: data as T };
    } catch (e: any) {
        return { ok: false, status: 0, error: e?.name === "AbortError" ? "timeout" : String(e?.message ?? e) };
    } finally {
        clearTimeout(timer);
    }
}

// ── Licence definition pushed into a store (store-api PlatformLicense) ────────
// Store plans keep their caps in License.limits (JSON) and toggles in
// License.features (JSON, {key: bool}); the academy-only columns (maxCourses,
// videoSource, …) are ignored. Shape = store-api's parseDefinition() input.
export type StoreLicenseRow = {
    name: string;
    durationDays: number;
    limits: unknown;
    features: unknown;
};

export const STORE_LIMIT_KEYS = ["products", "staff", "categories", "storage_mb"] as const;

export function storeLicenseDefinition(
    lic: StoreLicenseRow,
    opts?: { upgradable?: boolean },
): Record<string, unknown> {
    const rawLimits = (lic.limits && typeof lic.limits === "object" ? lic.limits : {}) as Record<string, unknown>;
    const limits: Record<string, number> = {};
    for (const k of STORE_LIMIT_KEYS) {
        const v = Number(rawLimits[k]);
        limits[k] = Number.isFinite(v) ? Math.trunc(v) : -1;
    }
    const feats = lic.features;
    const features = Array.isArray(feats)
        ? feats.filter((f): f is string => typeof f === "string")
        : feats && typeof feats === "object"
            ? Object.keys(feats as Record<string, unknown>).filter((k) => !!(feats as Record<string, unknown>)[k])
            : [];
    return {
        name: lic.name,
        durationdays: lic.durationDays,
        limits,
        features,
        upgradable: opts?.upgradable !== false,
    };
}

/** The `license` block of a /provision or /apply-license request. */
export function storeLicensePayload(
    lic: { key: string } & StoreLicenseRow,
    term: { subscribedAt: Date; validUntil: Date | null; upgradable?: boolean },
) {
    const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "").replace(/\/$/, "");
    return {
        tier: lic.key,
        definition: storeLicenseDefinition(lic, { upgradable: term.upgradable }),
        subscribed_at: term.subscribedAt.toISOString(),
        expires_at: term.validUntil ? term.validUntil.toISOString() : null,
        grace_days: Math.max(0, Number(process.env.LICENSE_GRACE_DAYS ?? 3) || 0),
        renew_url: base ? `${base}/account` : null,
    };
}

// ── Health gate (same rule as academies: unreachable or low disk blocks) ─────
export async function fetchStoreHealth(): Promise<ServerHealth | null> {
    const r = await storeProvisionerCall<ServerHealth>("/health", { timeoutMs: 8000 });
    return r.ok ? r.data : null;
}

export async function evaluateStoreHealth(): Promise<HealthVerdict> {
    const thresholdPct = await serverMinFreePct();
    if (!storeProvisioningConfigured()) {
        return { ok: false, reachable: false, reason: "not_configured", thresholdPct, freePct: null, health: null };
    }
    const health = await fetchStoreHealth();
    if (!health) return { ok: false, reachable: false, reason: "unreachable", thresholdPct, freePct: null, health: null };
    const freePct = health.disk?.free_pct ?? 0;
    if (freePct < thresholdPct) return { ok: false, reachable: true, reason: "low_disk", thresholdPct, freePct, health };
    return { ok: true, reachable: true, reason: null, thresholdPct, freePct, health };
}

// ── Requests ─────────────────────────────────────────────────────────────────
export type StoreProvisionRequest = {
    slug: string;
    name: string;
    name_ar?: string | null;
    owner: { email: string; name: string; locale: "ar" | "en"; password: string };
    store: {
        country?: string; currency?: string; timezone?: string; default_locale?: "ar" | "en";
        vat_rate?: number; prices_include_vat?: boolean;
        theme?: Record<string, unknown>; contact?: Record<string, unknown>; social?: Record<string, unknown>;
        seo_title?: string | null; seo_title_ar?: string | null;
        logo?: { filename: string; data_b64: string } | null;
    };
    license: ReturnType<typeof storeLicensePayload>;
    /** NIT support login inside the store (platform user, hidden from the merchant). */
    nit_admin?: { email: string; name: string; password: string } | null;
    image_tag?: string | null;
    /** Retry of a failed creation: the provisioner destroys the leftovers first, in the same job. */
    force?: boolean;
};

export const storeOps = {
    provision: (req: StoreProvisionRequest) =>
        storeProvisionerCall<{ ok: true; job: number; status: string; slug: string }>("/provision", { body: req }),
    status: (slug: string) => storeProvisionerCall(`/status/${slug}`),
    applyLicense: (slug: string, license: ReturnType<typeof storeLicensePayload>) =>
        storeProvisionerCall(`/apply-license/${slug}`, { body: license, timeoutMs: 60_000 }),
    suspend: (slug: string, suspended: boolean) =>
        storeProvisionerCall(`/suspend/${slug}`, { body: { suspended }, timeoutMs: 60_000 }),
    resetOwner: (slug: string, email?: string, platform = false) =>
        storeProvisionerCall<{ ok: boolean; password?: string; owner?: { email: string } }>(`/reset-owner/${slug}`, { body: email ? { email, ...(platform ? { platform: true } : {}) } : {}, timeoutMs: 60_000 }),
    updateImage: (slug: string, tag: string) => storeProvisionerCall(`/update-image/${slug}`, { body: { tag } }),
    /** (Re)issue the store's Let's Encrypt certificate (after the DNS record exists). Sync, up to 3 min. */
    issueTls: (slug: string) => storeProvisionerCall(`/tls/${slug}`, { body: {}, timeoutMs: 180_000 }),
    deprovision: (slug: string) => storeProvisionerCall(`/deprovision/${slug}`, { method: "DELETE" }),
    bindDomain: (slug: string, domain: string) => storeProvisionerCall(`/bind-domain/${slug}`, { body: { domain } }),
    unbindDomain: (slug: string) => storeProvisionerCall(`/unbind-domain/${slug}`, { body: {} }),
    domainStatus: (slug: string) => storeProvisionerCall(`/domain-status/${slug}`),
    usage: () => storeProvisionerCall("/usage"),
    health: fetchStoreHealth,
};

/** Push the CURRENT licence row of a store tenant (after a plan change / renewal). */
export async function pushStoreLicense(slug: string): Promise<StoreCallResult> {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return { ok: false, status: 404, error: "tenant not found" };
    const lic = await prisma.license.findUnique({ where: { key: tenant.tier } });
    if (!lic) return { ok: false, status: 404, error: `licence ${tenant.tier} not found` };
    const rank = await prisma.license.findMany({ where: { active: true, product: STORE_PRODUCT }, select: { key: true, active: true, order: true, priceEgp: true } });
    const { computeUpgradable } = await import("@/lib/licenseDefinition");
    return storeOps.applyLicense(slug, storeLicensePayload(lic, {
        subscribedAt: tenant.subscribedAt ?? new Date(),
        validUntil: tenant.validUntil,
        upgradable: computeUpgradable(tenant.tier, rank),
    }));
}

/** Auto-delete after the retention period (expiry cron): teardown + row + subscriptions. */
export async function deprovisionAndDeleteStore(slug: string): Promise<boolean> {
    const r = await storeOps.deprovision(slug);
    if (!r.ok) {
        console.error("[stores] auto-delete: deprovision request failed", slug, r.error);
        return false;
    }
    try {
        await prisma.tenant.delete({ where: { slug } });
        await prisma.subscription.updateMany({
            where: { tenantSlug: slug, status: { in: ["active", "past_due"] } },
            data: { status: "canceled", autoRenew: false, nextAttemptAt: null, lastError: "store auto-deleted" },
        }).catch(() => {});
        const { notifyTelegram } = await import("@/lib/telegram");
        await notifyTelegram(`🗑 Store auto-deleted (expired past retention): ${slug}`);
        return true;
    } catch (e) {
        console.error("[stores] auto-delete: row delete failed", slug, e);
        return false;
    }
}
