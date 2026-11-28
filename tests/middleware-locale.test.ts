import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import middleware from "@/middleware";

// The locale middleware decides where "/" sends a visitor, and remembers the
// language they picked. Bug (ClickUp E4): the site always opened in Arabic —
// an English browser, or a visitor who had switched to English, still got /ar.

const ORIGIN = "https://www.nitg-eg.com";

function visit(path: string, opts: { acceptLanguage?: string; cookie?: string } = {}) {
    const headers = new Headers();
    if (opts.acceptLanguage) headers.set("accept-language", opts.acceptLanguage);
    if (opts.cookie) headers.set("cookie", opts.cookie);
    return middleware(new NextRequest(`${ORIGIN}${path}`, { headers }));
}

function redirectPath(res: Response) {
    const location = res.headers.get("location");
    return location ? new URL(location).pathname : null;
}

describe("locale middleware — entry redirect from /", () => {
    it("sends an English browser to /en", () => {
        const res = visit("/", { acceptLanguage: "en-US,en;q=0.9" });
        expect(res.status).toBe(307);
        expect(redirectPath(res)).toBe("/en");
    });

    it("sends an Arabic browser to /ar", () => {
        expect(redirectPath(visit("/", { acceptLanguage: "ar-EG,ar;q=0.9,en;q=0.8" }))).toBe("/ar");
    });

    it("keeps Arabic as the default when there is no Accept-Language (crawlers)", () => {
        expect(redirectPath(visit("/"))).toBe("/ar");
    });

    it("falls back to Arabic for an unsupported language", () => {
        expect(redirectPath(visit("/", { acceptLanguage: "fr-FR,fr;q=0.9" }))).toBe("/ar");
    });

    it("prefers the language the visitor chose (NEXT_LOCALE cookie) over the browser", () => {
        expect(redirectPath(visit("/", { acceptLanguage: "ar", cookie: "NEXT_LOCALE=en" }))).toBe("/en");
    });

    it("ignores a tampered cookie value and uses the browser language", () => {
        expect(redirectPath(visit("/", { acceptLanguage: "en", cookie: "NEXT_LOCALE=xx" }))).toBe("/en");
    });
});

describe("locale middleware — explicit locale URLs", () => {
    it("never redirects a prefixed URL, whatever the browser language (indexable pages stay put)", () => {
        const res = visit("/ar/blog", { acceptLanguage: "en-US,en;q=0.9", cookie: "NEXT_LOCALE=en" });
        expect(res.headers.get("location")).toBeNull();
        expect(res.status).toBe(200);
    });

    it("remembers the language of the page the visitor opened (switcher → /en)", () => {
        const res = visit("/en/who-us", { acceptLanguage: "ar" });
        expect(res.cookies.get("NEXT_LOCALE")?.value).toBe("en");
    });

    it("updates the remembered language when the visitor switches back to Arabic", () => {
        const res = visit("/ar", { cookie: "NEXT_LOCALE=en" });
        expect(res.cookies.get("NEXT_LOCALE")?.value).toBe("ar");
    });
});
