import { describe, it, expect, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
    whatsappVerifyConfig, newVerifyCode, verifyLink, extractVerifyCode, extractVerifyCodes, isValidSignature,
    isPlausiblePhone, isPlausibleLeadPhone, splitPhone, VERIFY_CODE_ALPHABET,
} from "@/lib/whatsappVerify";

const FLAG = {
    WHATSAPP_VERIFY_NUMBER: "201091568240",
    WHATSAPP_APP_SECRET: "app-secret",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify-token",
};

afterEach(() => vi.unstubAllEnvs());

describe("whatsappVerifyConfig", () => {
    it("is null unless all three env vars are set", () => {
        for (const missing of Object.keys(FLAG)) {
            for (const [k, v] of Object.entries(FLAG)) vi.stubEnv(k, k === missing ? "" : v);
            expect(whatsappVerifyConfig(), `without ${missing}`).toBeNull();
        }
    });

    it("returns the config, with the number reduced to digits", () => {
        for (const [k, v] of Object.entries(FLAG)) vi.stubEnv(k, v);
        vi.stubEnv("WHATSAPP_VERIFY_NUMBER", "+20 109 156 8240");
        expect(whatsappVerifyConfig()).toEqual({ number: "201091568240", appSecret: "app-secret", webhookVerifyToken: "verify-token" });
    });

    it("treats a number with no digits as not configured", () => {
        for (const [k, v] of Object.entries(FLAG)) vi.stubEnv(k, v);
        vi.stubEnv("WHATSAPP_VERIFY_NUMBER", "tbd");
        expect(whatsappVerifyConfig()).toBeNull();
    });
});

describe("newVerifyCode", () => {
    it("is NIT- plus 6 characters from the unambiguous alphabet", () => {
        expect(VERIFY_CODE_ALPHABET).not.toMatch(/[0O1I]/);
        for (let i = 0; i < 500; i++) {
            const code = newVerifyCode();
            expect(code).toMatch(/^NIT-[A-Z2-9]{6}$/);
            expect(code.slice(4)).not.toMatch(/[0O1I]/);
        }
    });

    it("does not repeat (crypto-random, 32^6 space)", () => {
        const codes = new Set(Array.from({ length: 2000 }, () => newVerifyCode()));
        expect(codes.size).toBe(2000);
    });

    it("uses every character of the alphabet", () => {
        const seen = new Set(Array.from({ length: 1000 }, () => newVerifyCode().slice(4)).join(""));
        expect(seen.size).toBe(VERIFY_CODE_ALPHABET.length);
    });
});

describe("verifyLink", () => {
    it("opens a chat with NIT's number and a prefilled Arabic message containing the code", () => {
        const url = new URL(verifyLink("NIT-ABC234", "ar", "201091568240"));
        expect(url.origin + url.pathname).toBe("https://wa.me/201091568240");
        const text = url.searchParams.get("text")!;
        expect(text).toContain("NIT-ABC234");
        expect(text).toMatch(/[؀-ۿ]/);
        expect(extractVerifyCode(text)).toBe("NIT-ABC234");
    });

    it("writes the message in English for the English site, fully URL-encoded", () => {
        const link = verifyLink("NIT-ABC234", "en", "201091568240");
        expect(link).not.toMatch(/\s/);
        const text = new URL(link).searchParams.get("text")!;
        expect(text).toContain("NIT-ABC234");
        expect(text).not.toMatch(/[؀-ۿ]/);
        expect(extractVerifyCode(text)).toBe("NIT-ABC234");
    });

    it("takes the number from the config when not given", () => {
        for (const [k, v] of Object.entries(FLAG)) vi.stubEnv(k, v);
        expect(verifyLink("NIT-ABC234", "ar")).toMatch(/^https:\/\/wa\.me\/201091568240\?text=/);
    });

    it("throws when the feature is off and no number is given", () => {
        expect(() => verifyLink("NIT-ABC234", "ar")).toThrow();
    });
});

describe("extractVerifyCode", () => {
    it.each([
        ["NIT-ABC234", "NIT-ABC234"],
        ["nit-abc234", "NIT-ABC234"],
        ["  NIT-ABC234  ", "NIT-ABC234"],
        ["NIT ABC234", "NIT-ABC234"],
        ["NIT - abc234", "NIT-ABC234"],
        ["NITABC234", "NIT-ABC234"],
        ["مرحباً، رمز التأكيد: NIT-ABC234 شكراً", "NIT-ABC234"],
        ["رمز التأكيدNIT-ABC234شكراً", "NIT-ABC234"],
        ["Hi N.I.T, my code is NIT-XYZ789.", "NIT-XYZ789"],
        ["line one\nNIT-HJKMNP\nline three", "NIT-HJKMNP"],
    ])("finds the code in %j", (text, code) => {
        expect(extractVerifyCode(text)).toBe(code);
    });

    it.each([
        ["", "empty"],
        ["Hello, I want a Moodle site", "no code"],
        ["NIT-ABC23", "too short"],
        ["NIT-ABC2345", "too long"],
        ["NIT-ABC0O1", "ambiguous characters are never issued"],
        ["UNIT-ABC234", "part of another word"],
    ])("returns null for %j (%s)", (text) => {
        expect(extractVerifyCode(text)).toBeNull();
    });

    it("returns null for non-strings", () => {
        expect(extractVerifyCode(undefined as unknown as string)).toBeNull();
        expect(extractVerifyCode(42 as unknown as string)).toBeNull();
    });

    it("prefers the code written as issued (NIT-XXXXXX) over a word that happens to follow 'NIT'", () => {
        // "PLEASE" is six letters of the code alphabet — it must not hide the real code.
        expect(extractVerifyCode("NIT please confirm NIT-ABC234")).toBe("NIT-ABC234");
        expect(extractVerifyCodes("NIT please confirm NIT-ABC234")).toEqual(["NIT-PLEASE", "NIT-ABC234"]);
        expect(extractVerifyCodes("NIT-ABC234 nit-abc234")).toEqual(["NIT-ABC234"]);
        expect(extractVerifyCodes("nothing here")).toEqual([]);
    });
});

describe("isValidSignature", () => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const sign = (b: string, secret = "app-secret") => "sha256=" + createHmac("sha256", secret).update(b).digest("hex");

    it("accepts Meta's sha256=<hex HMAC of the raw body>", () => {
        expect(isValidSignature(body, sign(body), "app-secret")).toBe(true);
        expect(isValidSignature(Buffer.from(body), sign(body), "app-secret")).toBe(true);
    });

    it("rejects a signature made with another secret, or over another body", () => {
        expect(isValidSignature(body, sign(body, "other"), "app-secret")).toBe(false);
        expect(isValidSignature(body + " ", sign(body), "app-secret")).toBe(false);
    });

    it.each([
        ["missing", null],
        ["empty", ""],
        ["no prefix", createHmac("sha256", "app-secret").update(body).digest("hex")],
        ["wrong algorithm", "sha1=" + createHmac("sha1", "app-secret").update(body).digest("hex")],
        ["truncated", sign(body).slice(0, -2)],
        ["not hex", "sha256=" + "z".repeat(64)],
    ])("rejects a %s header", (_label, header) => {
        expect(isValidSignature(body, header, "app-secret")).toBe(false);
    });

    it("rejects everything when the secret is empty", () => {
        expect(isValidSignature(body, "sha256=" + createHmac("sha256", "").update(body).digest("hex"), "")).toBe(false);
    });
});

describe("isPlausiblePhone", () => {
    it.each([
        ["eg", "1001234567"], ["eg", "1101234567"], ["eg", "1201234567"], ["eg", "1501234567"],
        ["eg", "01001234567"], // trunk 0 typed after +20
        ["eg", "201001234567"], // country code typed twice
        ["eg", "100 123 4567"], ["eg", "100-123-4567"],
        ["eg", "١٠٠١٢٣٤٥٦٧"], // Arabic-Indic digits from an Arabic keyboard
        ["sa", "501234567"], ["sa", "0501234567"], ["sa", "966501234567"], ["sa", "٥٠١٢٣٤٥٦٧"],
        ["ae", "501234567"], ["ae", "0551234567"],
        ["other", "4477009001"], ["other", "1234567"], ["other", "123456789012345"],
        [undefined, "96550012345"], ["qa", "33123456"], ["jo", "791234567"],
    ])("accepts %s %s", (country, digits) => {
        expect(isPlausiblePhone(country, digits)).toBe(true);
    });

    it.each([
        ["eg", "1301234567", "13x is not an Egyptian mobile prefix"],
        ["eg", "100123456", "one digit short"],
        ["eg", "10012345678", "one digit long"],
        ["eg", "223456789", "Cairo landline"],
        ["eg", "501234567", "a Saudi number under +20"],
        ["sa", "401234567", "not a 5x mobile"],
        ["sa", "50123456", "short"],
        ["ae", "41234567", "Dubai landline"],
        ["ae", "5012345678", "long"],
        ["other", "123456", "under 7 digits"],
        ["other", "1234567890123456", "over 15 digits"],
        ["other", "", "empty"],
        ["eg", "abcdefghij", "no digits"],
    ])("rejects %s %s (%s)", (country, digits) => {
        expect(isPlausiblePhone(country, digits)).toBe(false);
    });
});

describe("splitPhone / isPlausibleLeadPhone (the form's `${dialCode}${number}`)", () => {
    it("reads the country from the international prefix", () => {
        expect(splitPhone("+201001234567")).toEqual({ country: "eg", national: "1001234567" });
        expect(splitPhone("+966501234567")).toEqual({ country: "sa", national: "501234567" });
        expect(splitPhone("00971501234567")).toEqual({ country: "ae", national: "501234567" });
        expect(splitPhone("+962791234567")).toEqual({ country: "other", national: "962791234567" });
        expect(splitPhone("0501234567")).toEqual({ country: "other", national: "0501234567" });
    });

    it.each([
        "+201001234567", "+2001001234567", "+20 100 123 4567", "+966501234567", "+9660501234567",
        "+971501234567", "+962791234567", "+447700900123", "0501234567", "+٢٠١٠٠١٢٣٤٥٦٧",
    ])("accepts %s", (phone) => {
        expect(isPlausibleLeadPhone(phone)).toBe(true);
    });

    it.each([
        "+20501234567", // Saudi mobile typed with the default +20
        "+201301234567",
        "+966401234567",
        "+97141234567",
        "+12345",
        "phone",
        "",
    ])("rejects %s", (phone) => {
        expect(isPlausibleLeadPhone(phone)).toBe(false);
    });

    it("rejects non-strings", () => {
        expect(isPlausibleLeadPhone(undefined as unknown as string)).toBe(false);
        expect(isPlausibleLeadPhone(201001234567 as unknown as string)).toBe(false);
    });
});
