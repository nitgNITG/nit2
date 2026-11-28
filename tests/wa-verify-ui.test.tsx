// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";

const { axios, toast, locale } = vi.hoisted(() => ({
    axios: { post: vi.fn(), get: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    toast: { success: vi.fn(), error: vi.fn() },
    locale: { value: "en" },
}));
vi.mock("axios", () => ({ default: axios }));
vi.mock("react-hot-toast", () => ({ default: toast }));
vi.mock("next-intl", () => ({ useLocale: () => locale.value, useTranslations: () => (k: string) => k }));

import ContactForm from "@/app/[locale]/components/ContactForm";
import LeadClickTracker from "@/app/[locale]/components/LeadClickTracker";
import ContactRows from "@/app/[locale]/dashboard/components/ContactRows";
import Contacts from "@/app/[locale]/dashboard/contacts/page";
import { useStore } from "@/lib/zustand";
import ar from "@/public/languages/ar.json";
import en from "@/public/languages/en.json";

const VERIFY = {
    code: "NIT-ABC234",
    url: "https://wa.me/201091568240?text=" + encodeURIComponent("Hello N.I.T — my code: NIT-ABC234"),
};

let beacon: ReturnType<typeof vi.fn>;
const preventNav = (e: Event) => { if ((e.target as Element).closest?.("a[href]")) e.preventDefault(); };
beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of Object.values(axios)) fn.mockReset(); // no queued *Once values leak between tests
    locale.value = "en";
    beacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true, writable: true });
    window.history.pushState({}, "", "/en/contact");
    document.addEventListener("click", preventNav);
});
afterEach(() => {
    cleanup();
    document.removeEventListener("click", preventNav);
});

// `n` varies the values: after the form's reset(), React ignores an input event that
// sets the same value it last saw, so a second identical fill would not register.
const fillAndSubmit = (n = 0) => {
    const byName = (k: string) => document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${k}"]`)!;
    fireEvent.input(byName("name"), { target: { value: `Sara ${n}` } });
    fireEvent.input(byName("email"), { target: { value: `sara${n}@example.com` } });
    fireEvent.input(byName("phone"), { target: { value: `100123456${n}` } });
    fireEvent.input(byName("subject"), { target: { value: `Moodle ${n}` } });
    fireEvent.input(byName("message"), { target: { value: `Hello there, a Moodle site ${n}` } });
    fireEvent.click(screen.getByRole("button", { name: "btn" }));
};

describe("ContactForm — WhatsApp verification panel", () => {
    it("shows the panel with a WhatsApp button and the code when the response includes whatsappVerify", async () => {
        axios.post.mockResolvedValue({ data: { message: "Thanks", whatsappVerify: VERIFY } });
        render(<ContactForm />);
        expect(screen.queryByText("waVerify.title")).toBeNull();
        fillAndSubmit();

        const panel = await screen.findByRole("region", { name: "waVerify.title" });
        const button = within(panel).getByRole("link", { name: /waVerify\.btn/ });
        expect(button.getAttribute("href")).toBe(VERIFY.url);
        expect(button.getAttribute("target")).toBe("_blank");
        expect(button.getAttribute("rel")).toContain("noopener");
        expect(within(panel).getByText("NIT-ABC234")).toBeTruthy();
        expect(toast.success).toHaveBeenCalledWith("Thanks");
    });

    it("sends the page locale so the prefilled message matches the visitor's language", async () => {
        axios.post.mockResolvedValue({ data: { message: "OK" } });
        render(<ContactForm />);
        fillAndSubmit();
        await waitFor(() => expect(axios.post).toHaveBeenCalled());
        expect(axios.post.mock.calls[0][1]).toMatchObject({ locale: "en", phone: "+201001234560" });
    });

    it("keeps today's success UI when the response has no whatsappVerify", async () => {
        axios.post.mockResolvedValue({ data: { message: "Thanks" } });
        render(<ContactForm />);
        fillAndSubmit();
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Thanks"));
        expect(screen.queryByRole("region", { name: "waVerify.title" })).toBeNull();
        expect(screen.queryByText("waVerify.btn")).toBeNull();
        expect(document.querySelector('a[href^="https://wa.me/"]')).toBeNull();
    });

    it("ignores a whatsappVerify whose url is not a wa.me link", async () => {
        axios.post.mockResolvedValue({ data: { message: "Thanks", whatsappVerify: { code: "NIT-ABC234", url: "javascript:alert(1)" } } });
        render(<ContactForm />);
        fillAndSubmit();
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(screen.queryByRole("region", { name: "waVerify.title" })).toBeNull();
    });

    it("hides the panel again when the visitor sends a second enquiry", async () => {
        axios.post.mockResolvedValueOnce({ data: { message: "Thanks", whatsappVerify: VERIFY } });
        axios.post.mockResolvedValueOnce({ data: { message: "Thanks again" } });
        render(<ContactForm />);
        fillAndSubmit();
        await screen.findByRole("region", { name: "waVerify.title" });
        await waitFor(() => expect((screen.getByRole("button", { name: "btn" }) as HTMLButtonElement).disabled).toBe(false));
        fillAndSubmit(1);
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Thanks again"));
        expect(screen.queryByRole("region", { name: "waVerify.title" })).toBeNull();
    });

    it("shows the localized invalid-phone message when the API rejects the number", async () => {
        axios.post.mockRejectedValue({ response: { status: 400, data: { message: "يرجى التأكد من رقم الهاتف", code: "invalid_phone" } } });
        render(<ContactForm />);
        fillAndSubmit();
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("phone.invalid"));
    });

    it("does not count the verification click as a whatsapp_click lead", async () => {
        axios.post.mockResolvedValue({ data: { message: "Thanks", whatsappVerify: VERIFY } });
        render(<><LeadClickTracker /><ContactForm /></>);
        fillAndSubmit();
        const panel = await screen.findByRole("region", { name: "waVerify.title" });
        beacon.mockClear();
        fireEvent.click(within(panel).getByRole("link", { name: /waVerify\.btn/ }));
        expect(beacon).not.toHaveBeenCalled();
    });

    it("has the copy in both languages", () => {
        const arV = (ar as any).contact.form.waVerify;
        const enV = (en as any).contact.form.waVerify;
        expect(arV.title).toBe("أكّد رقمك على واتساب لنتواصل معك أسرع");
        expect(enV.title).toBe("Confirm your number on WhatsApp so we can reply faster");
        for (const k of ["title", "body", "btn", "code"]) {
            expect(arV[k], `ar ${k}`).toBeTruthy();
            expect(enV[k], `en ${k}`).toBeTruthy();
        }
        expect((ar as any).contact.form.phone.invalid).toBeTruthy();
        expect((en as any).contact.form.phone.invalid).toBeTruthy();
    });
});

describe("LeadClickTracker opt-out", () => {
    it("still records ordinary WhatsApp links", () => {
        render(<><LeadClickTracker /><a href="https://wa.me/201091568240">WA</a><a data-lead-ignore href="https://wa.me/201091568240">Skip</a></>);
        fireEvent.click(screen.getByText("WA"));
        fireEvent.click(screen.getByText("Skip"));
        expect(beacon).toHaveBeenCalledTimes(1);
    });
});

describe("Dashboard contacts — WhatsApp badge and filter", () => {
    const contacts = [
        { id: "1", name: "Verified Vera", email: "v@x.com", phone: "+201001234567", stage: "lead", score: 10,
          waStatus: "verified", waNumber: "966501234567", createdAt: "2026-11-27T10:00:00Z" },
        { id: "2", name: "Pending Pete", email: "p@x.com", phone: "+201001234568", stage: "lead", score: 10,
          waStatus: "pending", waCode: "NIT-ABC234", createdAt: "2026-11-27T10:00:00Z" },
        { id: "3", name: "Old Olga", email: "o@x.com", phone: "+201001234569", stage: "lead", score: 10,
          createdAt: "2026-01-01T10:00:00Z" },
        { id: "4", name: "None Nora", email: "n@x.com", phone: "+201001234560", stage: "lead", score: 10,
          waStatus: "none", createdAt: "2026-11-27T10:00:00Z" },
    ];

    beforeEach(() => {
        useStore.setState({ contacts: [], unReadContact: 0 } as never);
        window.history.pushState({}, "", "/en/dashboard/contacts");
        axios.get.mockImplementation(async (url: string) =>
            url.includes("summary") ? { data: null } : { data: { contacts: url.includes("skip=0") ? contacts : [] } });
    });

    it("shows a verified badge with the WhatsApp number, a pending badge, and nothing for the rest", async () => {
        render(<ContactRows />);
        await screen.findAllByText("Verified Vera");
        const verified = screen.getAllByTitle("WhatsApp verified");
        expect(verified.length).toBeGreaterThan(0);
        expect(verified[0].textContent).toContain("+966501234567");
        const pending = screen.getAllByTitle("WhatsApp verification pending");
        expect(pending.length).toBe(verified.length); // one per layout (cards + table)
        // Two leads with no verification → no third/fourth badge.
        expect(screen.getAllByTitle(/WhatsApp verif/).length).toBe(verified.length * 2);
    });

    it("asks the API for verified leads only when the filter is on", async () => {
        render(<ContactRows waFilter="verified" />);
        await waitFor(() => expect(axios.get).toHaveBeenCalled());
        const url = axios.get.mock.calls.map((c) => c[0] as string).find((u) => u.startsWith("/api/contact?skip="))!;
        expect(new URLSearchParams(url.split("?")[1]).get("waStatus")).toBe("verified");
    });

    it("has a 'WhatsApp verified' toggle on the contacts page that drives the filter", async () => {
        render(<Contacts />);
        await screen.findAllByText("Verified Vera");
        const listCalls = () => axios.get.mock.calls.map((c) => c[0] as string).filter((u) => u.startsWith("/api/contact?skip="));
        expect(listCalls().every((u) => !u.includes("waStatus"))).toBe(true);
        const toggle = screen.getByRole("button", { name: /WhatsApp verified/ });
        expect(toggle.getAttribute("aria-pressed")).toBe("false");
        fireEvent.click(toggle);
        expect(toggle.getAttribute("aria-pressed")).toBe("true");
        await waitFor(() => expect(listCalls().some((u) => u.includes("waStatus=verified"))).toBe(true));
    });
});
