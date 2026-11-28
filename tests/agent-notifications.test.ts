import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMongo, makeMysql, resetAll } from "./helpers/memoryPrisma";

const { mongo, mysql, getCurrentUser, sendEmail, notifyTelegram } = vi.hoisted(() => ({
    mongo: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMongo>,
    mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql>,
    getCurrentUser: vi.fn(),
    sendEmail: vi.fn(async () => undefined),
    notifyTelegram: vi.fn(async () => undefined),
}));
vi.mock("@/prisma/client", () => ({ default: mongo }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));
vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/telegram", () => ({ notifyTelegram }));
vi.mock("@/lib/mailer", () => ({ mailerConfigured: () => true, sendEmail }));
vi.mock("@/lib/adminAlert", () => ({ alertAdmins: vi.fn(), supportWhatsapp: async () => "", adminAlertEmails: async () => ["Boss@nitg.com", "mona@nitg.com"] }));

import { DEFAULT_CONFIG } from "@/lib/agent/config";
import { performHandoff } from "@/lib/agent/runtime/handoff";
import { alertVisitorWaiting } from "@/lib/agent/alerts";
import { GET as summary } from "@/app/api/agent/admin/inbox/summary/route";

const recipients = () => (sendEmail.mock.calls as unknown as [{ to: string }][]).map(([m]) => m.to).sort();
const handoff = (conversationId: string, mode: string, config = DEFAULT_CONFIG) =>
    performHandoff({ conversationId, mode, locale: "en", config, reason: "wants a quote", summary: "Call me on +201001234567 about an LMS" });

beforeEach(async () => {
    Object.assign(mongo, makeMongo());
    Object.assign(mysql, makeMysql());
    resetAll(mongo, mysql);
    vi.clearAllMocks();
    await mysql.user.create({ data: { id: "s1", email: "mona@nitg.com", password: "x", name: "Mona", agentPermissions: ["sales"] } });
    await mysql.user.create({ data: { id: "s2", email: "omar@nitg.com", password: "x", name: "Omar", agentPermissions: ["support"] } });
    await mysql.user.create({ data: { id: "s3", email: "view@nitg.com", password: "x", agentPermissions: ["viewer"] } });
    await mysql.user.create({ data: { id: "c1", email: "client@acme.com", password: "x" } });
});

describe("team emails when a conversation is handed to a person", () => {
    it("a sales handoff emails the admin alert list + sales staff, one email each, no duplicates, PII masked", async () => {
        const c = await mongo.conversation.create({ data: { status: "open", mode: "sales" } });
        await handoff(c.id as string, "sales");
        await vi.waitFor(() => expect(sendEmail).toHaveBeenCalledTimes(2));
        expect(recipients()).toEqual(["boss@nitg.com", "mona@nitg.com"]);
        const mail = (sendEmail.mock.calls as unknown as [{ subject: string; text: string }][])[0][0];
        expect(mail.subject).toMatch(/sales conversation needs a person/);
        expect(mail.text).toContain(`/dashboard/conversations/${c.id}`);
        expect(mail.text).not.toContain("+201001234567");
        expect(notifyTelegram).toHaveBeenCalledTimes(1);
    });

    it("a support handoff goes to support staff (not sales); switched off in AI Settings → no emails, Telegram still", async () => {
        const c = await mongo.conversation.create({ data: { status: "open", mode: "support" } });
        await handoff(c.id as string, "support");
        await vi.waitFor(() => expect(sendEmail).toHaveBeenCalledTimes(3));
        expect(recipients()).toEqual(["boss@nitg.com", "mona@nitg.com", "omar@nitg.com"]); // mona via the admin list only

        sendEmail.mockClear();
        const d = await mongo.conversation.create({ data: { status: "open", mode: "sales" } });
        await handoff(d.id as string, "sales", { ...DEFAULT_CONFIG, notifications: { emailOnHandoff: false, emailOwnerOnReply: true } });
        await new Promise((r) => setTimeout(r, 20));
        expect(sendEmail).not.toHaveBeenCalled();
        expect(notifyTelegram).toHaveBeenCalledTimes(2);
    });

    it("the visitor writing again emails only the staff member who owns the conversation", async () => {
        const c = await mongo.conversation.create({ data: { status: "human", mode: "support", assignedTo: "s2" } });
        await alertVisitorWaiting(c.id as string);
        await vi.waitFor(() => expect(sendEmail).toHaveBeenCalledTimes(1));
        expect(recipients()).toEqual(["omar@nitg.com"]);
        sendEmail.mockClear();
        await alertVisitorWaiting(c.id as string, { email: false });
        await new Promise((r) => setTimeout(r, 20));
        expect(sendEmail).not.toHaveBeenCalled();
    });
});

describe("GET /api/agent/admin/inbox/summary (sidebar badge + desktop alerts)", () => {
    it("counts waiting conversations in the staff member's own inboxes and the ones they own", async () => {
        await mongo.conversation.create({ data: { status: "waiting_human", mode: "sales", lastMessageAt: new Date("2026-10-06T10:00:00Z") } });
        const newest = await mongo.conversation.create({ data: { status: "waiting_human", mode: "sales", lastMessageAt: new Date("2026-10-06T11:00:00Z") } });
        await mongo.conversation.create({ data: { status: "waiting_human", mode: "support" } });
        await mongo.conversation.create({ data: { status: "human", mode: "sales", assignedTo: "s1" } });
        await mongo.conversation.create({ data: { status: "open", mode: "sales" } });

        getCurrentUser.mockResolvedValue({ id: "s1", email: "mona@nitg.com", name: "Mona", role: "client" });
        const s = await (await summary()).json();
        expect(s).toMatchObject({ waiting: 2, mine: 1 });
        expect(s.waitingItems[0]).toMatchObject({ id: newest.id, mode: "sales" });

        getCurrentUser.mockResolvedValue({ id: "adm", email: "a@x", name: "A", role: "admin" });
        expect(await (await summary()).json()).toMatchObject({ waiting: 3, mine: 0 });

        getCurrentUser.mockResolvedValue({ id: "s3", email: "view@nitg.com", name: null, role: "client" });
        expect((await summary()).status).toBe(403);
    });
});
