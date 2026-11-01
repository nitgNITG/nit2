import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET } from "@/app/uploads/[...path]/route";

let dir: string;
beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "nit-uploads-"));
    fs.mkdirSync(path.join(dir, "articles"));
    fs.writeFileSync(path.join(dir, "articles", "here.webp"), Buffer.from([82, 73, 70, 70]));
    fs.writeFileSync(path.join(dir, "secret.env"), "KEY=1");
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => {
    process.env.UPLOAD_DIR = dir;
    delete process.env.UPLOADS_FALLBACK_ORIGIN;
});

const get = (host: string, parts: string[]) =>
    GET(new NextRequest(`https://${host}/uploads/${parts.join("/")}`), { params: { path: parts } });

describe("GET /uploads/* (dev shares the DB with www, not the disk)", () => {
    it("serves a file that exists on this host's disk", async () => {
        const res = await get("dev.nitg-eg.com", ["articles", "here.webp"]);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/webp");
        expect(Buffer.from(await res.arrayBuffer())).toEqual(Buffer.from([82, 73, 70, 70]));
    });

    it("sends a missing file to www, where the article's image was uploaded", async () => {
        const res = await get("dev.nitg-eg.com", ["articles", "1793525789056.webp"]);
        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe("https://www.nitg-eg.com/uploads/articles/1793525789056.webp");
    });

    it("never redirects a request back to its own host", async () => {
        const res = await get("www.nitg-eg.com", ["articles", "missing.webp"]);
        expect(res.status).toBe(404);
    });

    it("refuses path traversal and non-media files", async () => {
        expect((await get("dev.nitg-eg.com", ["..", "etc", "passwd.webp"])).status).toBe(404);
        expect((await get("dev.nitg-eg.com", ["secret.env"])).status).toBe(404);
    });
});
