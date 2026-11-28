// GET /api/agent/conversations — the visitor's previous chats (widget history):
// the signed-in account's, else the ones from this browser's session.
import { visitorConversations } from "@/lib/agent/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    return Response.json(await visitorConversations(req), { headers: { "Cache-Control": "no-store" } });
}
