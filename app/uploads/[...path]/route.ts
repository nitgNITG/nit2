import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

// Images are saved under UPLOAD_DIR (served by nginx in production) or /public/uploads.
// Next only serves /public files that existed at build time, and dev shares its database
// with www but not its disk — so an article saved on one host points at a file that only
// the other host has. This route serves the file when it is on this disk and otherwise
// sends the browser to the host that does have it.

const TYPES: Record<string, string> = {
    ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".svg": "image/svg+xml", ".avif": "image/avif", ".mp4": "video/mp4", ".pdf": "application/pdf",
};

const uploadRoot = () => path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads"));
const fallbackOrigin = () => (process.env.UPLOADS_FALLBACK_ORIGIN ?? "https://www.nitg-eg.com").replace(/\/+$/, "");

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
    const parts = params.path ?? [];
    if (!parts.length || parts.some((p) => !p || p === "." || p === ".." || p.includes("\\") || p.includes("\0")))
        return new NextResponse("Not found", { status: 404 });

    const root = uploadRoot();
    const file = path.resolve(root, ...parts);
    const type = TYPES[path.extname(file).toLowerCase()];
    if (!file.startsWith(root + path.sep) || !type) return new NextResponse("Not found", { status: 404 });

    try {
        const body = await fs.readFile(file);
        return new NextResponse(body, {
            headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
        });
    } catch {
        const origin = fallbackOrigin();
        // Never bounce a request back to the host it came from.
        if (!origin || new URL(origin).host === req.nextUrl.host) return new NextResponse("Not found", { status: 404 });
        return NextResponse.redirect(`${origin}/uploads/${parts.map(encodeURIComponent).join("/")}`, 307);
    }
}
