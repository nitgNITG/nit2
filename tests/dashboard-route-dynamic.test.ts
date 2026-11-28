import { describe, expect, it, vi } from "vitest";

vi.mock("@/prisma/client", () => ({ default: {} }));
vi.mock("@/lib/predict", () => ({ authAdmin: vi.fn() }));

// /api/dashboard reads the request (admin cookie), so Next must never try to
// prerender it at build time — that attempt logged "[Auth] admin check failed:
// Dynamic server usage" on every `npm run build`.
describe("/api/dashboard", () => {
    it("is declared dynamic so the build never prerenders it", async () => {
        const route = await import("@/app/api/dashboard/route");
        expect((route as { dynamic?: string }).dynamic).toBe("force-dynamic");
    });
});
