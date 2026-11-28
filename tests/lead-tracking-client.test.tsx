// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const { axios, toast } = vi.hoisted(() => ({
    axios: { post: vi.fn() },
    toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("axios", () => ({ default: axios }));
vi.mock("react-hot-toast", () => ({ default: toast }));
vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (k: string) => k }));

import { buildLeadPayload, leadTypeForHref, localeFromPath, trackLead } from "@/lib/leadTracking";
import LeadClickTracker from "@/app/[locale]/components/LeadClickTracker";
import SocialMedia from "@/app/[locale]/components/SocialMedia";
import ContactForm from "@/app/[locale]/components/ContactForm";

let beacon: ReturnType<typeof vi.fn>;
const sentPayloads = () => beacon.mock.calls.map(([url, body]) => ({ url, body: JSON.parse(body as string) }));
const setReferrer = (value: string) => Object.defineProperty(document, "referrer", { value, configurable: true });

beforeEach(() => {
    vi.clearAllMocks();
    beacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true, writable: true });
    setReferrer("");
    window.history.pushState({}, "", "/ar");
    // jsdom does not navigate; stop it complaining about external links we click (links only — not the submit button).
    document.addEventListener("click", preventNav);
});
const preventNav = (e: Event) => { if ((e.target as Element).closest?.("a[href]")) e.preventDefault(); };
afterEach(() => {
    cleanup();
    document.removeEventListener("click", preventNav);
});

describe("buildLeadPayload", () => {
    it("reads page, locale, referrer host and utm_* from the current URL", () => {
        const p = buildLeadPayload(
            "whatsapp_click",
            { pathname: "/en/our-services/moodle-lms", search: "?utm_source=google&utm_medium=cpc&utm_campaign=lms-ksa&x=1" },
            "https://www.google.com/search?q=moodle",
        );
        expect(p).toEqual({
            type: "whatsapp_click", page: "/en/our-services/moodle-lms", locale: "en",
            referrerHost: "www.google.com", utmSource: "google", utmMedium: "cpc", utmCampaign: "lms-ksa",
        });
    });

    it("leaves out what is missing and survives a garbage referrer", () => {
        const p = buildLeadPayload("phone_click", { pathname: "/ar/contact", search: "" }, "not a url");
        expect(p).toEqual({ type: "phone_click", page: "/ar/contact", locale: "ar" });
    });

    it("derives the locale from the path prefix, Arabic by default", () => {
        expect(localeFromPath("/en")).toBe("en");
        expect(localeFromPath("/en/blog/x")).toBe("en");
        expect(localeFromPath("/ar/blog")).toBe("ar");
        expect(localeFromPath("/english-course")).toBe("ar");
        expect(localeFromPath("/")).toBe("ar");
    });
});

describe("leadTypeForHref", () => {
    it.each([
        ["https://wa.me/201091568240", "whatsapp_click"],
        ["https://wa.me/+201091568240", "whatsapp_click"],
        ["https://api.whatsapp.com/send?phone=201091568240", "whatsapp_click"],
        ["https://web.whatsapp.com/send?phone=201091568240", "whatsapp_click"],
        ["whatsapp://send?phone=201091568240", "whatsapp_click"],
        ["tel:+201091568240", "phone_click"],
        ["TEL:+201091568240", "phone_click"],
        ["https://www.facebook.com/nitgEgypt", null],
        ["https://evil.example/?u=wa.me", null],
        ["/ar/contact", null],
        ["mailto:info@nitg-eg.com", null],
    ])("%s -> %s", (href, type) => {
        expect(leadTypeForHref(href)).toBe(type);
    });
});

describe("trackLead", () => {
    it("sends the payload to /api/track with sendBeacon", () => {
        window.history.pushState({}, "", "/en/get-quote?utm_source=fb");
        setReferrer("https://m.facebook.com/");
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        trackLead("quote_submit");
        vi.unstubAllGlobals();
        expect(fetchMock).not.toHaveBeenCalled(); // sent once, not twice
        expect(sentPayloads()).toEqual([{
            url: "/api/track",
            body: { type: "quote_submit", page: "/en/get-quote", locale: "en", referrerHost: "m.facebook.com", utmSource: "fb" },
        }]);
    });

    it("falls back to fetch with keepalive when sendBeacon is missing or refuses", () => {
        const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
        vi.stubGlobal("fetch", fetchMock);
        beacon.mockReturnValue(false);
        trackLead("phone_click");
        Object.defineProperty(navigator, "sendBeacon", { value: undefined, configurable: true, writable: true });
        trackLead("phone_click");
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe("/api/track");
        expect(init).toMatchObject({ method: "POST", keepalive: true });
        expect(JSON.parse(init.body as string)).toMatchObject({ type: "phone_click", page: "/ar", locale: "ar" });
        vi.unstubAllGlobals();
    });

    it("never throws, even when the transport does", () => {
        beacon.mockImplementation(() => { throw new Error("blocked"); });
        vi.stubGlobal("fetch", vi.fn(() => { throw new Error("offline"); }));
        expect(() => trackLead("whatsapp_click")).not.toThrow();
        vi.unstubAllGlobals();
    });
});

describe("LeadClickTracker", () => {
    it("records a whatsapp_click when the floating WhatsApp button is clicked", () => {
        window.history.pushState({}, "", "/ar/our-services/moodle-lms");
        render(<><LeadClickTracker /><SocialMedia /></>);
        fireEvent.click(screen.getByRole("link", { name: "WhatsApp" }));
        expect(sentPayloads().map((p) => p.body)).toEqual([
            { type: "whatsapp_click", page: "/ar/our-services/moodle-lms", locale: "ar" },
        ]);
    });

    it("records a click on an element inside a tel: link, and ignores other links", () => {
        render(<>
            <LeadClickTracker />
            <a href="tel:+201091568240"><span>Call us</span></a>
            <a href="https://www.facebook.com/nitgEgypt">Facebook</a>
        </>);
        fireEvent.click(screen.getByText("Call us"));
        fireEvent.click(screen.getByText("Facebook"));
        expect(sentPayloads().map((p) => p.body.type)).toEqual(["phone_click"]);
    });

    it("records a middle-click (open in new tab) but not a right-click", () => {
        render(<><LeadClickTracker /><a href="https://wa.me/201091568240">WA</a></>);
        fireEvent(screen.getByText("WA"), new MouseEvent("auxclick", { bubbles: true, button: 1 }));
        fireEvent(screen.getByText("WA"), new MouseEvent("auxclick", { bubbles: true, button: 2 }));
        expect(beacon).toHaveBeenCalledTimes(1);
    });

    it("does not count the admin's own clicks in the dashboard", () => {
        window.history.pushState({}, "", "/ar/dashboard/contacts");
        render(<><LeadClickTracker /><a href="https://wa.me/201000000000">WA lead</a></>);
        fireEvent.click(screen.getByText("WA lead"));
        expect(beacon).not.toHaveBeenCalled();
    });

    it("stops listening once unmounted", () => {
        const { unmount } = render(<LeadClickTracker />);
        unmount();
        const a = document.createElement("a");
        a.href = "https://wa.me/201091568240";
        document.body.appendChild(a);
        fireEvent.click(a);
        a.remove();
        expect(beacon).not.toHaveBeenCalled();
    });
});

describe("ContactForm lead tracking", () => {
    const fill = () => {
        const byName = (n: string) => document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${n}"]`)!;
        fireEvent.input(byName("name"), { target: { value: "Sara" } });
        fireEvent.input(byName("email"), { target: { value: "sara@example.com" } });
        fireEvent.input(byName("phone"), { target: { value: "1001234567" } });
        fireEvent.input(byName("subject"), { target: { value: "Moodle" } });
        fireEvent.input(byName("message"), { target: { value: "Hello" } });
    };

    it("records contact_submit after a successful submit, with no personal data", async () => {
        window.history.pushState({}, "", "/en/contact");
        axios.post.mockResolvedValue({ data: { message: "Thanks" } });
        render(<ContactForm />);
        fill();
        fireEvent.click(screen.getByRole("button", { name: "btn" }));
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Thanks"));
        expect(sentPayloads().map((p) => p.body)).toEqual([{ type: "contact_submit", page: "/en/contact", locale: "en" }]);
        expect(JSON.stringify(sentPayloads())).not.toContain("sara");
    });

    it("records quote_submit when used on the get-quote page", async () => {
        window.history.pushState({}, "", "/ar/get-quote");
        axios.post.mockResolvedValue({ data: { message: "OK" } });
        render(<ContactForm leadType="quote_submit" />);
        fill();
        fireEvent.click(screen.getByRole("button", { name: "btn" }));
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(sentPayloads().map((p) => p.body.type)).toEqual(["quote_submit"]);
    });

    it("records nothing when the submit fails", async () => {
        axios.post.mockRejectedValue({ response: { data: { message: "Nope" } } });
        render(<ContactForm />);
        fill();
        fireEvent.click(screen.getByRole("button", { name: "btn" }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope"));
        expect(beacon).not.toHaveBeenCalled();
    });
});
