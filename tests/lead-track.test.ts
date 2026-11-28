import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeModel } from "./helpers/memoryPrisma";

const { mongo, authAdmin } = vi.hoisted(() => ({
    mongo: {} as Record<string, ReturnType<typeof import("./helpers/memoryPrisma").makeModel>>,
    authAdmin: vi.fn(),
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/predict", () => ({ authAdmin }));

import { POST as track } from "@/app/api/track/route";
import { GET as leadEvents } from "@/app/api/dashboard/lead-events/route";

const post = (body: unknown, headers: Record<string, string> = {}) =>
    track(new Request("http://localhost/api/track", {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
        // sendBeacon with a string body sends text/plain — the route must not depend on the content type.
        headers: { "Content-Type": "text/plain;charset=UTF-8", ...headers },
    }) as never);

const valid = {
    type: "whatsapp_click", page: "/ar/our-services/moodle-lms", locale: "ar",
    referrerHost: "www.google.com", utmSource: "google", utmMedium: "cpc", utmCampaign: "moodle-eg",
};

beforeEach(() => {
    mongo.leadEvent = makeModel();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/track", () => {
    it("stores one event with only the whitelisted fields and answers 204", async () => {
        const res = await post({ ...valid, email: "x@y.z", ip: "1.2.3.4", userAgent: "UA" });
        expect(res.status).toBe(204);
        expect(await res.text()).toBe("");
        expect(mongo.leadEvent.rows).toHaveLength(1);
        const row = mongo.leadEvent.rows[0];
        expect(row).toMatchObject(valid);
        expect(row).not.toHaveProperty("email");
        expect(row).not.toHaveProperty("ip");
        expect(row).not.toHaveProperty("userAgent");
        expect(row.createdAt).toBeInstanceOf(Date);
    });

    it("accepts every lead type and leaves the optional fields out when absent", async () => {
        for (const type of ["whatsapp_click", "phone_click", "contact_submit", "quote_submit"]) {
            expect((await post({ type, page: "/en/contact", locale: "en" })).status).toBe(204);
        }
        expect(mongo.leadEvent.rows.map((r) => r.type)).toEqual(["whatsapp_click", "phone_click", "contact_submit", "quote_submit"]);
        expect(mongo.leadEvent.rows[0].referrerHost).toBeUndefined();
        expect(mongo.leadEvent.rows[0].utmSource).toBeUndefined();
    });

    it("drops a malformed referrer host and over-long utm values instead of storing junk", async () => {
        await post({ ...valid, referrerHost: "<script>alert(1)</script>", utmSource: "x".repeat(500) });
        const row = mongo.leadEvent.rows[0];
        expect(row.referrerHost).toBeUndefined();
        expect((row.utmSource as string).length).toBe(100);
    });

    it.each([
        ["unknown type", { ...valid, type: "page_view" }],
        ["missing type", { ...valid, type: undefined }],
        ["page without a leading slash", { ...valid, page: "https://evil.example/x" }],
        ["page with whitespace", { ...valid, page: "/ar/a b" }],
        ["page over 300 chars", { ...valid, page: "/" + "a".repeat(300) }],
        ["non-string page", { ...valid, page: 42 }],
        ["unknown locale", { ...valid, locale: "fr" }],
        ["missing locale", { ...valid, locale: undefined }],
    ])("rejects %s with 400 and stores nothing", async (_label, body) => {
        const res = await post(body);
        expect(res.status).toBe(400);
        expect(mongo.leadEvent.rows).toHaveLength(0);
    });

    it("accepts a page of exactly 300 chars", async () => {
        expect((await post({ ...valid, page: "/" + "a".repeat(299) })).status).toBe(204);
        expect(mongo.leadEvent.rows).toHaveLength(1);
    });

    it("rejects a body that is not JSON (or not an object) without storing", async () => {
        expect((await post("not json")).status).toBe(400);
        expect((await post("[1,2]")).status).toBe(400);
        expect((await post("null")).status).toBe(400);
        expect(mongo.leadEvent.rows).toHaveLength(0);
    });

    it("ignores a body over 2KB without storing it", async () => {
        const res = await post({ ...valid, pad: "x".repeat(2100) });
        expect(res.status).toBe(413);
        expect(mongo.leadEvent.rows).toHaveLength(0);
    });

    it("refuses a declared Content-Length over 2KB before reading the body", async () => {
        const res = await post(valid, { "Content-Length": "999999" });
        expect(res.status).toBe(413);
        expect(mongo.leadEvent.rows).toHaveLength(0);
    });

    it("still answers 204 when the database write fails, and logs it", async () => {
        mongo.leadEvent.create = vi.fn(async () => { throw new Error("Mongo down"); }) as never;
        const res = await post(valid);
        expect(res.status).toBe(204);
        expect(console.error).toHaveBeenCalled();
    });

    it("answers 204 when the request body itself breaks mid-read", async () => {
        const broken = new ReadableStream({ pull(c) { c.error(new Error("connection reset")); } });
        const res = await track(new Request("http://localhost/api/track", { method: "POST", body: broken, duplex: "half" } as RequestInit) as never);
        expect(res.status).toBe(204);
        expect(mongo.leadEvent.rows).toHaveLength(0);
        expect(console.error).toHaveBeenCalled();
    });
});

describe("GET /api/dashboard/lead-events", () => {
    const get = (qs = "") => leadEvents(new Request(`http://localhost/api/dashboard/lead-events${qs}`) as never);
    const seed = (type: string, locale: string, page: string, createdAt: Date) =>
        mongo.leadEvent.create({ data: { type, locale, page, createdAt } });

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("refuses an anonymous or non-admin caller with 401 and reveals no data", async () => {
        await seed("whatsapp_click", "ar", "/ar", new Date("2026-11-02T00:00:00Z"));
        authAdmin.mockResolvedValue(false);
        const res = await get();
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body).not.toHaveProperty("byMonth");
        expect(body).not.toHaveProperty("topPages");
    });

    it("counts events by month x type x locale and ranks the top pages, inside the window only", async () => {
        authAdmin.mockResolvedValue(true);
        await seed("whatsapp_click", "ar", "/ar/our-services/moodle-lms", new Date("2026-11-02T08:00:00Z"));
        await seed("whatsapp_click", "ar", "/ar/our-services/moodle-lms", new Date("2026-11-15T08:00:00Z"));
        await seed("whatsapp_click", "en", "/en", new Date("2026-11-03T08:00:00Z"));
        await seed("contact_submit", "ar", "/ar/contact", new Date("2026-11-04T08:00:00Z"));
        await seed("phone_click", "ar", "/ar/our-services/moodle-lms", new Date("2026-10-31T23:59:59Z"));
        await seed("quote_submit", "en", "/en/get-quote", new Date("2026-10-01T00:00:00Z"));
        // Outside a 2-month window (Oct + Nov 2026):
        await seed("whatsapp_click", "ar", "/ar/old", new Date("2026-09-30T23:59:59Z"));

        const res = await get("?months=2");
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.months).toBe(2);
        expect(body.since).toBe("2026-10-01T00:00:00.000Z");
        expect(body.total).toBe(6);
        expect(body.byMonth).toEqual([
            { month: "2026-11", type: "contact_submit", locale: "ar", count: 1 },
            { month: "2026-11", type: "whatsapp_click", locale: "ar", count: 2 },
            { month: "2026-11", type: "whatsapp_click", locale: "en", count: 1 },
            { month: "2026-10", type: "phone_click", locale: "ar", count: 1 },
            { month: "2026-10", type: "quote_submit", locale: "en", count: 1 },
        ]);
        expect(body.topPages[0]).toEqual({
            page: "/ar/our-services/moodle-lms", count: 3, byType: { whatsapp_click: 2, phone_click: 1 },
        });
        expect(body.topPages.map((p: { page: string }) => p.page)).toEqual([
            "/ar/our-services/moodle-lms", "/ar/contact", "/en", "/en/get-quote",
        ]);
        expect(body.topPages.map((p: { page: string }) => p.page)).not.toContain("/ar/old");
    });

    it("defaults to 6 months and clamps a silly months value", async () => {
        authAdmin.mockResolvedValue(true);
        expect((await (await get()).json()).months).toBe(6);
        expect((await (await get("?months=999")).json()).months).toBe(24);
        expect((await (await get("?months=abc")).json()).months).toBe(6);
        const empty = await (await get("?months=0")).json();
        expect(empty).toMatchObject({ months: 1, since: "2026-11-01T00:00:00.000Z", total: 0, byMonth: [], topPages: [] });
    });
});
