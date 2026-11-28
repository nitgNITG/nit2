import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeMysql } from "./helpers/memoryPrisma";

// Deleting an academy / store: the row stays ("deleting") until the provisioner
// confirms the teardown; billing stops at once; failures are retried and alerted.
const { mysql, notifyTelegram, alertAdmins, getCurrentUser } = vi.hoisted(() => ({
    mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
    notifyTelegram: vi.fn(),
    alertAdmins: vi.fn(),
    getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins, supportWhatsapp: async () => "" }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));

import { beginTenantDelete, reconcileAllDeleting, finalizeTenantDelete } from "@/lib/tenants/teardown";
import { DELETE as deleteAcademy } from "@/app/api/academies/[slug]/route";
import { POST as progressRoute } from "@/app/api/tenants/[slug]/progress/route";
import { GET as listStores } from "@/app/api/stores/route";

type Reply = { status: number; body?: unknown } | Error;
// Fake server B (academies), store provisioner and GitHub.
let serverB: { del: Reply; get: Reply };
let storeProv: { del: Reply; status: Reply };
let calls: { method: string; url: string }[];

const reply = (r: Reply) => {
    if (r instanceof Error) throw r;
    return { ok: r.status < 300, status: r.status, json: async () => r.body ?? {} };
};
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(String(url));
    const method = init?.method ?? "GET";
    calls.push({ method, url: String(url) });
    if (u.host === "api.github.com") return reply({ status: 204 });
    if (u.host === "prov.test" && u.pathname.startsWith("/deprovision/")) return reply(method === "DELETE" ? serverB.del : serverB.get);
    if (u.host === "store.test" && u.pathname.startsWith("/deprovision/")) return reply(storeProv.del);
    if (u.host === "store.test" && u.pathname.startsWith("/status/")) return reply(storeProv.status);
    throw new Error(`unexpected fetch ${method} ${url}`);
});

const ACADEMY = { slug: "acme", name: "Acme", product: "academy", status: "live", ownerId: "u1", branch: "client/acme", customDomain: "learn.acme.com" };
const STORE = { slug: "shop", name: "Shop", product: "store", status: "live", ownerId: "u1" };
const destroyCalls = (host: string) => calls.filter((c) => c.method === "DELETE" && c.url.includes(host) && c.url.includes("/deprovision/"));

beforeEach(async () => {
    Object.assign(mysql, makeMysql());
    vi.clearAllMocks();
    calls = [];
    serverB = { del: { status: 202, body: { ok: true } }, get: { status: 200, body: { state: "running" } } };
    storeProv = { del: { status: 202, body: { ok: true, job: 5 } }, status: { status: 200, body: { kind: "destroy", state: "running" } } };
    vi.stubGlobal("fetch", fetchMock);
    Object.assign(process.env, {
        PROVISION_URL: "https://prov.test/provision", PROVISION_SECRET: "b-secret",
        STORE_PROVISION_URL: "http://store.test", STORE_PROVISION_SECRET: "s-secret",
        GITHUB_TOKEN: "gh", WORKER_SECRET: "w-secret",
    });
    await mysql.tenant.create({ data: { ...ACADEMY } });
    await mysql.tenant.create({ data: { ...STORE } });
    await mysql.subscription.create({ data: { tenantSlug: "acme", status: "active" } });
    await mysql.subscription.create({ data: { tenantSlug: "shop", status: "active" } });
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

const tenant = (slug: string) => mysql.tenant.findUnique({ where: { slug } });
const sub = (slug: string) => mysql.subscription.findUnique({ where: { tenantSlug: slug } });

describe("beginTenantDelete", () => {
    it("refuses while the create is still running — nothing changes, nothing is called", async () => {
        await mysql.tenant.update({ where: { slug: "acme" }, data: { status: "provisioning" } });
        expect(await beginTenantDelete("acme", { by: "owner" })).toEqual({ state: "busy" });
        expect((await tenant("acme"))?.status).toBe("provisioning");
        expect((await sub("acme"))?.status).toBe("active");
        expect(calls).toHaveLength(0);
    });

    it("academy: teardown confirmed → row and branch gone, billing cancelled, the custom domain sent along", async () => {
        vi.useFakeTimers();
        serverB.get = { status: 200, body: { state: "done" } };
        const pending = beginTenantDelete("acme", { by: "owner", waitMs: 10_000, pollMs: 1000 });
        await vi.advanceTimersByTimeAsync(1000);
        expect(await pending).toEqual({ state: "deleted" });

        expect(await tenant("acme")).toBeNull();
        expect((await sub("acme"))?.status).toBe("canceled");
        expect(destroyCalls("prov.test")[0].url).toBe("https://prov.test/deprovision/acme?domain=learn.acme.com");
        expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/git/refs/heads/client/acme"))).toBe(true);
        expect(notifyTelegram).toHaveBeenCalledWith(expect.stringContaining("acme"));
    });

    it("server B unreachable: the row stays 'deleting' (billing already stopped), admins alerted; the cron resends and finishes it", async () => {
        serverB.del = new Error("ECONNREFUSED");
        const r = await beginTenantDelete("acme", { by: "owner", waitMs: 0 });
        expect(r).toMatchObject({ state: "deleting", reason: expect.stringContaining("teardown not started") });
        const row = await tenant("acme");
        expect(row?.status).toBe("deleting");
        expect(row?.lastError).toMatch(/ECONNREFUSED/);
        expect((await sub("acme"))?.status).toBe("canceled");
        expect(alertAdmins).toHaveBeenCalledTimes(1);

        // Next cron: server B is back but never got the job → it is sent again.
        serverB = { del: { status: 202 }, get: { status: 200, body: { state: "none" } } };
        expect(await reconcileAllDeleting()).toMatchObject({ acme: "restarted" });
        expect(destroyCalls("prov.test")).toHaveLength(2);
        expect(await tenant("acme")).not.toBeNull();

        // And once it reports done, the row goes.
        serverB.get = { status: 200, body: { state: "done" } };
        expect(await reconcileAllDeleting()).toMatchObject({ acme: "deleted" });
        expect(await tenant("acme")).toBeNull();
    });

    it("server B still creating it (409): kept for a retry, never deleted", async () => {
        serverB.del = { status: 409, body: { error: "a create is still running for this slug" } };
        expect((await beginTenantDelete("acme", { by: "admin" })).state).toBe("deleting");
        expect((await tenant("acme"))?.lastError).toMatch(/409/);
    });

    it("a failed teardown keeps the row and alerts once per distinct error", async () => {
        vi.useFakeTimers();
        serverB.get = { status: 200, body: { state: "failed", error: "database moodle_acme was NOT dropped" } };
        const pending = beginTenantDelete("acme", { by: "owner", waitMs: 5000, pollMs: 1000 });
        await vi.advanceTimersByTimeAsync(1000);
        expect(await pending).toMatchObject({ state: "deleting" });
        expect((await tenant("acme"))?.lastError).toMatch(/NOT dropped/);
        expect(alertAdmins).toHaveBeenCalledTimes(1);

        expect(await reconcileAllDeleting()).toMatchObject({ acme: "failed" });
        expect(alertAdmins).toHaveBeenCalledTimes(1); // same error → no new alert
        expect(await tenant("acme")).not.toBeNull();
    });

    it("status unknown (server B unreachable on the check) → nothing changes", async () => {
        await beginTenantDelete("acme", { by: "owner" });
        serverB.get = new Error("timeout");
        expect(await reconcileAllDeleting()).toMatchObject({ acme: "unreachable" });
        expect((await tenant("acme"))?.status).toBe("deleting");
    });

    it("server B not yet updated (no GET /deprovision): an accepted teardown is trusted, as before", async () => {
        await beginTenantDelete("acme", { by: "owner" });
        serverB.get = { status: 404, body: { error: "not found" } };
        expect(await reconcileAllDeleting()).toMatchObject({ acme: "deleted" });
        expect(await tenant("acme")).toBeNull();
    });

    it("only a row still marked deleting is ever removed", async () => {
        expect(await finalizeTenantDelete({ slug: "acme", product: "academy", status: "live" })).toBe(false);
        expect(await tenant("acme")).not.toBeNull();
    });
});

describe("stores", () => {
    const progress = (body: unknown, slug = "shop") =>
        progressRoute(new Request(`http://x/api/tenants/${slug}/progress`, {
            method: "POST", headers: { "x-worker-secret": "w-secret", "Content-Type": "application/json" }, body: JSON.stringify(body),
        }) as never, { params: { slug } });

    it("the provisioner's 'destroy done' callback completes the delete", async () => {
        expect((await beginTenantDelete("shop", { by: "owner" })).state).toBe("deleting");
        expect(destroyCalls("store.test")).toHaveLength(1);
        expect((await tenant("shop"))?.status).toBe("deleting");

        const res = await progress({ product: "store", job: 5, kind: "destroy", state: "done", destroyed: true });
        expect(await res.json()).toMatchObject({ deleted: true });
        expect(await tenant("shop")).toBeNull();
    });

    it("'destroy failed' keeps the store and alerts", async () => {
        await beginTenantDelete("shop", { by: "owner" });
        await progress({ product: "store", job: 5, kind: "destroy", state: "failed", error: "teardown incomplete: Cloudinary media under stores/shop/ was not fully deleted" });
        const row = await tenant("shop");
        expect(row?.status).toBe("deleting");
        expect(row?.lastError).toMatch(/Cloudinary/);
        expect(alertAdmins).toHaveBeenCalled();
    });

    it("a failed teardown for a row that no longer exists is not dropped silently", async () => {
        await progress({ kind: "destroy", state: "failed", error: "compose down failed" }, "ghost");
        expect(alertAdmins).toHaveBeenCalledWith(expect.stringContaining("ghost"), expect.stringContaining("compose down failed"));
    });

    it("cron: a store the host no longer knows at all (404) counts as torn down", async () => {
        storeProv.del = { status: 500, body: { error: "boom" } };
        await beginTenantDelete("shop", { by: "owner" });
        storeProv.status = { status: 404, body: { error: "unknown store" } };
        expect(await reconcileAllDeleting()).toMatchObject({ shop: "deleted" });
    });

    it("cron: the last job on the host was not a teardown → the teardown is sent again", async () => {
        storeProv.del = { status: 409, body: { error: "a job is already running for this slug" } };
        await beginTenantDelete("shop", { by: "owner" });
        storeProv = { del: { status: 202 }, status: { status: 200, body: { kind: "update-image", state: "done" } } };
        expect(await reconcileAllDeleting()).toMatchObject({ shop: "restarted" });
    });
});

describe("routes", () => {
    it("DELETE /api/academies/[slug]: 409 while the academy is still being created", async () => {
        getCurrentUser.mockResolvedValue({ id: "u1", role: "client" });
        await mysql.tenant.update({ where: { slug: "acme" }, data: { status: "provisioning" } });
        const res = await deleteAcademy(new Request("http://x") as never, { params: { slug: "acme" } });
        expect(res.status).toBe(409);
        expect((await tenant("acme"))?.status).toBe("provisioning");
    });

    it("DELETE /api/academies/[slug]: someone else's academy → 403, untouched", async () => {
        getCurrentUser.mockResolvedValue({ id: "intruder", role: "client" });
        const res = await deleteAcademy(new Request("http://x") as never, { params: { slug: "acme" } });
        expect(res.status).toBe(403);
        expect((await tenant("acme"))?.status).toBe("live");
        expect(calls).toHaveLength(0);
    });

    it("owners no longer see a store that is being deleted; admins do", async () => {
        await beginTenantDelete("shop", { by: "owner" });
        getCurrentUser.mockResolvedValue({ id: "u1", role: "client" });
        const mine = await (await listStores()).json();
        expect(JSON.stringify(mine)).not.toContain("\"shop\"");
        getCurrentUser.mockResolvedValue({ id: "a1", role: "admin" });
        const all = await (await listStores()).json();
        expect(JSON.stringify(all)).toContain("\"shop\"");
    });
});

describe("a tenant being deleted can no longer be changed", () => {
    it("PATCH (e.g. a retry) on a deleting academy or store → 409, untouched", async () => {
        const { PATCH: patchAcademy } = await import("@/app/api/academies/[slug]/route");
        const { PATCH: patchStore } = await import("@/app/api/stores/[slug]/route");
        getCurrentUser.mockResolvedValue({ id: "a1", role: "admin" });
        await beginTenantDelete("acme", { by: "admin" });
        await beginTenantDelete("shop", { by: "admin" });
        const req = (body: unknown) => new Request("http://x", { method: "PATCH", body: JSON.stringify(body) }) as never;
        expect((await patchAcademy(req({ tier: "pro" }), { params: { slug: "acme" } })).status).toBe(409);
        expect((await patchStore(req({ validUntil: "2030-01-01" }), { params: { slug: "shop" } })).status).toBe(409);
        expect((await tenant("acme"))?.tier).toBe("demo");
        expect((await tenant("shop"))?.validUntil ?? null).toBeNull();
        expect((await tenant("shop"))?.status).toBe("deleting");
    });
});
