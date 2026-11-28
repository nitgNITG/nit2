import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { makeModel } from "./helpers/memoryPrisma";

const { mongo, authAdmin } = vi.hoisted(() => ({
    mongo: {} as Record<string, ReturnType<typeof import("./helpers/memoryPrisma").makeModel>>,
    authAdmin: vi.fn(),
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/predict", () => ({ authAdmin }));

import { POST, GET } from "@/app/api/contact/route";

const FLAG = {
    WHATSAPP_VERIFY_NUMBER: "201091568240",
    WHATSAPP_APP_SECRET: "app-secret",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify-token",
};
const flagOn = () => { for (const [k, v] of Object.entries(FLAG)) vi.stubEnv(k, v); };
const flagOff = () => { for (const k of Object.keys(FLAG)) vi.stubEnv(k, ""); };

// The route rate-limits 3 submits per IP; give every request its own IP.
let ipSeq = 0;
const post = (body: Record<string, unknown>) =>
    POST(new NextRequest("http://localhost/api/contact", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${++ipSeq}` },
    }));

const lead = {
    name: "Sara", email: "sara@acme-academy.com", phone: "+201001234567", subject: "Moodle",
    message: "We need a Moodle academy for 500 students", country: "eg", service: "moodle",
    sourcePage: "/ar/contact",
};

beforeEach(() => {
    mongo.contact = makeModel({ defaults: { score: 0, stage: "lead", status: "new", isReaded: false, waStatus: "none" } });
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/contact — WhatsApp verification off (default)", () => {
    beforeEach(flagOff);

    it("answers exactly as before and saves no verification fields", async () => {
        const res = await post(lead);
        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ message: "تم الارسال بنجاح" });
        const row = mongo.contact.rows[0];
        expect(row).toMatchObject({ name: "Sara", phone: "+201001234567", waStatus: "none" });
        expect(row.waCode).toBeUndefined();
    });

    it("does not apply the phone sanity check", async () => {
        const res = await post({ ...lead, phone: "+20501234567" });
        expect(res.status).toBe(201);
        expect(mongo.contact.rows).toHaveLength(1);
    });

    it("keeps the existing validation (missing field → 400)", async () => {
        const res = await post({ ...lead, phone: "" });
        expect(res.status).toBe(400);
        expect(mongo.contact.rows).toHaveLength(0);
    });
});

describe("POST /api/contact — WhatsApp verification on", () => {
    beforeEach(flagOn);

    it("saves the lead as pending with a fresh code and returns the wa.me link", async () => {
        const res = await post(lead);
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.message).toBe("تم الارسال بنجاح");
        expect(body.whatsappVerify.code).toMatch(/^NIT-[A-HJ-NP-Z2-9]{6}$/);
        const url = new URL(body.whatsappVerify.url);
        expect(url.origin + url.pathname).toBe("https://wa.me/201091568240");
        expect(url.searchParams.get("text")).toContain(body.whatsappVerify.code);

        const row = mongo.contact.rows[0];
        expect(row).toMatchObject({ waStatus: "pending", waCode: body.whatsappVerify.code, phone: "+201001234567" });
        expect(row.waNumber).toBeUndefined();
        expect(row.waVerifiedAt).toBeUndefined();
    });

    it("keeps scoring and the rest of the lead unchanged", async () => {
        await post({ ...lead, role: "owner", budget: "20to50k", timeline: "immediate" });
        const row = mongo.contact.rows[0];
        expect(row).toMatchObject({ email: "sara@acme-academy.com", service: "moodle", role: "owner", sourcePage: "/ar/contact" });
        expect(row.score).toBeGreaterThan(0);
        expect(["lead", "mql", "sql", "opportunity"]).toContain(row.stage);
    });

    it("issues a different code to every lead", async () => {
        const codes = new Set<string>();
        for (let i = 0; i < 5; i++) codes.add((await (await post(lead)).json()).whatsappVerify.code);
        expect(codes.size).toBe(5);
        expect(new Set(mongo.contact.rows.map((r) => r.waCode)).size).toBe(5);
    });

    it("writes the prefilled message in the visitor's language", async () => {
        const en = await (await post({ ...lead, locale: "en", sourcePage: "/en/contact" })).json();
        const ar = await (await post({ ...lead, locale: "ar" })).json();
        const fromPath = await (await post({ ...lead, sourcePage: "/en/get-quote" })).json();
        const text = (u: string) => new URL(u).searchParams.get("text")!;
        expect(text(en.whatsappVerify.url)).not.toMatch(/[؀-ۿ]/);
        expect(text(ar.whatsappVerify.url)).toMatch(/[؀-ۿ]/);
        expect(text(fromPath.whatsappVerify.url)).not.toMatch(/[؀-ۿ]/);
        expect(mongo.contact.rows[0]).not.toHaveProperty("locale");
    });

    it.each([
        ["a Saudi mobile under the default +20", "+20501234567"],
        ["an Egyptian number with a bad prefix", "+201301234567"],
        ["a too-short Saudi number", "+96650123"],
        ["a UAE landline", "+97141234567"],
        ["a 5-digit number", "12345"],
        ["letters", "+20abcdefghij"],
    ])("rejects %s with 400 and saves nothing", async (_label, phone) => {
        const res = await post({ ...lead, phone });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.message).toBeTruthy();
        expect(body.code).toBe("invalid_phone");
        expect(mongo.contact.rows).toHaveLength(0);
    });

    it.each(["+2001001234567", "+966 50 123 4567", "+971501234567", "+447700900123", "+962791234567", "+٢٠١٠٠١٢٣٤٥٦٧"])(
        "accepts the real-world number %s", async (phone) => {
            expect((await post({ ...lead, phone })).status).toBe(201);
        },
    );

    it("still fakes success for the honeypot without saving or issuing a code", async () => {
        const res = await post({ ...lead, _hp: "bot" });
        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ message: "تم الارسال بنجاح" });
        expect(mongo.contact.rows).toHaveLength(0);
    });
});

describe("GET /api/contact — WhatsApp filter", () => {
    const get = (qs: string) => GET(new NextRequest(`http://localhost/api/contact?${qs}`));

    beforeEach(async () => {
        await mongo.contact.create({ data: { name: "A", waStatus: "verified", waNumber: "201001234567" } });
        await mongo.contact.create({ data: { name: "B", waStatus: "pending", waCode: "NIT-ABC234" } });
        await mongo.contact.create({ data: { name: "C" } });
    });

    it("lists only verified leads with waStatus=verified", async () => {
        authAdmin.mockResolvedValue(true);
        const { contacts } = await (await get("waStatus=verified")).json();
        expect(contacts.map((c: { name: string }) => c.name)).toEqual(["A"]);
    });

    it("ignores an unknown waStatus value", async () => {
        authAdmin.mockResolvedValue(true);
        const { contacts } = await (await get("waStatus=%24ne")).json();
        expect(contacts).toHaveLength(3);
    });

    it("refuses a non-admin", async () => {
        authAdmin.mockResolvedValue(false);
        expect((await get("waStatus=verified")).status).toBe(401);
    });
});
