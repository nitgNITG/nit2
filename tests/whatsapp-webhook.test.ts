import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { makeModel } from "./helpers/memoryPrisma";

const { mongo } = vi.hoisted(() => ({
    mongo: {} as Record<string, ReturnType<typeof import("./helpers/memoryPrisma").makeModel>>,
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));

import { GET, POST } from "@/app/api/whatsapp/webhook/route";

const FLAG = {
    WHATSAPP_VERIFY_NUMBER: "201091568240",
    WHATSAPP_APP_SECRET: "app-secret",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify-token",
};
const flagOn = () => { for (const [k, v] of Object.entries(FLAG)) vi.stubEnv(k, v); };
const flagOff = () => { for (const k of Object.keys(FLAG)) vi.stubEnv(k, ""); };

const DAY = 24 * 60 * 60 * 1000;
const sign = (body: string, secret = FLAG.WHATSAPP_APP_SECRET) =>
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

/** A Cloud API `messages` webhook, shaped like Meta's. */
const payload = (messages: unknown[]) => ({
    object: "whatsapp_business_account",
    entry: [{
        id: "WABA_ID",
        changes: [{
            field: "messages",
            value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "201091568240", phone_number_id: "PNID" },
                contacts: [{ profile: { name: "Sara" }, wa_id: "966501234567" }],
                messages,
            },
        }],
    }],
});
const textMsg = (body: string, from = "966501234567") =>
    ({ from, id: "wamid.X", timestamp: "1764316800", type: "text", text: { body } });

const postRaw = (raw: string, signature: string | null = sign(raw)) =>
    POST(new NextRequest("http://localhost/api/whatsapp/webhook", {
        method: "POST",
        body: raw,
        headers: { "Content-Type": "application/json", ...(signature !== null ? { "X-Hub-Signature-256": signature } : {}) },
    }));
const post = (body: unknown) => postRaw(JSON.stringify(body));

let logs: string[];
beforeEach(() => {
    mongo.contact = makeModel({ defaults: { score: 0, stage: "lead", status: "new", isReaded: false, waStatus: "none" } });
    logs = [];
    const capture = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
    vi.spyOn(console, "log").mockImplementation(capture);
    vi.spyOn(console, "info").mockImplementation(capture);
    vi.spyOn(console, "warn").mockImplementation(capture);
    vi.spyOn(console, "error").mockImplementation(capture);
    flagOn();
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

const seed = (data: Record<string, unknown>) => mongo.contact.create({ data: { name: "Lead", phone: "+966501234567", ...data } });

describe("GET /api/whatsapp/webhook (subscription handshake)", () => {
    const get = (qs: string) => GET(new NextRequest(`http://localhost/api/whatsapp/webhook?${qs}`));

    it("echoes hub.challenge when the verify token matches", async () => {
        const res = await get("hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=1158201444");
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("1158201444");
    });

    it.each([
        ["a wrong token", "hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1"],
        ["no token", "hub.mode=subscribe&hub.challenge=1"],
        ["another mode", "hub.mode=unsubscribe&hub.verify_token=verify-token&hub.challenge=1"],
    ])("answers 403 to %s", async (_label, qs) => {
        const res = await get(qs);
        expect(res.status).toBe(403);
        expect(await res.text()).not.toContain("1");
    });

    it("answers 403 when the feature is off, even with the right token", async () => {
        flagOff();
        vi.stubEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "verify-token");
        expect((await get("hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=1")).status).toBe(403);
    });
});

describe("POST /api/whatsapp/webhook", () => {
    it("verifies the pending lead with that code and stores the sender's WhatsApp number", async () => {
        const target = await seed({ waStatus: "pending", waCode: "NIT-ABC234" });
        const other = await seed({ waStatus: "pending", waCode: "NIT-XYZ789" });

        const res = await post(payload([textMsg("مرحباً، رمز التأكيد: nit-abc234 شكراً")]));
        expect(res.status).toBe(200);

        const row = mongo.contact.rows.find((r) => r.id === target.id)!;
        expect(row.waStatus).toBe("verified");
        expect(row.waNumber).toBe("966501234567");
        expect(row.waVerifiedAt).toBeInstanceOf(Date);
        expect(row.waCode).toBeNull();
        expect(row.phone).toBe("+966501234567"); // the typed phone is kept as is

        const untouched = mongo.contact.rows.find((r) => r.id === other.id)!;
        expect(untouched).toMatchObject({ waStatus: "pending", waCode: "NIT-XYZ789" });
        expect(untouched.waNumber).toBeUndefined();
    });

    it("handles several messages and entries in one delivery", async () => {
        await seed({ waStatus: "pending", waCode: "NIT-ABC234" });
        await seed({ waStatus: "pending", waCode: "NIT-XYZ789" });
        const body = payload([textMsg("NIT-ABC234", "201001234567")]);
        body.entry.push(payload([textMsg("hello"), textMsg("NIT-XYZ789", "971501234567")]).entry[0]);
        expect((await post(body)).status).toBe(200);
        expect(mongo.contact.rows.map((r) => [r.waStatus, r.waNumber])).toEqual([
            ["verified", "201001234567"],
            ["verified", "971501234567"],
        ]);
    });

    it("finds the real code even when another 'NIT word' comes first", async () => {
        await seed({ waStatus: "pending", waCode: "NIT-ABC234" });
        await post(payload([textMsg("NIT please, NIT-ABC234")]));
        expect(mongo.contact.rows[0].waStatus).toBe("verified");
    });

    it("answers 401 and changes nothing when the signature is wrong or missing", async () => {
        await seed({ waStatus: "pending", waCode: "NIT-ABC234" });
        const raw = JSON.stringify(payload([textMsg("NIT-ABC234")]));
        expect((await postRaw(raw, sign(raw, "wrong-secret"))).status).toBe(401);
        expect((await postRaw(raw, null)).status).toBe(401);
        expect((await postRaw(raw.replace("966501234567", "201000000000"), sign(raw))).status).toBe(401);
        expect(mongo.contact.rows[0]).toMatchObject({ waStatus: "pending", waCode: "NIT-ABC234" });
    });

    it("answers 401 when the feature is off, even for a well-signed payload", async () => {
        await seed({ waStatus: "pending", waCode: "NIT-ABC234" });
        flagOff();
        vi.stubEnv("WHATSAPP_APP_SECRET", "app-secret");
        expect((await post(payload([textMsg("NIT-ABC234")]))).status).toBe(401);
        expect(mongo.contact.rows[0].waStatus).toBe("pending");
    });

    it("answers 200 and changes nothing for an unknown code", async () => {
        await seed({ waStatus: "pending", waCode: "NIT-ABC234" });
        expect((await post(payload([textMsg("NIT-ZZZZZZ")]))).status).toBe(200);
        expect(mongo.contact.rows[0]).toMatchObject({ waStatus: "pending", waCode: "NIT-ABC234" });
    });

    it("does not verify a code older than 7 days", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
        await seed({ waStatus: "pending", waCode: "NIT-PLD234" });
        vi.setSystemTime(new Date("2026-11-08T10:00:01Z")); // 7 days + 1 s later
        expect((await post(payload([textMsg("NIT-PLD234")]))).status).toBe(200);
        expect(mongo.contact.rows[0]).toMatchObject({ waStatus: "pending", waCode: "NIT-PLD234" });
    });

    it("still verifies a code just under 7 days old", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
        await seed({ waStatus: "pending", waCode: "NIT-NEW234" });
        vi.setSystemTime(new Date(Date.parse("2026-11-01T10:00:00Z") + 7 * DAY - 60_000));
        await post(payload([textMsg("NIT-NEW234")]));
        expect(mongo.contact.rows[0].waStatus).toBe("verified");
    });

    it("does not touch a lead that is already verified", async () => {
        const verifiedAt = new Date("2026-11-20T00:00:00Z");
        await seed({ waStatus: "verified", waCode: "NIT-ABC234", waNumber: "966501234567", waVerifiedAt: verifiedAt });
        await post(payload([textMsg("NIT-ABC234", "201000000000")]));
        expect(mongo.contact.rows[0]).toMatchObject({ waStatus: "verified", waNumber: "966501234567", waVerifiedAt: verifiedAt });
    });

    it("lets a code be used once only", async () => {
        await seed({ waStatus: "pending", waCode: "NIT-ABC234" });
        await post(payload([textMsg("NIT-ABC234", "966501234567")]));
        await post(payload([textMsg("NIT-ABC234", "201000000000")]));
        expect(mongo.contact.rows[0]).toMatchObject({ waStatus: "verified", waNumber: "966501234567" });
    });

    it.each([
        ["an image message", payload([{ from: "966501234567", id: "w", type: "image", image: { id: "m" } }])],
        ["a non-text message that carries a text field", payload([{ ...textMsg("NIT-ABC234"), type: "unsupported" }])],
        ["a delivery status", { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: "w", status: "read" }] } }] }] }],
        ["an empty object", {}],
        ["junk shapes", { entry: "x" }],
        ["a text message with a non-digit sender", payload([textMsg("NIT-ABC234", "not-a-number")])],
    ])("answers 200 to %s without changing anything", async (_label, body) => {
        await seed({ waStatus: "pending", waCode: "NIT-ABC234" });
        expect((await post(body)).status).toBe(200);
        expect(mongo.contact.rows[0]).toMatchObject({ waStatus: "pending", waCode: "NIT-ABC234" });
    });

    it("answers 200 to a well-signed body that is not JSON", async () => {
        expect((await postRaw("not json")).status).toBe(200);
    });

    it("answers 500 on a database error so Meta retries, and verifies on the retry", async () => {
        await seed({ waStatus: "pending", waCode: "NIT-ABC234" });
        const real = mongo.contact.updateMany;
        mongo.contact.updateMany = vi.fn().mockRejectedValueOnce(new Error("connection reset 966501234567")) as never;
        const body = payload([textMsg("NIT-ABC234")]);
        expect((await post(body)).status).toBe(500);
        expect(mongo.contact.rows[0].waStatus).toBe("pending");
        expect(logs.join("\n")).not.toContain("966501234567");
        mongo.contact.updateMany = real;
        expect((await post(body)).status).toBe(200);
        expect(mongo.contact.rows[0].waStatus).toBe("verified");
    });

    it("never logs the message text or the phone number", async () => {
        await seed({ waStatus: "pending", waCode: "NIT-ABC234" });
        await post(payload([textMsg("secret words NIT-ABC234", "966501234567"), textMsg("NIT-ZZZZZZ", "201234567890")]));
        const all = logs.join("\n");
        expect(all).not.toContain("secret words");
        expect(all).not.toContain("966501234567");
        expect(all).not.toContain("201234567890");
        expect(all).not.toContain("NIT-ABC234");
    });
});
