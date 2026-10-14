// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { toShowcaseProject, type ShowcaseProject, type StoredProject } from "@/lib/promo";
import ShowcaseClient from "@/app/[locale]/components/promo/ShowcaseClient";
import PromoPlayer from "@/app/[locale]/components/promo/PromoPlayer";
import { PromoLightboxProvider, progressEvents, stepPlaylist } from "@/app/[locale]/components/promo/PromoLightbox";
import FeaturedProjectsBand from "@/app/[locale]/our-projects/components/FeaturedProjectsBand";
import { autoplayAllowed } from "@/app/[locale]/components/promo/teaser";

const VIDEO = (id: string) => `https://res.cloudinary.com/nitcloud/video/upload/v1/nit-promos/${id}.mp4`;
const make = (id: string, titleEn: string, withPromo: boolean, extra: Partial<StoredProject> = {}, locale = "en"): ShowcaseProject =>
    toShowcaseProject({
        id, img: `/uploads/projects/${id}.webp`, title: `${titleEn} AR`, titleEn, description: "وصف", descriptionEn: `${titleEn} description`,
        links: [{ headerEn: "Google Play", headerAr: "جوجل بلاي", link: `https://play.google.com/${id}` }],
        categoryEn: `${titleEn} category`, promo: withPromo ? { videoUrl: VIDEO(id), durationSec: 40 } : null, ...extra,
    }, locale);

let reducedMotion = true;
const observed: Element[] = [];
beforeEach(() => {
    reducedMotion = true;
    observed.length = 0;
    window.matchMedia = vi.fn((q: string) => ({
        matches: q.includes("reduced-motion") ? reducedMotion : q.includes("pointer: fine"),
        media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })) as never;
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
        constructor(public cb: unknown) {}
        observe(el: Element) { observed.push(el); }
        disconnect() {}
    };
    window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => { cleanup(); document.body.style.overflow = ""; });

const renderShowcase = (projects: ShowcaseProject[], state: "multi" | "single" | "static", locale = "en") =>
    render(
        <PromoLightboxProvider locale={locale}>
            <ShowcaseClient projects={projects} state={state} kind="app" fallbackCategory="eCommerce App" locale={locale} page="service:ecommerce-app" />
        </PromoLightboxProvider>,
    );

describe("Built by N.I.T section states", () => {
    it("2+ promos: switcher of the promo projects swaps the player and details; the rest go to 'Also built by us'", () => {
        renderShowcase([make("a", "Tawreedat Go", true), make("b", "POS", true), make("c", "PayPoins", false)], "multi");
        const switcher = screen.getByRole("group", { name: "Choose a project" });
        const buttons = within(switcher).getAllByRole("button");
        expect(buttons).toHaveLength(2);
        expect((buttons[0]).getAttribute("aria-pressed")).toBe("true");
        expect((screen.getByRole("heading", { level: 3 })).textContent).toContain("Tawreedat Go");

        fireEvent.click(buttons[1]);
        expect((buttons[1]).getAttribute("aria-pressed")).toBe("true");
        expect((buttons[0]).getAttribute("aria-pressed")).toBe("false");
        expect((screen.getByRole("heading", { level: 3 })).textContent).toContain("POS");

        expect(screen.getByText("ALSO BUILT BY US")).toBeTruthy();
        expect((screen.getByRole("link", { name: /PayPoins/ })).getAttribute("href")).toBe("https://play.google.com/c");
    });

    it("exactly one promo: it leads, no switcher, the others are listed", () => {
        renderShowcase([make("a", "Tawreedat Go", true), make("c", "PayPoins", false)], "single");
        expect(screen.queryByRole("group", { name: "Choose a project" })).toBeNull();
        expect((screen.getByRole("heading", { level: 3 })).textContent).toContain("Tawreedat Go");
        expect(screen.getByRole("button", { name: "Play the full promo with sound" })).toBeTruthy();
        expect(screen.getByText("ALSO BUILT BY US")).toBeTruthy();
    });

    it("no promo yet: screenshot frame, no play button or 'Watch the full promo' link", () => {
        renderShowcase([make("c", "PayPoins", false)], "static");
        expect(screen.getByText("Screens from the live app")).toBeTruthy();
        expect(screen.queryByRole("button", { name: /promo/i })).toBeNull();
        expect((screen.getByRole("heading", { level: 3 })).textContent).toContain("PayPoins");
    });

    it("hides key results when there are none and shows them when real numbers exist", () => {
        renderShowcase([make("a", "Tawreedat Go", true, { keyResults: [{ value: "50K+", labelEn: "downloads", labelAr: "تحميل" }] })], "single");
        expect(screen.getByText("50K+")).toBeTruthy();
        cleanup();
        renderShowcase([make("a", "Tawreedat Go", true)], "single");
        expect(screen.queryByText("50K+")).toBeNull();
    });

    it("'Start a similar project' goes to contact with the project prefilled", () => {
        renderShowcase([make("a", "Tawreedat Go", true, {}, "ar")], "single", "ar");
        expect((screen.getByRole("link", { name: "ابدأ مشروعاً مشابهاً" })).getAttribute("href")).toBe("/ar/contact?project=Tawreedat%20Go%20AR");
    });
});

describe("PromoPlayer — teaser autoplay rules", () => {
    it("reduced motion or Data Saver → poster only", () => {
        expect(autoplayAllowed(true, false)).toBe(false);
        expect(autoplayAllowed(false, true)).toBe(false);
        expect(autoplayAllowed(false, false)).toBe(true);
        reducedMotion = true;
        const { container } = render(<PromoLightboxProvider locale="en"><PromoPlayer project={make("a", "Tawreedat Go", true)} locale="en" page="t" /></PromoLightboxProvider>);
        expect(container.querySelector("video")).toBeNull();
        expect(container.querySelector("img")?.getAttribute("src")).toContain("so_1,w_1280");
    });

    it("otherwise renders a muted, looping, lazy teaser and waits for visibility", () => {
        reducedMotion = false;
        const { container } = render(<PromoLightboxProvider locale="en"><PromoPlayer project={make("a", "Tawreedat Go", true)} locale="en" page="t" /></PromoLightboxProvider>);
        const video = container.querySelector("video")!;
        expect(video).not.toBeNull();
        expect(video.muted).toBe(true);
        expect(video.loop).toBe(true);
        expect(video.getAttribute("preload")).toBe("none");
        expect(observed).toHaveLength(1);
        expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    });
});

describe("Lightbox", () => {
    it("opens as a modal dialog with the full promo, locks scroll, Esc closes and focus returns", () => {
        renderShowcase([make("a", "Tawreedat Go", true)], "single");
        const play = screen.getByRole("button", { name: "Play the full promo with sound" });
        play.focus();
        fireEvent.click(play);

        const dialog = screen.getByRole("dialog");
        expect((dialog).getAttribute("aria-modal")).toBe("true");
        expect(dialog.querySelector("video")?.getAttribute("src")).toBe("https://res.cloudinary.com/nitcloud/video/upload/q_auto,vc_auto/v1/nit-promos/a.mp4");
        expect(document.body.style.overflow).toBe("hidden");
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close video" }));

        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(document.activeElement).toBe(play);
        expect(document.body.style.overflow).toBe("");
        expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    });

    it("Tab from the last control wraps to the first (focus stays inside)", () => {
        renderShowcase([make("a", "Tawreedat Go", true)], "single");
        fireEvent.click(screen.getByRole("button", { name: "Play the full promo with sound" }));
        const dialog = screen.getByRole("dialog");
        const cta = within(dialog).getByRole("link", { name: "Start a similar project" });
        cta.focus();
        fireEvent.keyDown(document, { key: "Tab" });
        expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close video" }));
    });

    it("captions default to the page locale and the toggle switches them", () => {
        const p = make("a", "Tawreedat Go", true, {
            promo: { videoUrl: VIDEO("a"), captionsEn: "https://res.cloudinary.com/nitcloud/raw/upload/v1/en.vtt", captionsAr: "https://res.cloudinary.com/nitcloud/raw/upload/v1/ar.vtt" },
        }, "ar");
        renderShowcase([p], "single", "ar");
        fireEvent.click(screen.getByRole("button", { name: "شغّل الفيديو التعريفي كاملاً بالصوت" }));
        const dialog = screen.getByRole("dialog");
        expect((within(dialog).getByRole("button", { name: "عربي" })).getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(within(dialog).getByRole("button", { name: "EN" }));
        expect((within(dialog).getByRole("button", { name: "EN" })).getAttribute("aria-pressed")).toBe("true");
        expect(dialog.querySelector("video")?.getAttribute("crossorigin")).toBe("anonymous");
    });

    it("progress milestones fire once each", () => {
        const sent = new Set<never>();
        expect(progressEvents(0.3, sent)).toEqual(["promo_progress_25"]);
        expect(progressEvents(0.8, new Set(["promo_progress_25"] as never[]))).toEqual(["promo_progress_50", "promo_progress_75"]);
    });
});

describe("Our Projects Featured band", () => {
    it("2–3 featured → vertical tabs; selecting a tab swaps the player", () => {
        render(<PromoLightboxProvider locale="en"><FeaturedProjectsBand projects={[make("a", "Loghat", true), make("b", "Step to English", true), make("c", "Tawreedat Go", true)]} locale="en" /></PromoLightboxProvider>);
        const tabs = screen.getAllByRole("tab");
        expect(tabs).toHaveLength(3);
        expect((tabs[0]).getAttribute("aria-selected")).toBe("true");
        expect((screen.getByRole("heading", { level: 2 })).textContent).toContain("Three projects, in their own words");
        fireEvent.click(tabs[2]);
        expect((tabs[2]).getAttribute("aria-selected")).toBe("true");
        expect(screen.getByRole("img", { name: "Tawreedat Go" })).toBeTruthy();
    });

    it("1 featured → details panel, no tabs", () => {
        render(<PromoLightboxProvider locale="en"><FeaturedProjectsBand projects={[make("c", "Tawreedat Go", true)]} locale="en" /></PromoLightboxProvider>);
        expect(screen.queryByRole("tablist")).toBeNull();
        expect((screen.getByRole("heading", { level: 3 })).textContent).toContain("Tawreedat Go");
        expect(screen.getByRole("link", { name: "Start a project like this" })).toBeTruthy();
    });
});

describe("Multiple projects: auto-advance and previous/next", () => {
    const three = () => [make("a", "Tawreedat Go", true), make("b", "Eerad POS", true), make("c", "PayPoins", true)];
    const renderBand = (projects: ShowcaseProject[]) =>
        render(<PromoLightboxProvider locale="en"><FeaturedProjectsBand projects={projects} locale="en" /></PromoLightboxProvider>);

    it("the band has no 'Muted preview' hint text", () => {
        renderBand(three());
        expect(document.body.textContent).not.toMatch(/Muted preview/);
    });

    it("band: each teaser plays once, then the next tab starts (and wraps to the first)", () => {
        reducedMotion = false;
        const { container } = renderBand(three());
        const tabs = screen.getAllByRole("tab");
        const teaser = () => container.querySelector("video")!;
        expect(teaser().loop).toBe(false);
        fireEvent.ended(teaser());
        expect(tabs[1].getAttribute("aria-selected")).toBe("true");
        fireEvent.ended(teaser());
        expect(tabs[2].getAttribute("aria-selected")).toBe("true");
        fireEvent.ended(teaser());
        expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    });

    it("a single featured project keeps looping its teaser", () => {
        reducedMotion = false;
        const { container } = renderBand([make("a", "Tawreedat Go", true)]);
        expect(container.querySelector("video")!.loop).toBe(true);
    });

    it("service section with 2+ promos: when the teaser ends the switcher moves on", () => {
        reducedMotion = false;
        const { container } = renderShowcase([make("a", "Tawreedat Go", true), make("b", "Eerad POS", true)], "multi");
        const buttons = within(screen.getByRole("group", { name: "Choose a project" })).getAllByRole("button");
        fireEvent.ended(container.querySelector("video")!);
        expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByRole("heading", { level: 3 }).textContent).toContain("Eerad POS");
    });

    it("lightbox: next/previous switch the video in place and wrap around", () => {
        renderBand(three());
        fireEvent.click(screen.getByRole("button", { name: "Play the full promo with sound" }));
        const dialog = screen.getByRole("dialog");
        const src = () => dialog.querySelector("video")!.getAttribute("src");
        expect(within(dialog).getByText("1 / 3")).toBeTruthy();
        expect(src()).toContain("/nit-promos/a.mp4");

        fireEvent.click(within(dialog).getByRole("button", { name: "Next project: Eerad POS" }));
        expect(within(dialog).getByText("2 / 3")).toBeTruthy();
        expect(dialog.textContent).toContain("Eerad POS — full promo");
        expect(src()).toContain("/nit-promos/b.mp4");
        expect(screen.getByRole("dialog")).toBe(dialog); // same dialog, still open

        fireEvent.click(within(dialog).getByRole("button", { name: "Previous project: Tawreedat Go" }));
        fireEvent.click(within(dialog).getByRole("button", { name: "Previous project: PayPoins" }));
        expect(within(dialog).getByText("3 / 3")).toBeTruthy();
        expect(src()).toContain("/nit-promos/c.mp4");
    });

    it("lightbox: no previous/next for a single promo", () => {
        renderShowcase([make("a", "Tawreedat Go", true), make("c", "PayPoins", false)], "single");
        fireEvent.click(screen.getByRole("button", { name: "Play the full promo with sound" }));
        expect(screen.queryByRole("button", { name: /Next project/ })).toBeNull();
        expect(screen.queryByText("1 / 1")).toBeNull();
    });

    it("stepPlaylist wraps at both ends", () => {
        expect(stepPlaylist(3, 2, 1)).toBe(0);
        expect(stepPlaylist(3, 0, -1)).toBe(2);
        expect(stepPlaylist(0, 0, 1)).toBe(0);
    });
});
