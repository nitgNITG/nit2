import { NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { decryptSecret, encryptSecret, credentialSecretConfigured } from "@/lib/secretBox";
import { STORE_PRODUCT, storeLiveUrl, storeOps } from "@/lib/products/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin only: the owner's temporary dashboard password (stored encrypted at
// creation / reset) and a reset that mints a new one through the store's CLI.
async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user) return { error: "unauthorized", status: 401 as const };
    if (user.role !== "admin") return { error: "forbidden", status: 403 as const };
    return null;
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
    const gate = await requireAdmin();
    if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const store = await prisma.tenant.findUnique({ where: { slug: params.slug } });
    if (!store || store.product !== STORE_PRODUCT) return NextResponse.json({ error: "not found" }, { status: 404 });
    const owner = store.ownerId ? await prisma.user.findUnique({ where: { id: store.ownerId }, select: { email: true } }) : null;
    const password = decryptSecret(store.adminPasswordEnc);
    return NextResponse.json({
        slug: store.slug, dashboardUrl: `${storeLiveUrl(store.slug)}/dashboard`,
        username: owner?.email ?? null, password, hasPassword: !!password,
        encryptionConfigured: credentialSecretConfigured(),
    });
}

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
    const gate = await requireAdmin();
    if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const store = await prisma.tenant.findUnique({ where: { slug: params.slug } });
    if (!store || store.product !== STORE_PRODUCT) return NextResponse.json({ error: "not found" }, { status: 404 });
    const r = await storeOps.resetOwner(params.slug);
    if (!r.ok || !r.data?.password) return NextResponse.json({ error: `reset failed: ${r.ok ? "no password returned" : r.error}` }, { status: 502 });
    await prisma.tenant.update({ where: { slug: params.slug }, data: { adminPasswordEnc: encryptSecret(r.data.password) } }).catch(() => {});
    return NextResponse.json({ ok: true, slug: params.slug, username: r.data.owner?.email ?? null, password: r.data.password });
}
