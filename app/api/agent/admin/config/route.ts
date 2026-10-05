// E11 — GET / E12 — PUT /api/agent/admin/config (admin). FR-C1, FR-C2.
// Every save carries the version it was based on; a stale save → 409.
import { apiError, ConfigSaveSchema, ConfigVersionConflict, getAgentConfig, saveAgentConfig } from "@/lib/agent";
import { guard } from "@/lib/agent/admin";
import { bumpKnowledgeVersion } from "@/lib/agent/knowledge/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const g = await guard("settings");
    if (g.res) return g.res;
    return Response.json(await getAgentConfig());
}

export async function PUT(req: Request) {
    const g = await guard("settings");
    if (g.res) return g.res;
    let json: unknown;
    try { json = await req.json(); } catch { return apiError(400, "invalid_body", "Body must be JSON."); }
    const parsed = ConfigSaveSchema.safeParse(json);
    if (!parsed.success) {
        const issues = parsed.error.issues.slice(0, 8).map((i) => ({ path: i.path.join("."), message: i.message }));
        return apiError(400, "invalid_body", "Some settings are invalid.", { issues });
    }
    try {
        const saved = await saveAgentConfig(parsed.data);
        await bumpKnowledgeVersion();
        return Response.json(saved);
    } catch (e) {
        if (e instanceof ConfigVersionConflict) {
            return apiError(409, "config_version_conflict", "Someone saved the settings after you opened them. Reload and apply your changes again.");
        }
        throw e;
    }
}
