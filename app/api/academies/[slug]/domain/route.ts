import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import {
    validateDomain, dnsInstructions, verifyDnsPointsHere, baseDomain, isApex,
} from "@/lib/customDomain";
import { triggerBindDomain, triggerUnbindDomain, fetchDomainStatus } from "@/lib/provisionAcademy";
import { alertAdmins } from "@/lib/adminAlert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Custom-domain binding for one academy (Phase 2, owner self-serve).
//   GET    → current domain + status (+ live sync while verifying) + DNS instructions
//   POST   {domain}          → set the intended domain, return DNS instructions (pending_dns)
//   PUT    {action:"verify"} → check DNS points here, then trigger the bind on server B
//   DELETE                   → unbind (revert to the subdomain)
// Owner of the academy, or an admin.

async function loadOwned(slug: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "unauthorized", status: 401 as const };
    const academy = await prisma.tenant.findUnique({ where: { slug } });
    if (!academy) return { error: "not found", status: 404 as const };
    if (user.role !== "admin" && academy.ownerId !== user.id) return { error: "forbidden", status: 403 as const };
    return { user, academy };
}

function view(academy: { slug: string; customDomain: string | null; domainStatus: string; domainError: string | null }) {
    const domain = academy.customDomain;
    return {
        customDomain: domain,
        domainStatus: academy.domainStatus,
        domainError: academy.domainError,
        baseDomain: baseDomain(),
        subdomain: `${academy.slug}.${baseDomain()}`,
        apex: domain ? isApex(domain) : null,
        instructions: domain ? dnsInstructions(domain, academy.slug) : null,
    };
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
    const r = await loadOwned(params.slug);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    let academy = r.academy;

    // While a bind is in flight, sync the outcome server B recorded.
    if (academy.domainStatus === "verifying") {
        const st = await fetchDomainStatus(params.slug);
        if (st && st.state !== "verifying") {
            const domainStatus = st.state === "active" ? "active" : "failed";
            const domainError = st.state === "active" ? null : (st.error ?? "Binding failed.");
            academy = await prisma.tenant.update({ where: { slug: params.slug }, data: { domainStatus, domainError } });
            await alertAdmins(
                domainStatus === "active"
                    ? `🌐 Custom domain active — ${academy.customDomain} (${params.slug})`
                    : `⚠️ Custom domain FAILED — ${academy.customDomain} (${params.slug})`,
                domainStatus === "active" ? `${academy.customDomain} is now the canonical URL.` : (domainError ?? ""),
            );
        }
    }
    return NextResponse.json(view(academy));
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
    const r = await loadOwned(params.slug);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
    const v = validateDomain(String(body?.domain ?? ""));
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    // Refuse a domain already bound to a different academy.
    const clash = await prisma.tenant.findUnique({ where: { customDomain: v.domain } }).catch(() => null);
    if (clash && clash.slug !== params.slug) {
        return NextResponse.json({ error: "That domain is already in use by another academy." }, { status: 409 });
    }

    const academy = await prisma.tenant.update({
        where: { slug: params.slug },
        data: { customDomain: v.domain, domainStatus: "pending_dns", domainError: null },
    });
    return NextResponse.json(view(academy));
}

export async function PUT(_req: NextRequest, { params }: { params: { slug: string } }) {
    const r = await loadOwned(params.slug);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    const academy = r.academy;
    if (!academy.customDomain) return NextResponse.json({ error: "Set a domain first." }, { status: 400 });

    // 1) DNS must point here before we ask certbot (a failed HTTP-01 rate-limits us).
    const dns = await verifyDnsPointsHere(academy.customDomain, params.slug);
    if (!dns.ok) {
        const updated = await prisma.tenant.update({
            where: { slug: params.slug }, data: { domainStatus: "pending_dns", domainError: dns.detail },
        });
        return NextResponse.json({ ...view(updated), dns }, { status: 409 });
    }

    // 2) DNS is good → hand off to server B (vhost + certbot + canonical wwwroot).
    const sent = await triggerBindDomain(params.slug, academy.customDomain);
    if (!sent) {
        return NextResponse.json({ error: "Provisioning service is unavailable — try again shortly." }, { status: 503 });
    }
    const updated = await prisma.tenant.update({
        where: { slug: params.slug },
        // Binding changes the canonical URL → the Google OAuth redirect URI must be
        // re-added for the new domain, so re-arm that bookkeeping flag.
        data: { domainStatus: "verifying", domainError: null, googleOauthAdded: false },
    });
    await alertAdmins(
        `🌐 Binding custom domain — ${academy.customDomain} (${params.slug})`,
        `DNS verified (${dns.resolved.join(", ")}). certbot + canonical wwwroot in progress.`,
    );
    return NextResponse.json(view(updated));
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
    const r = await loadOwned(params.slug);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    await triggerUnbindDomain(params.slug);
    const academy = await prisma.tenant.update({
        where: { slug: params.slug },
        data: { customDomain: null, domainStatus: "none", domainError: null },
    });
    return NextResponse.json(view(academy));
}
