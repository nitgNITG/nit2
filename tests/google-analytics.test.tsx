// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import vm from "node:vm";
import { render, cleanup } from "@testing-library/react";

const { nav } = vi.hoisted(() => ({ nav: { pathname: "/en" as string | null } }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
// next/script only injects scripts inside a running Next app; stand it in with a plain
// tag that records what our component asked it to load.
vi.mock("next/script", () => ({
    default: ({ id, src, strategy, children }: { id?: string; src?: string; strategy?: string; children?: string }) => (
        <script data-testid="next-script" id={id} data-src={src} data-strategy={strategy}>{children}</script>
    ),
}));

import GoogleAnalytics from "@/app/[locale]/components/GoogleAnalytics";
import { CONSENT_DENIED_REGIONS, gaBootstrapScript, gaMeasurementId } from "@/lib/seoIntegrations";

const scripts = () => Array.from(document.querySelectorAll<HTMLScriptElement>("[data-testid=next-script]"));
const gaDisabled = (id: string) => (window as unknown as Record<string, unknown>)[`ga-disable-${id}`];

beforeEach(() => {
    nav.pathname = "/en";
});
afterEach(() => cleanup());

describe("GoogleAnalytics", () => {
    it("loads gtag.js after hydration with the consent defaults and config first", () => {
        render(<GoogleAnalytics measurementId="G-ABC123XYZ" />);
        const [boot, lib] = scripts();
        expect(boot.id).toBe("ga4-consent-config");
        expect(boot.dataset.strategy).toBe("afterInteractive");
        expect(boot.textContent).toContain("gtag('config',\"G-ABC123XYZ\")");
        expect(lib.dataset.src).toBe("https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ");
        expect(lib.dataset.strategy).toBe("afterInteractive");
        expect(gaDisabled("G-ABC123XYZ")).toBe(false);
    });

    it.each([undefined, "", "   ", "UA-12345-1", "G-<script>", "GTM-ABCD"])("renders nothing for measurement id %j", (id) => {
        const { container } = render(<GoogleAnalytics measurementId={id} />);
        expect(container.innerHTML).toBe("");
        expect(scripts()).toHaveLength(0);
    });

    it.each(["/ar/dashboard", "/en/dashboard/contacts", "/ar/account", "/en/payment/callback"])(
        "does not load on the private page %s — and switches GA off if it was already loaded",
        (path) => {
            nav.pathname = path;
            const { container } = render(<GoogleAnalytics measurementId="G-PRIV4TE1" />);
            expect(container.innerHTML).toBe("");
            expect(gaDisabled("G-PRIV4TE1")).toBe(true);
        },
    );

    it("turns GA back on when the visitor navigates from a private page back to the site", () => {
        nav.pathname = "/en/dashboard";
        const { rerender } = render(<GoogleAnalytics measurementId="G-B4CKON" />);
        expect(gaDisabled("G-B4CKON")).toBe(true);
        nav.pathname = "/en/blog";
        rerender(<GoogleAnalytics measurementId="G-B4CKON" />);
        expect(gaDisabled("G-B4CKON")).toBe(false);
        expect(scripts()).toHaveLength(2);
    });

    it("still loads on a public page whose name merely contains a private word", () => {
        nav.pathname = "/en/blog/payment-gateways-in-egypt";
        render(<GoogleAnalytics measurementId="G-ABC123XYZ" />);
        expect(scripts()).toHaveLength(2);
    });
});

describe("gaMeasurementId", () => {
    it("accepts G- ids (trimmed, upper-cased) and rejects anything else", () => {
        expect(gaMeasurementId(" g-abcd1234 ")).toBe("G-ABCD1234");
        expect(gaMeasurementId("G-'+alert(1)+'")).toBeNull();
        expect(gaMeasurementId(undefined)).toBeNull();
    });
});

describe("Consent Mode v2 bootstrap", () => {
    /** Runs the inline snippet the way the browser would and returns what it queued. */
    function runSnippet(id: string) {
        const ctx: Record<string, unknown> = {};
        ctx.window = ctx;
        vm.createContext(ctx);
        vm.runInContext(gaBootstrapScript(id), ctx);
        const queue = (ctx.dataLayer as ArrayLike<unknown>[]).map((args) => Array.from(args));
        return { queue, gtag: ctx.gtag };
    }

    it("queues consent defaults before js/config, as real Arguments objects gtag.js understands", () => {
        const { queue, gtag } = runSnippet("G-ABC123XYZ");
        expect(typeof gtag).toBe("function");
        expect(queue.map((a) => a.slice(0, 2))).toEqual([
            ["consent", "default"], ["consent", "default"], ["js", expect.anything()], ["config", "G-ABC123XYZ"],
        ]);
    });

    it("denies everything in the UK, EEA and Switzerland", () => {
        const [, , regional] = runSnippet("G-ABC123XYZ").queue[0] as [string, string, Record<string, unknown>];
        expect(regional).toMatchObject({
            analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
        });
        const region = regional.region as string[];
        for (const code of ["GB", "CH", "DE", "FR", "IE", "NO", "IS", "LI", "SE", "PL"]) expect(region).toContain(code);
        expect(region).toHaveLength(32); // EU-27 + IS/LI/NO + GB + CH
        expect(region).not.toContain("EG");
        expect(region).not.toContain("SA");
        expect([...CONSENT_DENIED_REGIONS]).toEqual(region);
    });

    it("elsewhere grants analytics only — every ad signal stays denied", () => {
        const [, , rest] = runSnippet("G-ABC123XYZ").queue[1] as [string, string, Record<string, unknown>];
        expect(rest).toEqual({ analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    });
});
