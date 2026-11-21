import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// The teardown scripts themselves, run under bash with docker / apache / certbot
// stubbed: what they remove, what they leave alone, and that a failed step makes
// them exit non-zero (nit2 then keeps the tenant instead of losing track of it).
const BASH = process.env.BASH_BIN || "bash";
const hasBash = spawnSync(BASH, ["--version"]).status === 0;
const PY = process.platform === "win32" ? "python" : "python3";
const posix = (p: string) => p.replace(/\\/g, "/");
const REPO = posix(path.resolve(__dirname, ".."));

let tmp: string;
const at = (...p: string[]) => posix(path.join(tmp, ...p));
const write = (file: string, body = "") => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, body); };
const calls = () => (existsSync(at("calls.log")) ? readFileSync(at("calls.log"), "utf8") : "");

/** Stub commands: each logs "<name> <args>" to $CALLS; docker answers `ps` from env. */
function stubs() {
    const log = 'echo "$(basename "$0") $*" >> "$CALLS"';
    write(at("bin", "docker"), `#!/usr/bin/env bash
${log}
case "$1" in
  ps) [[ " $* " == *" -aq "* ]] && exit 0
      if [[ " $* " == *" -a "* ]]; then printf '%s\\n' $DOCKER_ALL; else printf '%s\\n' $DOCKER_RUNNING; fi ;;
  exec) cat >/dev/null; exit "\${DOCKER_EXEC_RC:-0}" ;;
  volume) exit 0 ;;
  *) exit 0 ;;
esac
`);
    write(at("bin", "certbot"), `#!/usr/bin/env bash
${log}
[[ "$1" == certificates ]] && printf '  Certificate Name: %s\\n' $CERTS
exit 0
`);
    for (const c of ["a2dissite", "apache2ctl", "systemctl"]) write(at("bin", c), `#!/usr/bin/env bash\n${log}\nexit 0\n`);
}

function run(script: string, args: string[], env: Record<string, string>): Promise<{ code: number; out: string }> {
    const base: Record<string, string | undefined> = { ...process.env };
    const pathKey = Object.keys(base).find((k) => k.toLowerCase() === "path") ?? "PATH";
    base[pathKey] = `${path.join(tmp, "bin")}${path.delimiter}${base[pathKey] ?? ""}`;
    return new Promise((resolve) => {
        const childEnv = { ...base, CALLS: at("calls.log"), PYTHON_BIN: PY, ...env } as unknown as NodeJS.ProcessEnv;
        const p = spawn(BASH, [script, ...args], { env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        p.stdout.on("data", (d: Buffer) => (out += d));
        p.stderr.on("data", (d: Buffer) => (out += d));
        p.on("close", (code: number | null) => resolve({ code: code ?? -1, out }));
    });
}

beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "teardown-"));
    stubs();
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe.skipIf(!hasBash)("provisioning/destroy.sh (academy)", { timeout: 60_000 }, () => {
    const SUB = "acme.academy2026.nitg-eg.com";
    const env = () => ({
        SAAS_ROOT: at("saas"), PROVISION_LOG_DIR: at("saas", "logs"), PROVISION_STAGING_DIR: at("saas", "staging"),
        APACHE_LOG_DIR: at("apache-logs"), APACHE_SITES_DIR: at("sites"), CLEANUP_MEDIA_PHP: at("none.php"),
        DB_ROOT_PW: "root", DOCKER_RUNNING: "saas_mariadb saas_moodle_acme", DOCKER_ALL: "saas_mariadb saas_moodle_acme",
        CERTS: `${SUB} learn.acme.com other-school.com`, MEDIA_START_WAIT: "0",
    });
    beforeEach(() => {
        write(at("saas", "clients", "acme", "domain-status.json"), '{"state":"active","domain":"learn.acme.com","error":"","at":1}');
        for (const f of [`${SUB}.conf`, `${SUB}-le-ssl.conf`, "learn.acme.com.conf", "learn.acme.com-le-ssl.conf", "other-school.com.conf"]) write(at("sites", f));
        for (const f of ["acme_error.log", "acme_custom_access.log.1", "acme-2_error.log"]) write(at("apache-logs", f));
    });
    const script = `${REPO}/provisioning/destroy.sh`;

    it("removes the custom domain's vhost + cert with the rest, and leaves other academies alone", async () => {
        const r = await run(script, ["acme"], env());
        expect(r.code, r.out).toBe(0);
        expect(readdirSync(at("sites"))).toEqual(["other-school.com.conf"]);
        expect(calls()).toContain(`certbot delete --cert-name ${SUB}`);
        expect(calls()).toContain("certbot delete --cert-name learn.acme.com");
        expect(calls()).not.toContain("--cert-name other-school.com");
        expect(readdirSync(at("apache-logs"))).toEqual(["acme-2_error.log"]);
        expect(existsSync(at("saas", "clients", "acme"))).toBe(false);
        expect(calls()).toContain("docker rm -f saas_moodle_acme");
    });

    it("takes the domain from nit2 when domain-status.json is already gone", async () => {
        rmSync(at("saas", "clients", "acme"), { recursive: true });
        const r = await run(script, ["acme", "learn.acme.com"], env());
        expect(r.code, r.out).toBe(0);
        expect(existsSync(at("sites", "learn.acme.com.conf"))).toBe(false);
    });

    it("a step that fails → exit 1 with what is left, the other steps still run", async () => {
        const r = await run(script, ["acme"], { ...env(), DOCKER_RUNNING: "saas_moodle_acme", DOCKER_ALL: "saas_moodle_acme" });
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/NOT fully destroyed/);
        expect(r.out).toMatch(/moodle_acme was NOT dropped/);
        expect(existsSync(at("sites", "learn.acme.com.conf"))).toBe(false);
    });

    it("starts a stopped container so its videos can be cleaned up", async () => {
        write(at("media.php"), "<?php");
        await run(script, ["acme"], { ...env(), CLEANUP_MEDIA_PHP: at("media.php"), DOCKER_RUNNING: "saas_mariadb" });
        expect(calls()).toContain("docker start saas_moodle_acme");
    });

    it("refuses an unsafe slug before touching anything", async () => {
        const r = await run(script, ["../acme"], env());
        expect(r.code).not.toBe(0);
        expect(calls()).toBe("");
        expect(readdirSync(at("sites"))).toHaveLength(5);
    });
});

describe.skipIf(!hasBash)("provisioning-store/destroy-store.sh", { timeout: 60_000 }, () => {
    const env = (mediaRc = "0") => ({
        STORE_ROOT: at("stores"), SCRIPTS_DIR: at("scripts"), NGINX_BACKUP_DIR: at("backups"),
        DB_ROOT_PW: "root", DOCKER_RUNNING: "saas_mariadb", DOCKER_ALL: "saas_mariadb", MEDIA_RC: mediaRc,
    });
    beforeEach(() => {
        for (const f of ["store.env", "compose.yml"]) write(at("stores", "clients", "shop", f), "P_SITE=1\n");
        write(at("stores", "clients", "shop", "domain-status.json"), '{"state":"active","domain":"shop.com"}');
        write(at("stores", "staging", "shop", "logo.png"));
        write(at("backups", "shop", "1", "x.conf"));
        write(at("backups", "shop-2", "1", "x.conf"));
        write(at("scripts", "proxy", "proxy.sh"), '#!/usr/bin/env bash\necho "proxy $*" >> "$CALLS"\n');
        write(at("scripts", "delete-media.sh"), '#!/usr/bin/env bash\necho "delete-media $*" >> "$CALLS"\nexit "${MEDIA_RC:-0}"\n');
    });
    const script = `${REPO}/provisioning-store/destroy-store.sh`;

    it("removes containers, db, both hosts, Cloudinary media, files and backups", async () => {
        const r = await run(script, ["shop"], env());
        expect(r.code, r.out).toBe(0);
        expect(calls()).toMatch(/docker compose -p store_shop .* down -v --remove-orphans/);
        expect(calls()).toContain("proxy remove shop shop.commerce.nitg-eg.com");
        expect(calls()).toContain("proxy remove shop shop.com");
        expect(calls()).toContain("delete-media shop");
        expect(existsSync(at("stores", "clients", "shop"))).toBe(false);
        expect(existsSync(at("stores", "staging", "shop"))).toBe(false);
        expect(existsSync(at("backups", "shop"))).toBe(false);
        expect(existsSync(at("backups", "shop-2"))).toBe(true);
    });

    it("media left on Cloudinary → exit 1 (the job fails, nit2 keeps the store)", async () => {
        const r = await run(script, ["shop"], env("1"));
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/NOT fully destroyed/);
    });

    it("an unreachable database is a failure, not a silent skip", async () => {
        const r = await run(script, ["shop"], { ...env(), DOCKER_RUNNING: "" });
        expect(r.code).toBe(1);
    });
});

describe.skipIf(!hasBash || spawnSync(PY, ["--version"]).status !== 0)("provisioning-store/delete-media.sh", { timeout: 60_000 }, () => {
    let server: Server;
    let base = "";
    let reqs: { method: string; url: string; auth: string }[];
    let failImages = false;

    beforeEach(async () => {
        reqs = [];
        failImages = false;
        let imagePage = 0;
        server = createServer((req, res) => {
            reqs.push({ method: req.method!, url: decodeURIComponent(req.url!), auth: String(req.headers.authorization) });
            const json = (code: number, body: unknown) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
            const u = decodeURIComponent(req.url!);
            if (req.method === "DELETE" && u.includes("/resources/image/upload")) {
                if (failImages) return json(500, { error: { message: "boom" } });
                return imagePage++ === 0
                    ? json(200, { deleted: { "stores/shop/brand/logo": "deleted", "stores/shop/p/1": "deleted" }, partial: true, next_cursor: "c1" })
                    : json(200, { deleted: { "stores/shop/p/2": "deleted" }, partial: false });
            }
            if (req.method === "DELETE" && u.includes("/resources/")) return json(200, { deleted: {} });
            if (req.method === "GET" && u.endsWith("/folders/stores/shop")) return json(200, { folders: [{ path: "stores/shop/brand" }] });
            if (req.method === "GET" && u.includes("/folders/")) return json(200, { folders: [] });
            if (req.method === "DELETE" && u.includes("/folders/")) return json(200, { deleted: [u] });
            json(404, {});
        });
        await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
        base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    });
    afterEach(() => new Promise<void>((r) => server.close(() => r())));

    const env = () => ({ CLOUDINARY_CLOUD_NAME: "demo", CLOUDINARY_API_KEY: "k", CLOUDINARY_API_SECRET: "s", CLOUDINARY_API_BASE: base });
    const script = `${REPO}/provisioning-store/delete-media.sh`;

    it("deletes every page of stores/<slug>/ (images, videos, raw) and the folders, deepest first", async () => {
        const r = await run(script, ["shop"], env());
        expect(r.code, r.out).toBe(0);
        expect(r.out).toContain("deleted 3 Cloudinary file(s) under stores/shop/");
        const deletes = reqs.filter((q) => q.url.includes("/resources/"));
        expect(deletes.every((q) => q.url.includes("prefix=stores/shop/"))).toBe(true); // trailing slash: never stores/shop2/
        expect(deletes.map((q) => q.url.match(/resources\/(\w+)/)![1])).toEqual(["image", "image", "video", "raw"]);
        expect(reqs.every((q) => q.auth === `Basic ${Buffer.from("k:s").toString("base64")}`)).toBe(true);
        const folderDeletes = reqs.filter((q) => q.method === "DELETE" && q.url.includes("/folders/")).map((q) => q.url.split("/folders/")[1]);
        expect(folderDeletes).toEqual(["stores/shop/brand", "stores/shop"]);
    });

    it("a Cloudinary error → exit 1", async () => {
        failImages = true;
        expect((await run(script, ["shop"], env())).code).toBe(1);
    });

    it("Cloudinary not configured → nothing to delete, exit 0, no call made", async () => {
        const r = await run(script, ["shop"], {});
        expect(r.code).toBe(0);
        expect(reqs).toHaveLength(0);
    });
});

describe.skipIf(spawnSync(PY, ["--version"]).status !== 0)("provisioning/provision-server.py teardown bookkeeping", { timeout: 60_000 }, () => {
    it("records done / failed (with the failed steps), runs one create-or-destroy per slug, always frees the lock", () => {
        const r = spawnSync(PY, ["-I", "-X", "utf8", `${REPO}/tests/helpers/check_provision_server.py`, `${REPO}/provisioning/provision-server.py`], { encoding: "utf8" });
        expect(r.stdout + r.stderr).toContain("ALL PASS");
        expect(r.status).toBe(0);
    });
});
