import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { analyze, formatReport, namesToProbe } from "../scripts/orphan-check.mjs";

// What the orphan check reports from the host inventories + the tenant rows — and,
// just as important, what it must NOT report: live tenants, and your own sites that
// share the tenant port range on server B (the main site, meet., lae…).
const SB = "/etc/apache2/sites-available";
const academyInv = (over: Record<string, unknown> = {}) => ({
    product: "academy", domain: "academy2026.nitg-eg.com", errors: [],
    containers: [{ slug: "live-one", state: "running" }],
    ports: { "live-one": [8101] },
    dirs: ["live-one"], databases: ["live-one"],
    vhosts: [
        { file: `${SB}/live-one.academy2026.nitg-eg.com.conf`, names: ["live-one.academy2026.nitg-eg.com"], ports: [8101] },
        { file: `${SB}/learn.live.com.conf`, names: ["learn.live.com"], ports: [8101] },
        { file: `${SB}/learn.live.com-le-ssl.conf`, names: ["learn.live.com"], ports: [8101] },
        // the provisioner's own site and a non-tenant service: never a tenant
        { file: `${SB}/saas-provision.academy2026.nitg-eg.com.conf`, names: ["saas-provision.academy2026.nitg-eg.com"], ports: [9099] },
        { file: `${SB}/meet.nitg-eg.com.conf`, names: ["meet.nitg-eg.com"], ports: [8210] },
    ],
    certs: ["live-one.academy2026.nitg-eg.com", "learn.live.com"],
    ...over,
});
const storeInv = (over: Record<string, unknown> = {}) => ({
    product: "store", domain: "commerce.nitg-eg.com", errors: [],
    containers: [{ slug: "shop", state: "running" }], ports: { shop: [9100, 9101, 9102] },
    dirs: ["shop"], databases: ["shop"], media: ["shop"],
    vhosts: [{ file: "/etc/nginx/conf.d/saas-store-shop.commerce.nitg-eg.com.conf", names: ["shop.commerce.nitg-eg.com"], ports: [9100, 9101, 9102] }],
    certs: ["shop.commerce.nitg-eg.com"],
    ...over,
});
const tenants = [
    { slug: "live-one", product: "academy", status: "live", customDomain: "learn.live.com" },
    { slug: "shop", product: "store", status: "live", customDomain: null },
];
const LIVE_SITES = { "meet.nitg-eg.com": 302 }; // what the public probe of meet. answers
const run = (inv: { academy?: unknown; store?: unknown }, t = tenants, probes: Record<string, number> = LIVE_SITES, ignore: string[] = []) =>
    analyze({ tenants: t, inventories: { academy: inv.academy ?? academyInv(), store: inv.store ?? storeInv() }, probes, ignore });
const withVhost = (v: Record<string, unknown>) => academyInv({ vhosts: [...academyInv().vhosts, v] });

describe("orphan check", () => {
    it("a clean fleet → nothing to report (own sites on the tenant port range included)", () => {
        const f = run({});
        expect(f).toEqual([]);
        expect(formatReport(f, { hosts: "academy: ok · store: ok", checked: ["academy", "store"] })).toContain("nothing left behind on both hosts");
    });

    it("probes only the vhosts no tenant owns", () => {
        expect(namesToProbe({ academy: academyInv(), store: storeInv() })).toEqual(["meet.nitg-eg.com"]);
    });

    it("a deleted academy still running on server B → HIGH, with every piece and the fix", () => {
        const f = run({ academy: academyInv({
            containers: [{ slug: "live-one", state: "running" }, { slug: "gone", state: "running" }],
            ports: { "live-one": [8101], gone: [8102] },
            dirs: ["live-one", "gone"], databases: ["live-one", "gone"],
            vhosts: [...academyInv().vhosts, { file: `${SB}/gone.academy2026.nitg-eg.com.conf`, names: ["gone.academy2026.nitg-eg.com"], ports: [8102] }],
        }) });
        expect(f).toHaveLength(1);
        expect(f[0]).toMatchObject({ severity: "high", kind: "orphan", product: "academy", slug: "gone", fix: "sudo bash /root/destroy.sh gone" });
        expect(f[0].text).toContain("container (running), database, files, vhost");
    });

    it("a stopped leftover is MEDIUM; leftover store media alone is still reported with its fix", () => {
        const f = run({
            academy: academyInv({ containers: [{ slug: "live-one", state: "running" }, { slug: "old", state: "exited" }] }),
            store: storeInv({ media: ["shop", "ex-shop"] }),
        });
        expect(f.map((x) => [x.severity, x.slug])).toEqual([["medium", "ex-shop"], ["medium", "old"]]);
        expect(f.find((x) => x.slug === "ex-shop")!.fix).toBe("sudo bash /var/www/html/saas-stores/destroy-store.sh ex-shop");
    });

    it("an unowned vhost whose site is DOWN (502/503/504) → HIGH dangling, one finding for .conf + -le-ssl.conf", () => {
        const inv = academyInv({ vhosts: [...academyInv().vhosts,
            { file: `${SB}/old-customer.com.conf`, names: ["old-customer.com"], ports: [8105] },
            { file: `${SB}/old-customer.com-le-ssl.conf`, names: ["old-customer.com"], ports: [8105] }] });
        const f = run({ academy: inv }, tenants, { ...LIVE_SITES, "old-customer.com": 503 });
        expect(f).toHaveLength(1);
        expect(f[0]).toMatchObject({ severity: "high", kind: "dangling-vhost" });
        expect(f[0].fix).toBe("sudo a2dissite old-customer.com.conf old-customer.com-le-ssl.conf; sudo rm -f "
            + `${SB}/old-customer.com.conf ${SB}/old-customer.com-le-ssl.conf; sudo apache2ctl configtest && sudo systemctl reload apache2; `
            + "sudo certbot delete --cert-name old-customer.com");
    });

    it("an unowned vhost that SERVES something is one of your own sites → left alone; unreachable → LOW, check by hand", () => {
        const v = { file: `${SB}/lae.nitg-eg.com.conf`, names: ["lae.nitg-eg.com"], ports: [8212] };
        expect(run({ academy: withVhost(v) }, tenants, { ...LIVE_SITES, "lae.nitg-eg.com": 200 })).toEqual([]);
        expect(run({ academy: withVhost(v) }, tenants, { ...LIVE_SITES, "lae.nitg-eg.com": 0 }))
            .toEqual([expect.objectContaining({ severity: "low", kind: "unchecked-vhost" })]);
    });

    it("an old domain still pointing at a live academy (its port was reused) → HIGH stale-domain", () => {
        const f = run({ academy: withVhost({ file: `${SB}/newacademy2.nitg-eg.com.conf`, names: ["newacademy2.nitg-eg.com"], ports: [8101] }) });
        expect(f).toEqual([expect.objectContaining({ severity: "high", kind: "stale-domain", slug: "live-one" })]);
        expect(f[0].text).toContain("whose domain in nit2 is learn.live.com");
    });

    it("a tenant being deleted shows as pending (with its last error), not as an orphan", () => {
        const t = [{ ...tenants[0], status: "deleting", lastError: "teardown failed: db" }, tenants[1]];
        const f = run({}, t as never);
        expect(f.filter((x) => x.slug === "live-one").map((x) => x.kind)).toEqual(["teardown-pending"]);
        expect(f.find((x) => x.slug === "live-one")!.text).toContain("teardown failed: db");
    });

    it("a live tenant with no container on its host → reported as missing", () => {
        const f = run({ store: storeInv({ containers: [] }) });
        expect(f).toEqual([expect.objectContaining({ severity: "medium", kind: "missing", slug: "shop" })]);
    });

    it("a store's custom domain on a shared host is the store's; a site proxying below the tenant range is ignored", () => {
        const f = run({
            academy: academyInv({ vhosts: [...academyInv().vhosts,
                { file: `${SB}/myshop.com.conf`, names: ["myshop.com"], ports: [9100] },
                { file: `${SB}/www.nitg-eg.com.conf`, names: ["www.nitg-eg.com"], ports: [3000] }] }),
        }, [tenants[0], { ...tenants[1], customDomain: "myshop.com" }]);
        expect(f).toEqual([]);
    });

    it("--ignore silences your own slugs and host names", () => {
        const inv = academyInv({
            containers: [...academyInv().containers, { slug: "demo", state: "running" }],
            vhosts: [...academyInv().vhosts, { file: `${SB}/old.com.conf`, names: ["old.com"], ports: [8105] }],
        });
        expect(run({ academy: inv }, tenants, { ...LIVE_SITES, "old.com": 503 }).map((x) => x.kind).sort()).toEqual(["dangling-vhost", "orphan"]);
        expect(run({ academy: inv }, tenants, { ...LIVE_SITES, "old.com": 503 }, ["demo", "old.com"])).toEqual([]);
    });

    it("a host that could not read part of its inventory says so", () => {
        const f = run({ academy: academyInv({ databases: null, errors: ["database list unavailable (DB_ROOT_PW / saas_mariadb)"] }) });
        expect(f).toEqual([expect.objectContaining({ severity: "info", kind: "partial", text: expect.stringContaining("database list unavailable") })]);
    });

    it("only one host reachable: the other product is simply not checked — and the report says so", () => {
        const f = analyze({ tenants, inventories: { academy: academyInv(), store: null }, probes: LIVE_SITES });
        expect(f).toEqual([]);
        expect(formatReport(f, { hosts: "", checked: ["academy"] })).toContain("the other one was NOT checked");
    });

    it("no host reachable: never reports 'nothing left behind'", () => {
        const out = formatReport([], { hosts: "academy: unreachable · store: not configured", checked: [] });
        expect(out).toContain("no host could be checked");
        expect(out).not.toContain("nothing left behind");
    });
});

// GET /inventory on both provisioners: the parsing of docker / mariadb / certbot /
// vhost / store.env / Cloudinary output (tests/helpers/check_inventory.py).
const PY = process.platform === "win32" ? "python" : "python3";
describe.skipIf(spawnSync(PY, ["--version"]).status !== 0)("provisioners' GET /inventory", { timeout: 60_000 }, () => {
    it("lists containers, ports, dirs, databases, vhosts, certs and Cloudinary folders from the host", () => {
        const root = path.resolve(__dirname, "..");
        const r = spawnSync(PY, ["-I", "-X", "utf8", path.join(root, "tests/helpers/check_inventory.py"),
            path.join(root, "provisioning/provision-server.py"), path.join(root, "provisioning-store/provision-server.py")], { encoding: "utf8" });
        expect(r.stdout + r.stderr).toContain("ALL PASS");
        expect(r.status).toBe(0);
    });
});
