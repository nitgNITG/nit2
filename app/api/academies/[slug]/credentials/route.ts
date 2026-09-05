import { NextResponse } from "next/server";
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";
import { decryptSecret, credentialSecretConfigured } from "@/lib/secretBox";
import { triggerResetWelcome } from "@/lib/provisionAcademy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user) return { error: "unauthorized", status: 401 as const };
    if (user.role !== "admin") return { error: "forbidden", status: 403 as const };
    return null;
}

// GET /api/academies/<slug>/credentials — reveal the stored admin password (admin).
// Only the value WE generated is recoverable; if the owner later changed it in
// Moodle, this is stale (Moodle keeps only a hash) — use POST to reset.
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
    const gate = await requireAdmin();
    if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const academy = await prisma.academy.findUnique({ where: { slug: params.slug } });
    if (!academy) return NextResponse.json({ error: "not found" }, { status: 404 });

    const password = decryptSecret(academy.adminPasswordEnc);
    return NextResponse.json({
        slug: academy.slug,
        username: "admin",
        password,                                   // null if none stored / not decryptable
        hasPassword: !!password,
        encryptionConfigured: credentialSecretConfigured(),
    });
}

// POST /api/academies/<slug>/credentials — reset the admin password to a NEW
// generated value on the live academy, re-mint its app token, and store the new
// value encrypted. Returns the new password so the admin can copy it.
export async function POST(_req: Request, { params }: { params: { slug: string } }) {
    const gate = await requireAdmin();
    if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const academy = await prisma.academy.findUnique({ where: { slug: params.slug } });
    if (!academy) return NextResponse.json({ error: "not found" }, { status: 404 });

    const newPass = await triggerResetWelcome(params.slug);
    if (!newPass) {
        return NextResponse.json({ error: "reset failed (provisioning unreachable?)" }, { status: 502 });
    }
    // Store encrypted (best-effort; if CREDENTIAL_SECRET is unset it stays null
    // and the value is only shown once, right now, in the response).
    const { encryptSecret } = await import("@/lib/secretBox");
    try {
        await prisma.academy.update({
            where: { slug: params.slug },
            data: { adminPasswordEnc: encryptSecret(newPass) },
        });
    } catch (e) {
        console.error("[credentials] store new password failed", params.slug, e);
    }
    return NextResponse.json({ ok: true, slug: params.slug, username: "admin", password: newPass });
}
