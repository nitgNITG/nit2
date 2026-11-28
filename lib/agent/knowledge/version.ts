// knowledgeVersion (§13.12): bumped whenever plans, price ranges, FAQ/articles,
// projects or agent settings change. It is printed in the cached core prompt, so
// a bump changes the cached prefix and the next turn uses fresh knowledge.
import mysql from "@/lib/prismaMysql";

export const KNOWLEDGE_VERSION_KEY = "ai_agent_knowledge_version";

export async function getKnowledgeVersion(): Promise<number> {
    try {
        const row = await mysql.platformSetting.findUnique({ where: { key: KNOWLEDGE_VERSION_KEY } });
        const n = parseInt(row?.value ?? "", 10);
        return Number.isFinite(n) ? n : 0;
    } catch {
        return 0;
    }
}

export async function bumpKnowledgeVersion(): Promise<number> {
    const next = (await getKnowledgeVersion()) + 1;
    await mysql.platformSetting.upsert({
        where: { key: KNOWLEDGE_VERSION_KEY },
        create: { key: KNOWLEDGE_VERSION_KEY, value: String(next) },
        update: { value: String(next) },
    });
    return next;
}
