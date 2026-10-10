import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMongo, makeMysql, resetAll } from "./helpers/memoryPrisma";

const { mongo, mysql, llm } = vi.hoisted(() => ({
    mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo>,
    mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
    llm: {
        stream: vi.fn(),
        complete: vi.fn(async () => ({ text: "Following up on your request — would a short call this week suit you?", toolCalls: [], stopReason: "end", usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: "claude-haiku-4-5", raw: [] })),
        estimateInputTokens: vi.fn(() => 100),
    },
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/agent/llm", async (orig) => ({ ...(await orig<object>()), getLlm: () => llm }));

import { cleanFollowupTest, seedFollowupTest, MARK } from "../scripts/seed-followup-test.mjs";
import { DEFAULT_CONFIG } from "@/lib/agent/config";
import { createFollowUpDrafts } from "@/lib/agent/followups";

const NOW = new Date("2026-10-12T07:00:00Z");
const cfg = { ...DEFAULT_CONFIG, dailyBudgetUsd: 5 };

beforeEach(() => {
    Object.assign(mongo, makeMongo());
    Object.assign(mysql, makeMysql());
    resetAll(mongo, mysql);
});

describe("scripts/seed-followup-test.mjs (phase 4 UAT data)", () => {
    it("gives the daily job exactly one case of each kind — and nothing for the visitor who said no", async () => {
        const ids = await seedFollowupTest(mongo, { phone: "+201001234567", email: "me@nitg-eg.com", now: NOW });
        expect(await createFollowUpDrafts(cfg, NOW)).toMatchObject({ due: 1, checkout: 1, abandoned: 1 });
        const drafts = await mongo.chatMessage.findMany({ where: { status: "draft" } });
        const by = Object.fromEntries(drafts.map((d) => [(d.followup as { contactId: string }).contactId, d.followup]));
        expect(by[ids.due]).toMatchObject({ kind: "due", channel: "email", to: "me@nitg-eg.com" });
        expect(by[ids.checkout]).toMatchObject({ kind: "checkout", channel: "whatsapp", to: "+201001234567", plan: "academy standard" });
        expect(by[ids.yes]).toMatchObject({ kind: "abandoned", channel: "whatsapp", locale: "ar" });
        expect(by[ids.no]).toBeUndefined();
    });

    it("--clean removes every test record (and lets the next seed draft again); real leads are untouched", async () => {
        const real = await mongo.contact.create({ data: { name: "Real lead", email: "r@x.com", subject: "Contact form", message: "hi" } });
        await seedFollowupTest(mongo, { phone: "+201001234567", now: NOW });
        await createFollowUpDrafts(cfg, NOW);
        expect(await cleanFollowupTest(mongo)).toMatchObject({ contacts: 4 });
        expect(await mongo.contact.count({ where: { subject: MARK } })).toBe(0);
        expect(await mongo.conversation.count()).toBe(0);
        expect(await mongo.chatMessage.count()).toBe(0);
        expect(await mongo.contact.findUnique({ where: { id: real.id as string } })).not.toBeNull();

        await seedFollowupTest(mongo, { phone: "+201001234567", now: NOW });
        expect(await createFollowUpDrafts(cfg, NOW)).toMatchObject({ due: 1, checkout: 1, abandoned: 1 });
    });

    it("refuses a number without country code", async () => {
        await expect(seedFollowupTest(mongo, { phone: "01001234567", now: NOW })).rejects.toThrow(/country code/);
    });
});
