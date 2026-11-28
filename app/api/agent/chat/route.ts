// E2 — POST /api/agent/chat (public; agent_session cookie optional). Replies stream
// back as server-sent events. Logic: lib/agent/channels/web.ts.
import { handleChat } from "@/lib/agent/channels/web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    return handleChat(req);
}
