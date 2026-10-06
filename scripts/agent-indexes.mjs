// Creates the MongoDB TTL indexes the AI agent relies on (SRS §13.3, §13.16).
// Prisma can't declare TTL indexes, and `prisma db push` DROPS indexes it doesn't
// know — so `npm run mongo:push` runs this right after the push. Idempotent.
//
//   node scripts/agent-indexes.mjs
import { PrismaClient } from "@prisma/client";

const DAY = 24 * 3600;
const TTL = [
    { collection: "AgentSession", key: { lastSeenAt: 1 }, name: "ttl_lastSeenAt_30d", expireAfterSeconds: 30 * DAY },
    { collection: "ToolAudit", key: { createdAt: 1 }, name: "ttl_createdAt_180d", expireAfterSeconds: 180 * DAY },
    { collection: "IdempotencyRecord", key: { createdAt: 1 }, name: "ttl_createdAt_7d", expireAfterSeconds: 7 * DAY },
    { collection: "RateLimitBucket", key: { expiresAt: 1 }, name: "ttl_expiresAt", expireAfterSeconds: 0 },
    { collection: "AgentUsageEvent", key: { createdAt: 1 }, name: "ttl_createdAt_180d", expireAfterSeconds: 180 * DAY },
];

const prisma = new PrismaClient();
try {
    for (const ix of TTL) {
        // Prisma's own (non-TTL) index on the same key would clash with the TTL one; drop it first.
        const existing = await prisma.$runCommandRaw({ listIndexes: ix.collection }).catch(() => null);
        const batch = existing?.cursor?.firstBatch ?? [];
        for (const e of batch) {
            const sameKey = JSON.stringify(e.key) === JSON.stringify(ix.key);
            if (sameKey && e.name !== ix.name && e.expireAfterSeconds === undefined) {
                await prisma.$runCommandRaw({ dropIndexes: ix.collection, index: e.name });
                console.log(`dropped ${ix.collection}.${e.name} (replaced by TTL index)`);
            }
        }
        await prisma.$runCommandRaw({
            createIndexes: ix.collection,
            indexes: [{ key: ix.key, name: ix.name, expireAfterSeconds: ix.expireAfterSeconds }],
        });
        console.log(`ok ${ix.collection}.${ix.name} (expireAfterSeconds=${ix.expireAfterSeconds})`);
    }
} finally {
    await prisma.$disconnect();
}
