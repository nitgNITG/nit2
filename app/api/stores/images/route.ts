import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { storeProvisionerCall } from "@/lib/products/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stores/images (admin) — image tags the store host can run: on the
// registry (CI-pushed), built locally, and the current platform tag. Feeds the
// version picker on the admin Stores page.
export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const r = await storeProvisionerCall<{ registry: string; current: string; tags: { tag: string; remote: boolean; local: boolean }[] }>("/images", { timeoutMs: 20_000 });
    if (!r.ok) return NextResponse.json({ error: `provisioner: ${r.error}`, tags: [], current: null }, { status: 200 });
    return NextResponse.json(r.data);
}
