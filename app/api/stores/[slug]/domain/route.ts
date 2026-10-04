import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { validateDomain, dnsInstructions, verifyDnsPointsHere, isApex, type DomainZone } from "@/lib/customDomain";
import { STORE_DOMAIN, STORE_PRODUCT, storeOps } from "@/lib/products/store";
import { alertAdmins } from "@/lib/adminAlert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Custom domain for one store — mirror of /api/academies/[slug]/domain.
//   GET    → current domain + status (+ sync from the provisioner while verifying) + DNS instructions
//   POST   {domain} → set the intended domain (pending_dns)
//   PUT    → check DNS points here, then queue bind-domain.sh on the store provisioner
//   DELETE → unbind (back to <slug>.<STORE_CLIENT_DOMAIN>)
// The bind job also reports done/failed through /api/tenants/<slug>/progress.
// Owner of the store, or an admin.

// Stores live on the nit2 box, not server B: the expected IP is whatever the
// store's own subdomain resolves to (no fixed SERVER_PUBLIC_IP).
const ZONE: DomainZone = { base: STORE_DOMAIN, publicIp: (process.env.STORE_PUBLIC_IP ?? "").trim() || null };

async function loadOwned(slug: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "unauthorized", status: 401 as const };
    const store = await prisma.tenant.findUnique({ where: { slug } });
    if (!store || store.product !== STORE_PRODUCT) return { error: "not found", status: 404 as const };
    if (user.role !== "admin" && store.ownerId !== user.id) return { error: "forbidden", status: 403 as const };
    return { user, store };
}

function view(store: { slug: string; customDomain: string | null; domainStatus: string; domainError: string | null }) {
    const domain = store.customDomain;
    return {
        customDomain: domain,
        domainStatus: store.domainStatus,
        domainError: store.domainError,
        baseDomain: STORE_DOMAIN,
        subdomain: `${store.slug}.${STORE_DOMAIN}`,
        apex: domain ? isApex(domain) : null,
        instructions: domain ? dnsInstructions(domain, store.slug, ZONE) : null,
    };
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
    const r = await loadOwned(params.slug);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    let store = r.store;
    // Normally the progress callback settles this; the pull is the fallback.
    if (store.domainStatus === "verifying") {
        const st = await storeOps.domainStatus(params.slug);
        const state = st.ok ? String(st.data?.state ?? "") : "";
        if (state === "active" || state === "failed") {
            const domainError = state === "active" ? null : String(st.data?.error || "Binding failed.");
            store = await prisma.tenant.update({ where: { slug: params.slug }, data: { domainStatus: state, domainError } });
        }
    }
    return NextResponse.json(view(store));
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
    const r = await loadOwned(params.slug);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
    const v = validateDomain(String(body?.domain ?? ""));
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const clash = await prisma.tenant.findUnique({ where: { customDomain: v.domain } }).catch(() => null);
    if (clash && clash.slug !== params.slug) {
        return NextResponse.json({ error: "That domain is already in use by another tenant." }, { status: 409 });
    }
    const store = await prisma.tenant.update({
        where: { slug: params.slug },
        data: { customDomain: v.domain, domainStatus: "pending_dns", domainError: null },
    });
    return NextResponse.json(view(store));
}

export async function PUT(_req: NextRequest, { params }: { params: { slug: string } }) {
    const r = await loadOwned(params.slug);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    const store = r.store;
    if (!store.customDomain) return NextResponse.json({ error: "Set a domain first." }, { status: 400 });
    if (store.status !== "live") return NextResponse.json({ error: "The store must be live first." }, { status: 409 });

    // DNS must point here before certbot runs (a failed HTTP-01 counts against the rate limit).
    const dns = await verifyDnsPointsHere(store.customDomain, params.slug, ZONE);
    if (!dns.ok) {
        const updated = await prisma.tenant.update({ where: { slug: params.slug }, data: { domainStatus: "pending_dns", domainError: dns.detail } });
        return NextResponse.json({ ...view(updated), dns }, { status: 409 });
    }
    const q = await storeOps.bindDomain(params.slug, store.customDomain);
    if (!q.ok) return NextResponse.json({ error: `Provisioning service is unavailable — try again shortly. (${q.error})` }, { status: 503 });
    const updated = await prisma.tenant.update({
        where: { slug: params.slug },
        data: { domainStatus: "verifying", domainError: null, googleOauthAdded: false },
    });
    await alertAdmins(`🌐 Binding custom domain — ${store.customDomain} (store ${params.slug})`, `DNS verified (${dns.resolved.join(", ")}). vhost + certbot + PUBLIC_URL switch queued.`);
    return NextResponse.json(view(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
    const r = await loadOwned(params.slug);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    if (r.store.customDomain) {
        const q = await storeOps.unbindDomain(params.slug);
        if (!q.ok) console.error("[stores/domain] unbind request failed", params.slug, q.error);
    }
    const store = await prisma.tenant.update({
        where: { slug: params.slug },
        data: { customDomain: null, domainStatus: "none", domainError: null },
    });
    return NextResponse.json(view(store));
}
