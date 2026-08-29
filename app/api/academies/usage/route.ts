import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchAcademyUsage } from "@/lib/provisionAcademy";

// Per-academy moodledata storage usage (bytes) + host disk headroom, proxied
// from server B's provisioning service. Admin-only. Best-effort: returns empty
// data (not an error) if server B is unreachable, so the dashboard degrades
// gracefully to "—" instead of failing to load.
export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const usage = await fetchAcademyUsage();
    return NextResponse.json(
        usage ?? { academies: {}, host_disk_pct: 0, host_free_bytes: 0 },
    );
}
