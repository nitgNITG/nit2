// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

// Dashboard → Stores: the Open/Close website button, driven by the state /usage
// reads from the host's nginx files.
const { axiosMock, toast } = vi.hoisted(() => ({
    axiosMock: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
    toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("axios", () => ({ default: axiosMock }));
vi.mock("react-hot-toast", () => ({ default: toast }));
vi.mock("@/navigation", () => ({ Link: ({ children }: any) => <a>{children}</a> }));

import StoresPage from "@/app/[locale]/dashboard/stores/page";

const STORE = { id: "t1", name: "Nile", slug: "nile-mall", status: "live", tier: "store-basic", ownerId: null, subscribedAt: null, validUntil: null, imageTag: "nile-dev", progressJson: null, lastError: null, createdAt: "2026-01-01", url: "https://nile-mall.commerce.nitg-eg.com", licenseMode: null };

function mockApi(state: string | null, status = "live") {
    axiosMock.get.mockImplementation(async (url: string) => {
        if (url === "/api/stores") return { data: { stores: [{ ...STORE, status }] } };
        if (url === "/api/stores/usage") return { data: { stores: { "nile-mall": { image_tag: "nile-dev", storefront: state } } } };
        return { data: {} };
    });
}

let confirmMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
    vi.clearAllMocks();
    confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Stores page — website button", () => {
    it("closed: says so and offers Open, warning about live payment keys", async () => {
        mockApi("closed");
        axiosMock.patch.mockResolvedValue({ data: { ok: true, storefront: "open" } });
        render(<StoresPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Open website" }));
        expect(screen.queryByText(/Website closed/)).not.toBeNull();
        expect(confirmMock.mock.calls[0][0]).toMatch(/live keys/);
        await waitFor(() => expect(axiosMock.patch).toHaveBeenCalledWith("/api/stores/nile-mall", { storefront: "open" }));
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Website opened"));
    });

    it("open: offers Close, and the button follows the new state after the reload", async () => {
        mockApi("open");
        axiosMock.patch.mockImplementation(async () => { mockApi("closed"); return { data: { ok: true, storefront: "closed" } }; });
        render(<StoresPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Close website" }));
        expect(await screen.findByRole("button", { name: "Open website" })).toBeTruthy();
        expect(axiosMock.patch).toHaveBeenCalledWith("/api/stores/nile-mall", { storefront: "closed" });
    });

    it("does nothing when the confirmation is cancelled", async () => {
        mockApi("open");
        confirmMock.mockReturnValue(false);
        render(<StoresPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Close website" }));
        expect(axiosMock.patch).not.toHaveBeenCalled();
    });

    it("partly closed: offers Close, which also covers the domain still open", async () => {
        mockApi("mixed");
        render(<StoresPage />);
        expect(await screen.findByRole("button", { name: "Close website" })).toBeTruthy();
        expect(screen.queryByText(/partly closed/)).not.toBeNull();
    });

    it("unknown state (older provisioner, or no nginx): no button at all", async () => {
        mockApi(null);
        render(<StoresPage />);
        await screen.findByRole("button", { name: "Credentials" });
        await waitFor(() => expect(axiosMock.get).toHaveBeenCalledWith("/api/stores/usage"));
        expect(screen.queryByRole("button", { name: /website/i })).toBeNull();
    });

    it("no button while the store is still being built", async () => {
        mockApi("open", "provisioning");
        render(<StoresPage />);
        await screen.findByRole("button", { name: "Credentials" });
        expect(screen.queryByRole("button", { name: /website/i })).toBeNull();
    });

    it("failure: shows the error and rereads the state, because the change may have applied", async () => {
        mockApi("closed");
        axiosMock.patch.mockRejectedValue({ response: { data: { error: "provisioner: ERROR: nginx refused the new config" } } });
        render(<StoresPage />);
        const usageReads = () => axiosMock.get.mock.calls.filter((c: unknown[]) => c[0] === "/api/stores/usage").length;
        fireEvent.click(await screen.findByRole("button", { name: "Open website" }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("nginx refused")));
        await waitFor(() => expect(usageReads()).toBeGreaterThanOrEqual(2));
        expect(toast.success).not.toHaveBeenCalled();
    });
});
