import { NextRequest, NextResponse } from "next/server";
// Academy control plane lives in MySQL (separate Prisma client), not the Mongo app DB.
import prisma from "@/lib/prismaMysql";
import { getCurrentUser } from "@/lib/auth";

const DOMAIN = process.env.SAAS_CLIENT_DOMAIN ?? "academy2026.nitg-eg.com";

// Is this client's academy live yet? We just ask the site itself: a 2xx/3xx
// means Apache + the container are serving → live; anything else → still being
// prepared. First time it goes live we persist status so the admin view reflects it.
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const slug = params.slug;
    const academy = await prisma.academy.findUnique({ where: { slug } });
    if (!academy) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (user.role !== "admin" && academy.ownerId !== user.id) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const url = `https://${slug}.${DOMAIN}`;
    let live = false;
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(url, { method: "GET", redirect: "follow", cache: "no-store", signal: ctrl.signal });
        clearTimeout(timer);
        live = res.ok;
    } catch {
        live = false;
    }

    // A suspended academy still serves a 200 notice page — don't let reachability
    // flip it back to "live". Only promote from the provisioning states.
    if (live && academy.status !== "live" && academy.status !== "suspended") {
        try { await prisma.academy.update({ where: { slug }, data: { status: "live" } }); } catch {}
    }
    return NextResponse.json({ slug, live, url });
}
