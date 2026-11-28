// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useLocale: () => "en", useTranslations: () => (k: string) => k }));
vi.mock("@/app/[locale]/account/DeletePlatformButton", () => ({ default: () => null }));
vi.mock("@/app/[locale]/account/CustomDomainCard", () => ({ default: () => null }));

import AcademyCard, { type ClientAcademy } from "@/app/[locale]/account/AcademyCard";

// While an academy is being prepared the card polls /status until the site answers.
// A suspended academy still serves a notice page (200), so polling must not run —
// and must STOP if the academy becomes suspended while the card is on screen; it used
// to keep polling (the effect didn't depend on `suspended`) and could flip it to "live".

const statusCalls = (f: ReturnType<typeof vi.fn>) =>
    f.mock.calls.filter(([url]) => String(url).includes("/status")).length;

describe("AcademyCard status polling", () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        vi.useFakeTimers();
        fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ live: false }) }));
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

    const academy = (status: string): ClientAcademy =>
        ({ id: "a1", name: "Demo", slug: "demo", status, createdAt: "2026-11-01T00:00:00Z" });

    it("polls while preparing", async () => {
        render(<AcademyCard academy={academy("preparing")} domain="example.test" />);
        await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
        expect(statusCalls(fetchMock)).toBe(1);
    });

    it("stops polling once the academy becomes suspended", async () => {
        const { rerender } = render(<AcademyCard academy={academy("preparing")} domain="example.test" />);
        rerender(<AcademyCard academy={academy("suspended")} domain="example.test" />);
        await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
        expect(statusCalls(fetchMock)).toBe(0);
    });
});
