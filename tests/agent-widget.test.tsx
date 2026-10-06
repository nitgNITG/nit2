// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import ChatWidget, { STORE_KEY } from "@/app/[locale]/components/ChatWidget/ChatWidget";
import { createSseParser } from "@/app/[locale]/components/ChatWidget/sse";
import { STRINGS } from "@/app/[locale]/components/ChatWidget/strings";

const CFG = {
    enabled: true, hidden: false, greeting: "أهلاً! أنا المساعد الذكي", whatsapp: "+20 100 000 0000",
    suggestions: ["ما هي الباقات؟", "عايز منصة تعليمية", "مشاريع مشابهة؟"], proactivePrompt: null as null | { id: string; text: string; delaySec: number },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const sse = (events: [string, unknown][], splitEvery = 7) => {
    const text = events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");
    const enc = new TextEncoder();
    return new Response(new ReadableStream({
        start(c) { for (let i = 0; i < text.length; i += splitEvery) c.enqueue(enc.encode(text.slice(i, i + splitEvery))); c.close(); },
    }), { headers: { "Content-Type": "text/event-stream" } });
};

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>;
let routes: Record<string, Route>;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.split("?")[0];
    const r = routes[`${init?.method ?? "GET"} ${path}`];
    if (!r) throw new Error(`unexpected fetch ${init?.method ?? "GET"} ${url}`);
    return r(url, init);
});

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    routes = { "GET /api/agent/config": () => json(CFG) };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const openPanel = async (locale: "ar" | "en" = "ar") => {
    fireEvent.click(await screen.findByRole("button", { name: STRINGS[locale].open }));
    return screen.getByRole("dialog");
};

describe("chat widget (FR-W1–W10)", () => {
    it("AC-01.1: on /ar/pricing it opens right-to-left in Arabic with the greeting, the AI notice and 3 suggestions", async () => {
        render(<ChatWidget locale="ar" pathname="/ar/pricing" />);
        const dialog = await openPanel();
        expect(dialog.closest("[dir]")!.getAttribute("dir")).toBe("rtl");
        expect(screen.getByText(CFG.greeting)).toBeTruthy();
        expect(screen.getByText(STRINGS.ar.aiNotice)).toBeTruthy();
        for (const s of CFG.suggestions) expect(screen.getByRole("button", { name: s })).toBeTruthy();
        expect(fetchMock).toHaveBeenCalledWith("/api/agent/config?locale=ar&page=%2Far%2Fpricing", expect.anything());
    });

    it("AC-01.4: nothing on dashboard or payment pages, and no request is made", () => {
        const { container } = render(<ChatWidget locale="ar" pathname="/ar/dashboard" />);
        render(<ChatWidget locale="ar" pathname="/ar/payment" />);
        expect(container.innerHTML).toBe("");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("FR-W8 / AC-09.2: when the agent is off it shows the WhatsApp button instead", async () => {
        routes["GET /api/agent/config"] = () => json({ ...CFG, enabled: false });
        render(<ChatWidget locale="en" pathname="/en" />);
        const link = await screen.findByRole("link", { name: STRINGS.en.chatWhatsapp });
        expect(link.getAttribute("href")).toBe("https://wa.me/201000000000");
        expect(screen.queryByRole("button", { name: STRINGS.en.open })).toBeNull();
    });

    it("FR-W4 / FR-W9: streams the reply word by word, shows buttons, and remembers the conversation", async () => {
        let body: any;
        routes["POST /api/agent/chat"] = (_u, init) => {
            body = JSON.parse(init!.body as string);
            return sse([
                ["meta", { conversationId: "c".repeat(24), mode: "sales", status: "open" }],
                ["delta", { text: "The Standard " }], ["delta", { text: "plan fits." }],
                ["action", { type: "link", label: "Get Standard", url: "/en/build-product?tier=standard&cycle=annual" }],
                ["action", { type: "link", label: "Brochure", url: "https://files.nitg-eg.com/profile.pdf" }],
                ["action", { type: "link", label: "Evil", url: "javascript:alert(1)" }],
                ["action", { type: "link", label: "Plain", url: "http://insecure.example" }],
                ["action", { type: "link", label: "ProtoRel", url: "//evil.example" }],
                ["done", { messageId: "d".repeat(24) }],
            ]);
        };
        render(<ChatWidget locale="en" pathname="/en/pricing" />);
        await openPanel("en");
        fireEvent.change(screen.getByRole("textbox", { name: STRINGS.en.placeholder }), { target: { value: "I need 200 courses" } });
        fireEvent.click(screen.getByRole("button", { name: STRINGS.en.send }));

        expect(await screen.findByText("The Standard plan fits.")).toBeTruthy();
        expect(screen.getByText("I need 200 courses")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Get Standard" }).getAttribute("href")).toBe("/en/build-product?tier=standard&cycle=annual");
        const brochure = screen.getByRole("link", { name: "Brochure" });
        expect(brochure.getAttribute("target")).toBe("_blank");
        expect(brochure.getAttribute("rel")).toContain("noopener");
        for (const name of ["Evil", "Plain", "ProtoRel"]) expect(screen.queryByRole("link", { name })).toBeNull(); // only internal or https
        expect(body).toMatchObject({ message: "I need 200 courses", locale: "en", page: "/en/pricing" });
        expect(body).not.toHaveProperty("conversationId");
        expect(JSON.parse(localStorage.getItem(STORE_KEY)!).id).toBe("c".repeat(24));
    });

    it("AC-07.1: after a reload within 24 h it shows the same messages and continues the same conversation", async () => {
        const id = "e".repeat(24);
        localStorage.setItem(STORE_KEY, JSON.stringify({ id, at: Date.now() - 3600_000 }));
        routes[`GET /api/agent/conversations/${id}`] = () => json({
            status: "open",
            messages: [
                { id: "1".repeat(24), role: "visitor", content: "q1" }, { id: "2".repeat(24), role: "assistant", content: "a1" },
                { id: "3".repeat(24), role: "visitor", content: "q2" }, { id: "4".repeat(24), role: "assistant", content: "a2" },
            ],
        });
        let body: any;
        routes["POST /api/agent/chat"] = (_u, init) => { body = JSON.parse(init!.body as string); return sse([["meta", { conversationId: id, mode: "sales", status: "open" }], ["delta", { text: "a3" }], ["done", { messageId: "5".repeat(24) }]]); };
        render(<ChatWidget locale="en" pathname="/en" />);
        await openPanel("en");
        for (const t of ["q1", "a1", "q2", "a2"]) expect(await screen.findByText(t)).toBeTruthy();
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "q3" } });
        fireEvent.click(screen.getByRole("button", { name: STRINGS.en.send }));
        expect(await screen.findByText("a3")).toBeTruthy();
        expect(body.conversationId).toBe(id);
    });

    it("an expired (over 24 h) conversation is not resumed", async () => {
        localStorage.setItem(STORE_KEY, JSON.stringify({ id: "e".repeat(24), at: Date.now() - 25 * 3600_000 }));
        render(<ChatWidget locale="en" pathname="/en" />);
        await openPanel("en");
        expect(fetchMock).toHaveBeenCalledTimes(1); // config only — no history request
        expect(localStorage.getItem(STORE_KEY)).toBeNull();
    });

    it("AC-12.3: a reply discarded by a takeover (done without a message id) is never shown", async () => {
        routes["POST /api/agent/chat"] = () => sse([
            ["meta", { conversationId: "c".repeat(24), mode: "sales", status: "open" }],
            ["delta", { text: "Secret draft" }],
            ["handoff", { status: "human", message: "" }],
            ["done", { messageId: null }],
        ]);
        render(<ChatWidget locale="en" pathname="/en" />);
        await openPanel("en");
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "hi" } });
        fireEvent.click(screen.getByRole("button", { name: STRINGS.en.send }));
        expect(await screen.findByText(STRINGS.en.withPerson)).toBeTruthy();
        expect(screen.queryByText("Secret draft")).toBeNull();
    });

    it("AC-09.1: a stream error shows the WhatsApp and contact-form fallback", async () => {
        routes["POST /api/agent/chat"] = () => sse([
            ["meta", { conversationId: "c".repeat(24), mode: "sales", status: "open" }],
            ["error", { code: "model_unavailable", fallback: { whatsapp: "https://wa.me/201000000000", contactUrl: "/en/contact" } }],
        ]);
        render(<ChatWidget locale="en" pathname="/en" />);
        await openPanel("en");
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "hi" } });
        fireEvent.click(screen.getByRole("button", { name: STRINGS.en.send }));
        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toContain(STRINGS.en.fallback);
        expect(screen.getByRole("link", { name: STRINGS.en.contactForm }).getAttribute("href")).toBe("/en/contact");
    });

    it("AC-09.3: a 503 (budget used) also shows the fallback", async () => {
        routes["POST /api/agent/chat"] = () => json({ error: "budget_exhausted", fallback: { whatsapp: "https://wa.me/2010", contactUrl: "/ar/contact" } }, 503);
        render(<ChatWidget locale="ar" pathname="/ar" />);
        await openPanel("ar");
        fireEvent.click(screen.getByRole("button", { name: CFG.suggestions[0] }));
        expect((await screen.findByRole("alert")).textContent).toContain(STRINGS.ar.fallback);
    });

    it("AC-06.1: Talk to a person hands off and shows the reply", async () => {
        const id = "e".repeat(24);
        localStorage.setItem(STORE_KEY, JSON.stringify({ id, at: Date.now() }));
        routes[`GET /api/agent/conversations/${id}`] = () => json({ status: "open", messages: [{ id: "1".repeat(24), role: "assistant", content: "hello" }] });
        routes[`POST /api/agent/conversations/${id}/handoff`] = () => json({ status: "waiting_human", nextReply: "A team member will reply here." });
        render(<ChatWidget locale="en" pathname="/en" />);
        await openPanel("en");
        fireEvent.click(await screen.findByRole("button", { name: STRINGS.en.human }));
        expect(await screen.findByText("A team member will reply here.")).toBeTruthy();
        expect(screen.getByText(STRINGS.en.waiting)).toBeTruthy();
    });

    it("AC-26.1: the page prompt appears after its delay, once per session", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        routes["GET /api/agent/config"] = () => json({ ...CFG, proactivePrompt: { id: "lms", text: "تبحث عن منصة تعليم إلكتروني؟", delaySec: 20 } });
        const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
        const first = render(<ChatWidget locale="ar" pathname="/ar/moodle-lms" />);
        await flush(); // config fetch resolves (findBy* would poll on the faked clock)
        screen.getByRole("button", { name: STRINGS.ar.open });
        await act(async () => { await vi.advanceTimersByTimeAsync(19_000); });
        expect(screen.queryByText("تبحث عن منصة تعليم إلكتروني؟")).toBeNull();
        await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
        expect(screen.getByText("تبحث عن منصة تعليم إلكتروني؟")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: STRINGS.ar.promptClose }));
        expect(screen.queryByText("تبحث عن منصة تعليم إلكتروني؟")).toBeNull();
        first.unmount();

        render(<ChatWidget locale="ar" pathname="/ar/moodle-lms" />); // navigating to another page in the same session
        await flush();
        screen.getByRole("button", { name: STRINGS.ar.open });
        await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
        expect(screen.queryByText("تبحث عن منصة تعليم إلكتروني؟")).toBeNull();
    });

    it("FR-W7: rating sends thumbs and the optional comment", async () => {
        const id = "e".repeat(24);
        localStorage.setItem(STORE_KEY, JSON.stringify({ id, at: Date.now() }));
        routes[`GET /api/agent/conversations/${id}`] = () => json({ status: "open", messages: [{ id: "1".repeat(24), role: "assistant", content: "hello" }] });
        const ratings: unknown[] = [];
        routes[`POST /api/agent/conversations/${id}/rating`] = (_u, init) => { ratings.push(JSON.parse(init!.body as string)); return json({ ok: true }); };
        render(<ChatWidget locale="en" pathname="/en" />);
        await openPanel("en");
        fireEvent.click(await screen.findByRole("button", { name: STRINGS.en.rateDown }));
        fireEvent.change(screen.getByRole("textbox", { name: STRINGS.en.rateComment }), { target: { value: "Too slow" } });
        fireEvent.submit(screen.getByRole("textbox", { name: STRINGS.en.rateComment }).closest("form")!);
        expect(await screen.findByText(STRINGS.en.rateThanks)).toBeTruthy();
        expect(ratings).toEqual([{ rating: -1 }, { rating: -1, comment: "Too slow" }]);
    });

    it("NFR-15: Escape closes the panel; the toggle reports its state", async () => {
        render(<ChatWidget locale="en" pathname="/en" />);
        const dialog = await openPanel("en");
        expect(screen.getByRole("button", { name: STRINGS.en.close, expanded: true })).toBeTruthy();
        fireEvent.keyDown(dialog, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
});

describe("SSE parser", () => {
    it("assembles events split across arbitrary chunks and skips malformed ones", () => {
        const p = createSseParser();
        const text = 'event: meta\ndata: {"a":1}\n\nevent: delta\ndata: {"text":"hé"}\n\nevent: bad\ndata: {nope\n\n';
        const out = [] as ReturnType<typeof p.push>;
        for (const ch of text) out.push(...p.push(ch));
        expect(out).toEqual([{ event: "meta", data: { a: 1 } }, { event: "delta", data: { text: "hé" } }]);
    });
});
