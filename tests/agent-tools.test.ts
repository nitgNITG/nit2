import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMongo, makeMysql, resetAll } from "./helpers/memoryPrisma";

const { mongo, mysql, alertAdmins, notifyTelegram, llm } = vi.hoisted(() => ({
    mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo>,
    mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
    alertAdmins: vi.fn(),
    notifyTelegram: vi.fn(),
    llm: { stream: vi.fn(), complete: vi.fn(), estimateInputTokens: vi.fn(() => 100) },
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins, supportWhatsapp: async () => "+201000000000" }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/agent/llm", async (orig) => ({ ...(await orig<object>()), getLlm: () => llm }));

import { DEFAULT_CONFIG, type AgentConfig } from "@/lib/agent/config";
import { executeTool, llmToolDefs, toolsFor } from "@/lib/agent/tools/registry";
import { pickPlan } from "@/lib/agent/tools/sales/catalog";
import type { ToolContext } from "@/lib/agent/tools/types";
import { computeLeadScore } from "@/utils/leadScore";

const CFG: AgentConfig = { ...DEFAULT_CONFIG, dailyBudgetUsd: 5, version: 3 };
let convId: string;
let ctx: ToolContext;
let n = 0;
const call = (name: string, input: unknown, id = `tu_${++n}`) => executeTool(ctx, name, input, id);
const runAfterTurn = async () => { for (const t of ctx.afterTurn.splice(0)) await t(); };

beforeEach(async () => {
    Object.assign(mongo, makeMongo());
    Object.assign(mysql, makeMysql());
    resetAll(mongo, mysql);
    vi.clearAllMocks();
    llm.complete.mockResolvedValue({
        text: '{"summary":"Saudi training company needs an LMS.","nextAction":"CALL_TODAY"}', toolCalls: [], stopReason: "end",
        usage: { inputTokens: 100, outputTokens: 30, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: "claude-haiku-4-5", raw: [],
    });
    const conv = await mongo.conversation.create({
        data: { status: "open", locale: "en", assignedTo: null, utmSource: "google", utmMedium: "cpc", utmCampaign: "moodle-eg", sourcePage: "/en/pricing" },
    });
    convId = conv.id as string;
    await mongo.chatMessage.create({ data: { conversationId: convId, role: "visitor", content: "We are a Saudi training company and need an LMS" } });
    ctx = {
        conversationId: convId, turnId: "turn-1", mode: "sales", channel: "web", locale: "en", userId: null, sessionId: null,
        config: CFG, now: new Date("2026-10-05T12:00:00Z"), actions: [], handoff: null, afterTurn: [],
    };
    for (const l of [
        { key: "demo", name: "Demo", priceEgp: 0, maxCourses: 5, maxTeachers: 1, supportedApp: false, order: 0 },
        { key: "basic", name: "Basic", priceEgp: 6000, priceEgpMonthly: 600, maxCourses: 50, maxTeachers: 5, order: 1 },
        { key: "standard", name: "Standard", priceEgp: 12000, priceEgpMonthly: 1200, maxCourses: 300, maxTeachers: 20, features: { drm: true }, order: 2 },
        { key: "pro", name: "Professional", priceEgp: 0, contactSales: true, order: 3 },
        { key: "old", name: "Old", priceEgp: 1000, active: false, order: 4 },
        { key: "shop", name: "Shop", product: "store", priceEgp: 5000, order: 0 },
    ]) await mysql.license.create({ data: l });
});

describe("tool registry (§13.5, §13.6, NFR-2)", () => {
    it("exposes only the tools of the mode, with JSON schemas that forbid extra keys", () => {
        const names = toolsFor("sales").map((t) => t.name);
        expect(names).toContain("capture_lead");
        expect(toolsFor("support").map((t) => t.name)).not.toContain("capture_lead");
        const capture = llmToolDefs("sales").find((t) => t.name === "capture_lead")!;
        expect(capture.inputSchema.additionalProperties).toBe(false);
        expect(capture.inputSchema).not.toHaveProperty("$schema");
    });

    it("invalid input returns invalid_input to the model instead of throwing, and is audited", async () => {
        const r = await call("list_plans", { product: "spaceship" });
        expect(r).toMatchObject({ ok: false, code: "invalid_input" });
        const audit = await mongo.toolAudit.findFirst({ where: { tool: "list_plans" } });
        expect(audit).toMatchObject({ status: "error", errorCode: "invalid_input", turnId: "turn-1" });
    });

    it("unknown or other-mode tools are not_authorized", async () => {
        expect(await call("drop_database", {})).toMatchObject({ ok: false, code: "not_authorized" });
        ctx.mode = "support";
        expect(await call("capture_lead", { name: "x" })).toMatchObject({ ok: false, code: "not_authorized" });
    });
});

describe("list_plans (FR-S1, AC-02.1, AC-02.2, TS-13)", () => {
    it("returns only active plans of the product with prices exactly as stored", async () => {
        const r = await call("list_plans", { product: "academy" });
        expect(r.ok).toBe(true);
        const plans = (r as { data: { key: string; priceEgp: number; priceEgpMonthly: number }[] }).data;
        expect(plans.map((p) => p.key)).toEqual(["demo", "basic", "standard", "pro"]);
        expect(plans.find((p) => p.key === "standard")).toMatchObject({ priceEgp: 12000, priceEgpMonthly: 1200 });
        expect(ctx.actions).toEqual([{ type: "link", label: "Pricing page", url: "/en/pricing" }]);
    });

    it("an admin deactivating a plan removes it from the next answer", async () => {
        await mysql.license.updateMany({ where: { key: "basic" }, data: { active: false } });
        const r = await call("list_plans", { product: "academy" });
        expect((r as { data: { key: string }[] }).data.map((p) => p.key)).not.toContain("basic");
    });
});

describe("recommend_plan (FR-S2, AC-03.1, AC-03.2, TS-14)", () => {
    it("200 courses / 10 teachers / protected video → the lowest plan meeting all, naming the deciding limit", async () => {
        const r = await call("recommend_plan", { product: "academy", courses: 200, teachers: 10, needsDrm: true });
        const d = (r as { data: { key: string; reason: string } }).data;
        expect(d.key).toBe("standard");
        expect(d.reason).toMatch(/courses \(needs 200, allows 50\)/);
    });

    it("needs no plan meets → key null, reason custom (contact-sales plans are never recommended)", async () => {
        const r = await call("recommend_plan", { product: "academy", courses: 5000 });
        expect((r as { data: unknown }).data).toEqual({ key: null, reason: "custom" });
    });

    it("unlimited (-1) limits satisfy any need", () => {
        const plans = [{ key: "u", name: "U", priceEgp: 1, maxCourses: -1, maxTeachers: -1, storageGb: 1, supportedApp: true, contactSales: false, features: {} }];
        expect(pickPlan(plans as never, { courses: 1e6, teachers: 1e5 }).key).toBe("u");
    });
});

describe("start_checkout (FR-S6, AC-05.1, TS-15)", () => {
    it("returns a build-product link with the plan pre-selected and creates no payment", async () => {
        const r = await call("start_checkout", { product: "academy", tier: "standard", cycle: "annual" });
        expect(r).toEqual({ ok: true, data: { url: "/en/build-product?tier=standard&cycle=annual" } });
        expect(ctx.actions[0]).toMatchObject({ type: "link", url: "/en/build-product?tier=standard&cycle=annual" });
        const store = await call("start_checkout", { product: "store", tier: "shop", cycle: "annual" });
        expect((store as { data: { url: string } }).data.url).toBe("/en/build-product?product=store&tier=shop&cycle=annual");
    });

    it("refuses inactive, contact-sales and missing-monthly plans", async () => {
        expect(await call("start_checkout", { product: "academy", tier: "old", cycle: "annual" })).toMatchObject({ ok: false, code: "not_found" });
        expect(await call("start_checkout", { product: "academy", tier: "pro", cycle: "annual" })).toMatchObject({ ok: false, code: "validation_failed" });
        expect(await call("start_checkout", { product: "academy", tier: "demo", cycle: "monthly" })).toMatchObject({ ok: false, code: "validation_failed" });
        expect(await call("start_checkout", { product: "academy", tier: "standard", cycle: "annual", url: "https://evil.example" })).toMatchObject({ ok: false, code: "invalid_input" });
    });
});

describe("get_price_range (FR-S12, AC-25.1, AC-25.2, TS-34)", () => {
    it("returns the exact stored range, or available:false when none (or inactive)", async () => {
        await mongo.customPriceRange.create({ data: { category: "custom_lms", labelAr: "منصة مخصصة", labelEn: "Custom LMS", minUsd: 8000, maxUsd: 20000, notesEn: "Depends on scope", updatedBy: "u" } });
        await mongo.customPriceRange.create({ data: { category: "ecommerce_app", labelAr: "x", labelEn: "x", minUsd: 1, active: false, updatedBy: "u" } });
        expect(await call("get_price_range", { category: "custom_lms" })).toMatchObject({
            ok: true, data: { available: true, currency: "USD", min: 8000, max: 20000, notes: "Depends on scope" },
        });
        // A miss lists only ACTIVE ranges the model may retry with — never the inactive ecommerce_app.
        const lms = { category: "custom_lms", label: "Custom LMS" };
        expect(await call("get_price_range", { category: "custom_software" })).toEqual({ ok: true, data: { available: false, otherCategories: [lms] } });
        expect(await call("get_price_range", { category: "ecommerce_app" })).toEqual({ ok: true, data: { available: false, otherCategories: [lms] } });
        // With no active range at all, a miss is a bare available:false.
        await mongo.customPriceRange.updateMany({ data: { active: false } });
        expect(await call("get_price_range", { category: "custom_lms" })).toEqual({ ok: true, data: { available: false } });
    });
});

describe("get_price_range currency (USD + optional EGP, decided by the server)", () => {
    beforeEach(async () => {
        await mongo.customPriceRange.create({ data: { category: "custom_lms", labelAr: "منصة", labelEn: "Custom LMS", minUsd: 8000, maxUsd: 20000, minEgp: 400000, maxEgp: 1000000, updatedBy: "u" } });
        await mongo.customPriceRange.create({ data: { category: "website", labelAr: "موقع", labelEn: "Website", minUsd: 800, maxUsd: 5000, updatedBy: "u" } });
        await mongo.customPriceRange.create({ data: { category: "custom_software", labelAr: "نظام", labelEn: "Custom software", minUsd: 5000, minEgp: 250000, updatedBy: "u" } });
    });
    const setCountry = (country: string) => mongo.conversation.update({ where: { id: convId }, data: { qualification: { requirements: { country } } } });

    it("a visitor in Egypt gets the EGP range — exactly as entered, never converted", async () => {
        await setCountry("EG");
        expect(await call("get_price_range", { category: "custom_lms" })).toMatchObject({ ok: true, data: { currency: "EGP", min: 400000, max: 1000000 } });
    });

    it("a stated country outside Egypt gets USD, even if the model hints EGP", async () => {
        await setCountry("SA");
        expect(await call("get_price_range", { category: "custom_lms", currency: "EGP" })).toMatchObject({ data: { currency: "USD", min: 8000, max: 20000 } });
    });

    it("unknown country: the model's hint decides; no hint → USD", async () => {
        expect(await call("get_price_range", { category: "custom_lms", currency: "EGP" })).toMatchObject({ data: { currency: "EGP", min: 400000 } });
        expect(await call("get_price_range", { category: "custom_lms" })).toMatchObject({ data: { currency: "USD", min: 8000 } });
    });

    it("the saved lead's country counts too (lowercase in Contact)", async () => {
        const c = await mongo.contact.create({ data: { name: "L", email: "", subject: "s", message: "m", country: "eg" } });
        await mongo.conversation.update({ where: { id: convId }, data: { contactId: c.id } });
        expect(await call("get_price_range", { category: "custom_lms" })).toMatchObject({ data: { currency: "EGP" } });
    });

    it("falls back to USD when sales entered no EGP range; 'from' ranges say so", async () => {
        await setCountry("EG");
        const web = await call("get_price_range", { category: "website" });
        expect(web).toMatchObject({ data: { currency: "USD", min: 800, max: 5000 } });
        expect(JSON.stringify(web)).not.toMatch(/Egp|EGP/);
        expect(await call("get_price_range", { category: "custom_software" })).toMatchObject({ data: { currency: "EGP", min: 250000, startingFrom: true } });
        expect(await call("get_price_range", { category: "custom_lms", currency: "EUR" })).toMatchObject({ ok: false, code: "invalid_input" });
    });
});

describe("search_projects (FR-S11, AC-24.1, TS-33)", () => {
    it("returns only DB projects of the type that are aiVisible; empty when none", async () => {
        await mongo.project.create({ data: { title: "أكاديمية", titleEn: "Training Academy LMS", description: "منصة", descriptionEn: "Moodle platform for a training company", img: "x", types: ["lms"], links: [{ headerEn: "Site", headerAr: "الموقع", link: "https://academy.example" }] } });
        await mongo.project.create({ data: { title: "مخفي", titleEn: "Hidden LMS", description: "x", img: "x", types: ["lms"], aiVisible: false } });
        await mongo.project.create({ data: { title: "متجر", titleEn: "Shop", description: "x", img: "x", types: ["ecommerce"] } });

        const r = await call("search_projects", { type: "lms", query: "training", locale: "en" });
        const items = (r as { data: { title: string; url: string }[] }).data;
        expect(items).toEqual([expect.objectContaining({ title: "Training Academy LMS", url: "https://academy.example" })]);
        expect(await call("search_projects", { type: "games", query: "", locale: "en" })).toMatchObject({ ok: true, data: [] });
    });
});

describe("capture_lead (FR-S3–S5, FR-S10, FR-F5, AC-04.x)", () => {
    const visitor = { name: "Sara", phone: "+20 100 123 4567", email: "sara@acme.com" };

    it("TS-09 / AC-04.1: saves one Contact with sourcePage chat, the page UTM, v1 stage and v2 score", async () => {
        const r = await call("capture_lead", { ...visitor, consentContact: true });
        expect(r).toMatchObject({ ok: true, data: { saved: true } });
        const contacts = await mongo.contact.findMany();
        expect(contacts).toHaveLength(1);
        const c = contacts[0];
        expect(c).toMatchObject({ sourcePage: "chat", utmSource: "google", utmMedium: "cpc", utmCampaign: "moodle-eg", phone: "+201001234567", consentContact: true, conversationId: convId });
        expect(c.stage).toBe(computeLeadScore({ email: "sara@acme.com", phone: "+201001234567" }).stage);
        expect(c).toMatchObject({ score: 35, tier: "COLD", scoreVersion: 2, scoringConfigVersion: 3 });
        expect(c.consentAt).toEqual(ctx.now);
        expect((await mongo.conversation.findUnique({ where: { id: convId } }))!.contactId).toBe(c.id);
    });

    it("TS-10 / AC-04.2: a later call updates the same Contact and re-scores it", async () => {
        await call("capture_lead", visitor);
        await call("capture_lead", { requirements: { budgetMinUsd: 12_000 } });
        const contacts = await mongo.contact.findMany();
        expect(contacts).toHaveLength(1);
        expect(contacts[0]).toMatchObject({ budget: "5to20k", score: 70 });
    });

    it("TS-11 / AC-04.3: a mailinator address or a malformed phone saves nothing and asks again", async () => {
        expect(await call("capture_lead", { ...visitor, email: "x@mailinator.com" })).toMatchObject({ ok: false, code: "validation_failed", data: { reason: "invalid_email" } });
        expect(await call("capture_lead", { ...visitor, phone: "call me" })).toMatchObject({ ok: false, code: "validation_failed", data: { reason: "invalid_phone" } });
        expect(await mongo.contact.count()).toBe(0);
    });

    it("TS-31: a score or tier sent by the model is rejected by the schema", async () => {
        expect(await call("capture_lead", { ...visitor, score: 100 })).toMatchObject({ ok: false, code: "invalid_input" });
        expect(await call("capture_lead", { ...visitor, tier: "HOT" })).toMatchObject({ ok: false, code: "invalid_input" });
        expect(await mongo.contact.count()).toBe(0);
    });

    it("TS-32 / AC-23.2: stores structured requirements; unknown project type is a validation error", async () => {
        await call("capture_lead", {
            ...visitor, company: "Acme", orgType: "company",
            requirements: { projectType: "corporate_training", expectedUsers: 20000, mobileApps: true, paymentGateway: true, videoProtection: true, languages: ["ar", "en"] },
        });
        const c = (await mongo.contact.findFirst())!;
        expect(c.requirements).toMatchObject({ projectType: "corporate_training", expectedUsers: 20000, mobileApps: true, paymentGateway: true, videoProtection: true, languages: ["ar", "en"], orgType: "company" });
        expect(c.service).toBe("moodle");
        expect(await call("capture_lead", { requirements: { projectType: "rocket" } })).toMatchObject({ ok: false, code: "invalid_input" });
    });

    it("before contact details exist it keeps a draft and returns the server's next question", async () => {
        const r = await call("capture_lead", { requirements: { projectType: "online_courses" } });
        expect(r).toMatchObject({ ok: true, data: { saved: false, nextQuestion: { id: "expected_users" } } });
        expect(await mongo.contact.count()).toBe(0);
        await call("capture_lead", visitor);
        expect((await mongo.contact.findFirst())!.requirements).toMatchObject({ projectType: "online_courses" });
    });

    it("TS-43 / AC-04.4: a retried call with the same idempotency key returns the first result and writes nothing", async () => {
        const first = await call("capture_lead", visitor, "tu_same");
        const again = await call("capture_lead", { ...visitor, name: "Changed" }, "tu_same");
        expect(again).toMatchObject({ ok: false, code: "already_exists", data: (first as { data: unknown }).data });
        expect(await mongo.contact.count()).toBe(1);
        expect((await mongo.contact.findFirst())!.name).toBe("Sara");
    });

    it("TS-12 / TS-37 / AC-10.2: a HOT lead sends one Telegram+email alert with only business fields and the AI brief", async () => {
        await call("capture_lead", {
            ...visitor, orgType: "company", country: "SA",
            requirements: { projectType: "corporate_training", expectedUsers: 20000, mobileApps: true, paymentGateway: true, videoProtection: true, timeline: "1to3months", budgetMinUsd: 10000 },
        });
        await runAfterTurn();
        expect(alertAdmins).toHaveBeenCalledTimes(1);
        const [subject, body] = alertAdmins.mock.calls[0];
        expect(subject).toMatch(/HOT/);
        for (const s of ["Tier: HOT", "Country: sa", "Expected users: 20000", "Mobile apps: yes", "Video protection: yes", "Timeline: 1to3months", "Saudi training company", "CALL_TODAY", `/dashboard/conversations/${convId}`]) {
            expect(body).toContain(s);
        }
        expect(body).not.toMatch(/Sara|sara@acme\.com|1234567/);
        const c = (await mongo.contact.findFirst())!;
        expect(c).toMatchObject({ tier: "HOT", aiSummary: "Saudi training company needs an LMS.", nextAction: "CALL_TODAY" });

        // Saving the same HOT lead again does not alert again.
        await call("capture_lead", { pain: "We need it fast" });
        await runAfterTurn();
        expect(alertAdmins).toHaveBeenCalledTimes(1);
    });

    it("a brief with an off-list next action is rejected by the server", async () => {
        llm.complete.mockResolvedValueOnce({ text: '{"summary":"x","nextAction":"OFFER_DISCOUNT"}', toolCalls: [], stopReason: "end", usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, model: "claude-haiku-4-5", raw: [] });
        await call("capture_lead", visitor);
        await runAfterTurn();
        expect(llm.complete).toHaveBeenCalledTimes(1); // the brief really was generated…
        const c = (await mongo.contact.findFirst())!;
        expect(c.nextAction).toBeUndefined(); // …and its off-list value was refused
        expect(c.aiSummary).toBeUndefined();
    });

    it("TS-57: after a person takes over, writing tools return conflict and change nothing", async () => {
        await mongo.conversation.update({ where: { id: convId }, data: { status: "human", assignedTo: "staff-1" } });
        expect(await call("capture_lead", visitor)).toMatchObject({ ok: false, code: "conflict" });
        expect(await call("handoff_to_human", { reason: "x1", summary: "y1" })).toMatchObject({ ok: false, code: "conflict" });
        expect(await mongo.contact.count()).toBe(0);
    });
});

describe("handoff_to_human (FR-H1)", () => {
    it("moves the conversation to waiting_human, alerts once, and is idempotent", async () => {
        const r = await call("handoff_to_human", { reason: "asked for a person", summary: "Wants a custom LMS quote" }, "tu_h");
        expect(r).toMatchObject({ ok: true, data: { status: "waiting_human" } });
        expect(ctx.handoff).toMatchObject({ status: "waiting_human" });
        expect((await mongo.conversation.findUnique({ where: { id: convId } }))).toMatchObject({ status: "waiting_human", stateVersion: 1 });
        expect(notifyTelegram).toHaveBeenCalledTimes(1);
        expect(notifyTelegram.mock.calls[0][0]).toContain(`/dashboard/conversations/${convId}`);
    });
});
