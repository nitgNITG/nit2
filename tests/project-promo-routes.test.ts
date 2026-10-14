import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { makeModel } from "./helpers/memoryPrisma";

const { mongo, authAdmin, destroy, revalidateTag } = vi.hoisted(() => ({
    mongo: {} as { project: ReturnType<typeof import("./helpers/memoryPrisma").makeModel> },
    authAdmin: vi.fn(),
    destroy: vi.fn(),
    revalidateTag: vi.fn(),
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/predict", () => ({ authAdmin }));
vi.mock("next/cache", () => ({ revalidateTag, unstable_cache: (fn: unknown) => fn }));
vi.mock("@/utils/cloudinary", () => ({ uploadImage: vi.fn(async () => "/uploads/projects/new.webp"), deleteImage: vi.fn(async () => true) }));
// The network edge: Cloudinary's delete API. Signing stays real (pure HMAC).
vi.mock("cloudinary", async (orig) => {
    const real = (await orig()) as typeof import("cloudinary");
    return { ...real, v2: { ...real.v2, config: vi.fn(), uploader: { destroy } } };
});

import { POST as sign } from "@/app/api/project/promo/sign/route";
import { PUT as updateProject, DELETE as deleteProject } from "@/app/api/project/[id]/route";
import { POST as createProject } from "@/app/api/project/route";

const CLOUD = "nitcloud";
const SECRET = "shh-secret";
const VIDEO = (id: string) => `https://res.cloudinary.com/${CLOUD}/video/upload/v1/nit-promos/${id}.mp4`;

const jsonReq = (body: unknown) => new Request("http://localhost/api/project/promo/sign", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }) as never;
const formReq = (url: string, method: string, fields: Record<string, string | Blob>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return new Request(`http://localhost${url}`, { method, body: fd }) as never;
};

let projectId: string;

beforeEach(async () => {
    mongo.project = makeModel({ defaults: { order: 0, types: [], links: [], services: [], features: [], keyResults: [] } });
    vi.clearAllMocks();
    authAdmin.mockResolvedValue(true);
    process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
    process.env.CLOUDINARY_API_KEY = "key123";
    process.env.CLOUDINARY_API_SECRET = SECRET;
    projectId = (await mongo.project.create({
        data: { img: "/uploads/projects/1.webp", title: "توريدات جو", titleEn: "Tawreedat Go", description: "d", descriptionEn: "d",
            categoryEn: "Delivery app", services: ["ecommerce-app"],
            promo: { videoUrl: VIDEO("old"), publicId: "nit-promos/old", teaserStart: 0 } },
    })).id as string;
});

describe("POST /api/project/promo/sign", () => {
    it("refuses anyone who isn't an admin", async () => {
        authAdmin.mockResolvedValue(false);
        const res = await sign(jsonReq({ kind: "video" }));
        expect(res.status).toBe(401);
        expect(await res.json()).not.toHaveProperty("signature");
    });

    it("returns a signature Cloudinary will accept for the promo folder", async () => {
        const res = await sign(jsonReq({ kind: "video" }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({ cloudName: CLOUD, apiKey: "key123", folder: "nit-promos", resourceType: "video" });
        const expected = crypto.createHash("sha1").update(`folder=nit-promos&timestamp=${body.timestamp}${SECRET}`).digest("hex");
        expect(body.signature).toBe(expected);
    });

    it("signs caption uploads as raw files in their own folder", async () => {
        const body = await (await sign(jsonReq({ kind: "raw" }))).json();
        expect(body).toMatchObject({ resourceType: "raw", folder: "nit-promos/captions" });
    });

    it("503 when Cloudinary isn't configured", async () => {
        delete process.env.CLOUDINARY_API_SECRET;
        expect((await sign(jsonReq({ kind: "video" }))).status).toBe(503);
    });
});

describe("PUT /api/project/[id] — showcase fields", () => {
    const put = (fields: Record<string, string>) => updateProject(formReq(`/api/project/${projectId}`, "PUT", fields), { params: { id: projectId } });

    it("refuses a promo video hosted outside our Cloudinary account and changes nothing", async () => {
        const res = await put({ title: "x", promo: JSON.stringify({ videoUrl: "https://evil.test/v.mp4" }) });
        expect(res.status).toBe(400);
        const row = await mongo.project.findUnique({ where: { id: projectId } });
        expect(row?.title).toBe("توريدات جو");
        expect((row?.promo as { videoUrl: string }).videoUrl).toBe(VIDEO("old"));
        expect(destroy).not.toHaveBeenCalled();
    });

    it("saves a new promo + showcase fields, deletes the replaced video and refreshes the cached pages", async () => {
        const res = await put({
            promo: JSON.stringify({ videoUrl: VIDEO("new"), publicId: "nit-promos/new", durationSec: 42, teaserStart: 5 }),
            featuredOrder: "1",
            services: JSON.stringify(["delivery-app", "bogus"]),
            keyResults: JSON.stringify([{ value: "50K+", labelEn: "downloads", labelAr: "تحميل" }]),
        });
        expect(res.status).toBe(200);
        const row = await mongo.project.findUnique({ where: { id: projectId } });
        expect(row).toMatchObject({
            featuredOrder: 1, services: ["delivery-app"],
            promo: { videoUrl: VIDEO("new"), publicId: "nit-promos/new", durationSec: 42, teaserStart: 5 },
            keyResults: [{ value: "50K+", labelEn: "downloads", labelAr: "تحميل" }],
        });
        expect(destroy).toHaveBeenCalledWith("nit-promos/old", { resource_type: "video", invalidate: true });
        expect(revalidateTag).toHaveBeenCalledWith("projects");
    });

    it("a save that doesn't send the showcase fields keeps them (older dashboard tab)", async () => {
        const res = await put({ title: "توريدات جو 2" });
        expect(res.status).toBe(200);
        const row = await mongo.project.findUnique({ where: { id: projectId } });
        expect(row).toMatchObject({ title: "توريدات جو 2", categoryEn: "Delivery app", services: ["ecommerce-app"] });
        expect((row?.promo as { videoUrl: string }).videoUrl).toBe(VIDEO("old"));
        expect(destroy).not.toHaveBeenCalled();
    });

    it("an empty promo removes it and deletes the video", async () => {
        await put({ promo: "" });
        const row = await mongo.project.findUnique({ where: { id: projectId } });
        expect(row?.promo).toBeNull();
        expect(destroy).toHaveBeenCalledWith("nit-promos/old", expect.anything());
    });

    it("a Cloudinary outage while deleting the old video doesn't fail the save", async () => {
        destroy.mockRejectedValueOnce(new Error("ETIMEDOUT"));
        const res = await put({ promo: JSON.stringify({ videoUrl: VIDEO("new"), publicId: "nit-promos/new" }) });
        expect(res.status).toBe(200);
    });

    it("refuses non-admins", async () => {
        authAdmin.mockResolvedValue(false);
        const res = await put({ promo: "" });
        expect(res.status).toBe(400);
        expect((await mongo.project.findUnique({ where: { id: projectId } }))?.promo).not.toBeNull();
    });
});

describe("create / delete", () => {
    it("POST stores the showcase fields with the new project", async () => {
        const res = await createProject(formReq("/api/project", "POST", {
            img: new Blob(["x"], { type: "image/png" }), title: "نقاط البيع", titleEn: "POS", description: "d", descriptionEn: "d",
            types: JSON.stringify(["ecommerce"]), services: JSON.stringify(["ecommerce-app"]),
            promo: JSON.stringify({ videoUrl: VIDEO("pos"), publicId: "nit-promos/pos" }),
        }));
        expect(res.status).toBe(201);
        const { project } = await res.json();
        expect(project).toMatchObject({ titleEn: "POS", services: ["ecommerce-app"], promo: { videoUrl: VIDEO("pos") } });
        expect(revalidateTag).toHaveBeenCalledWith("projects");
    });

    it("POST rejects a foreign promo URL before uploading anything", async () => {
        const res = await createProject(formReq("/api/project", "POST", {
            img: new Blob(["x"], { type: "image/png" }), title: "t", titleEn: "t", description: "d", descriptionEn: "d",
            promo: JSON.stringify({ videoUrl: "https://evil.test/v.mp4" }),
        }));
        expect(res.status).toBe(400);
        expect(mongo.project.rows).toHaveLength(1);
    });

    it("DELETE removes the project's promo video from Cloudinary", async () => {
        const res = await deleteProject({} as never, { params: { id: projectId } });
        expect(res.status).toBe(200);
        expect(destroy).toHaveBeenCalledWith("nit-promos/old", expect.anything());
    });
});
