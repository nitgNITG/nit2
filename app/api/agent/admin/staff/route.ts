// E22 — GET /api/agent/admin/staff?q=<email part> (admin). FR-C4.
// Without q: everyone who holds an agent permission. With q: search by email to grant one.
import { guard } from "@/lib/agent/admin";
import { listStaff } from "@/lib/agent/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const g = await guard("staff");
    if (g.res) return g.res;
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
    return Response.json({ items: await listStaff(q) });
}
