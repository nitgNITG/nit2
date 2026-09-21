// Creation gates shared by every product's create endpoint (the same checks, in
// the same order, as the academy route documented in the handbook §3):
// honeypot · signed-in · admin comp · verified e-mail · hourly IP burst · licence
// resolution · free quota · name/slug · daily IP cap. Each gate returns a ready
// NextResponse on refusal so the route stays a straight list of `if (r) return r`.
//
// The academy route still carries its own inline copy of these (pre-dating this
// module); /api/stores uses this one. Converging the academy route onto it is a
// separate, behaviour-neutral refactor.
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "@/lib/prismaMysql";
import type { SessionUser } from "@/lib/auth";
import { mailerConfigured } from "@/lib/mailer";
import { createAndSendOtp } from "@/lib/emailOtp";
import { settingOn, settingInt } from "@/lib/platformSettings";

export type Product = "academy" | "store";

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

// ── Per-product in-memory IP limiters (per instance; a soft abuse brake) ────
type Bucket = Map<string, { count: number; resetAt: number }>;
const hourly: Record<Product, Bucket> = { academy: new Map(), store: new Map() };
const daily: Record<Product, Bucket> = { academy: new Map(), store: new Map() };

function bump(bucket: Bucket, ip: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const e = bucket.get(ip);
    if (!e || now > e.resetAt) {
        bucket.set(ip, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (e.count >= limit) return false;
    e.count++;
    return true;
}

export function clientIp(req: Request): string {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Hourly burst cap: env <PRODUCT>S_RATE_LIMIT (academies: ACADEMIES_RATE_LIMIT). 0 disables. */
export function hourlyRateLimit(product: Product, ip: string): NextResponse | null {
    const envKey = product === "store" ? "STORES_RATE_LIMIT" : "ACADEMIES_RATE_LIMIT";
    const limit = Number(process.env[envKey] ?? 500);
    if (limit > 0 && !bump(hourly[product], ip, limit, 3_600_000)) {
        return NextResponse.json({ error: "محاولات كتير في وقت قصير، حاول بعد شوية." }, { status: 429 });
    }
    return null;
}

/** Daily per-IP creation cap: PlatformSetting <product>s_daily_ip_limit (default 5). */
export async function dailyIpLimit(product: Product, ip: string): Promise<NextResponse | null> {
    const key = product === "store" ? "stores_daily_ip_limit" : "academies_daily_ip_limit";
    const envKey = product === "store" ? "STORES_DAILY_IP_LIMIT" : "ACADEMIES_DAILY_IP_LIMIT";
    const limit = await settingInt(key, 5, envKey);
    if (limit > 0 && !bump(daily[product], ip, limit, 86_400_000)) {
        return NextResponse.json(
            { error: `وصلت للحد الأقصى للإنشاء اليوم (${limit}). حاول بكرة أو تواصل مع الدعم. / Daily creation limit reached (${limit}).`, errorcode: "daily_ip_limit" },
            { status: 429 },
        );
    }
    return null;
}

// ── Owner resolution (admin comp) ────────────────────────────────────────────
export type Owner = { id: string; email: string; name: string };
export type OwnerResolution =
    | { ok: true; owner: Owner; adminComp: boolean; createdOwnerPassword: string | null }
    | { ok: false; response: NextResponse };

/**
 * The signed-in user owns the tenant — unless an admin passes ownerId/ownerEmail
 * (+ ownerName/ownerPassword for a new user), in which case it is an admin comp:
 * created for that user, no payment, and the quota/e-mail/IP gates are skipped.
 */
export async function resolveOwner(user: SessionUser, body: any): Promise<OwnerResolution> {
    const self: Owner = { id: user.id, email: user.email, name: user.name ?? "" };
    if (user.role !== "admin" || !(body?.ownerId || body?.ownerEmail)) {
        return { ok: true, owner: self, adminComp: false, createdOwnerPassword: null };
    }
    let o: { id: string; email: string; name: string | null } | null = null;
    if (body?.ownerId) o = await prisma.user.findUnique({ where: { id: String(body.ownerId) }, select: { id: true, email: true, name: true } });
    if (!o && body?.ownerEmail) o = await prisma.user.findFirst({ where: { email: String(body.ownerEmail).toLowerCase() }, select: { id: true, email: true, name: true } });
    let createdOwnerPassword: string | null = null;
    if (!o) {
        const email = String(body?.ownerEmail ?? "").trim().toLowerCase();
        const oname = String(body?.ownerName ?? "").trim();
        if (!email || oname.length < 2) {
            return { ok: false, response: NextResponse.json({ error: "اختر مالكاً موجوداً أو اكتب بريد واسم مالك جديد." }, { status: 400 }) };
        }
        const provided = String(body?.ownerPassword ?? "");
        const pwd = provided.length >= 8 ? provided : crypto.randomBytes(9).toString("base64url");
        if (provided.length < 8) createdOwnerPassword = pwd;
        try {
            const created = await prisma.user.create({ data: { name: oname, email, password: await bcrypt.hash(pwd, 10), role: "client", emailVerified: true } });
            o = { id: created.id, email: created.email, name: created.name };
        } catch (e: any) {
            if (e?.code === "P2002") return { ok: false, response: NextResponse.json({ error: "البريد ده مسجّل بالفعل." }, { status: 409 }) };
            console.error("[tenants] admin owner create failed", e);
            return { ok: false, response: NextResponse.json({ error: "تعذّر إنشاء المستخدم." }, { status: 500 }) };
        }
    }
    return { ok: true, owner: { id: o.id, email: o.email, name: o.name ?? "" }, adminComp: true, createdOwnerPassword };
}

// ── Verified e-mail gate (resends the code so the client can verify at once) ─
export async function requireVerifiedEmail(user: SessionUser, locale: "ar" | "en"): Promise<NextResponse | null> {
    if (!(await settingOn("require_email_verification", "REQUIRE_EMAIL_VERIFICATION")) || !mailerConfigured()) return null;
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerified: true, name: true } });
    if (!dbUser || dbUser.emailVerified) return null;
    await createAndSendOtp(user.email.toLowerCase(), "verify", { name: dbUser.name ?? user.name ?? "", locale }).catch(() => {});
    return NextResponse.json(
        {
            error: "لازم تأكيد بريدك الإلكتروني الأول. / Please verify your email first.",
            errorcode: "email_unverified", needsVerify: true, email: user.email.toLowerCase(),
        },
        { status: 403 },
    );
}

// ── Licence resolution (per product) ─────────────────────────────────────────
export type ResolvedLicense = {
    lic: NonNullable<Awaited<ReturnType<typeof prisma.license.findFirst>>>;
    rank: { key: string; active: boolean; order: number; priceEgp: number }[];
};

/**
 * The plan the client picked (must belong to `product` and be active); falls
 * back to the cheapest self-serve plan of that product. Contact-sales plans are
 * refused unless an admin comps the tenant.
 */
export async function resolveLicense(
    product: Product, requestedKey: string, adminComp: boolean,
): Promise<{ ok: true; value: ResolvedLicense } | { ok: false; response: NextResponse }> {
    let lic = requestedKey
        ? await prisma.license.findFirst({ where: { key: requestedKey, active: true, product } })
        : null;
    if (!lic) {
        lic = await prisma.license.findFirst({ where: { active: true, contactSales: false, product }, orderBy: [{ price: "asc" }, { order: "asc" }] });
    }
    if (!lic) return { ok: false, response: NextResponse.json({ error: "لا توجد باقة متاحة لهذا المنتج." }, { status: 400 }) };
    if (lic.contactSales && !adminComp) {
        return { ok: false, response: NextResponse.json({ error: "هذه الباقة بالطلب — تواصل مع المبيعات. / This plan is available by request — please contact sales." }, { status: 400 }) };
    }
    const rank = await prisma.license.findMany({ where: { active: true, product }, select: { key: true, active: true, order: true, priceEgp: true } });
    return { ok: true, value: { lic, rank } };
}

// ── Free quota: PlatformSetting free_<product>_limit (default 1) per owner ───
export async function freeQuota(product: Product, ownerId: string, lic: { price: number }): Promise<NextResponse | null> {
    if (lic.price !== 0) return null;
    const key = product === "store" ? "free_store_limit" : "free_academy_limit";
    const row = await prisma.platformSetting.findUnique({ where: { key } });
    const limit = row ? parseInt(row.value, 10) : 1;
    if (!Number.isFinite(limit) || limit < 0) return null;
    const freeKeys = (await prisma.license.findMany({ where: { price: 0, product }, select: { key: true } })).map((l) => l.key);
    const owned = await prisma.tenant.count({ where: { ownerId, product, tier: { in: freeKeys } } });
    if (owned >= limit) {
        return NextResponse.json(
            { error: `وصلت للحد الأقصى المجاني (${limit}) لحسابك. اختر باقة مدفوعة لإضافة المزيد.`, errorcode: "free_quota" },
            { status: 403 },
        );
    }
    return null;
}

/** Name + slug shape. */
export function validateNameSlug(name: unknown, slug: unknown): { ok: true; name: string; slug: string } | { ok: false; response: NextResponse } {
    const cleanName = String(name ?? "").trim();
    const cleanSlug = String(slug ?? "").trim().toLowerCase();
    if (!cleanName) return { ok: false, response: NextResponse.json({ error: "الاسم مطلوب." }, { status: 400 }) };
    if (!SLUG_RE.test(cleanSlug)) {
        return { ok: false, response: NextResponse.json({ error: "المعرّف لازم يكون حروف إنجليزية صغيرة وأرقام وشرطات (3 إلى 40 حرف)." }, { status: 400 }) };
    }
    return { ok: true, name: cleanName, slug: cleanSlug };
}

/** Slug free across BOTH products (one namespace of subdomains per control plane). */
export async function slugTaken(slug: string): Promise<boolean> {
    const existing = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } }).catch(() => null);
    return !!existing;
}
