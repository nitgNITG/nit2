import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeMysql, resetAll } from "./helpers/memoryPrisma";

const { mysql } = vi.hoisted(() => ({ mysql: {} as ReturnType<typeof import("./helpers/memoryPrisma").makeMysql> }));
vi.mock("@/lib/prismaMysql", () => ({ default: mysql }));

import {
    CONFIG_KEY, ConfigVersionConflict, DEFAULT_CONFIG, getAgentConfig, parseStoredConfig, saveAgentConfig, yearsOfExperience,
} from "@/lib/agent/config";
import { pickPagePrompt } from "@/lib/agent/pagePrompts";
import { widgetAllowedOn } from "@/lib/agent/http";
import { buildCorePrompt } from "@/lib/agent/knowledge/core";

beforeEach(() => {
    Object.assign(mysql, makeMysql());
    resetAll(mysql);
});

const save = (over: Record<string, unknown>, version: number) =>
    saveAgentConfig({ ...structuredClone(DEFAULT_CONFIG), ...over, version } as Parameters<typeof saveAgentConfig>[0]);

describe("agent config (FR-C1, FR-C2, NFR-19)", () => {
    it("defaults: off, no budget, SRS limits, approved company facts", async () => {
        const cfg = await getAgentConfig();
        expect(cfg.enabled).toEqual({ web: false, whatsapp: false });
        expect(cfg.dailyBudgetUsd).toBe(0);
        expect(cfg.limits.maxToolCallsPerTurn).toBe(6);
        expect(cfg.companyFacts).toEqual({ foundedYear: 2013, projects: "150+", moodlePlatforms: "50+" });
        expect(cfg.modelProfiles).toEqual({ chat: "standard", summary: "fast" });
    });

    it("merges a partial stored config over the defaults", () => {
        const cfg = parseStoredConfig(JSON.stringify({ version: 7, greeting: { ar: "مرحبا" } }));
        expect(cfg.version).toBe(7);
        expect(cfg.greeting).toEqual({ ar: "مرحبا", en: DEFAULT_CONFIG.greeting.en });
        expect(cfg.limits).toEqual(DEFAULT_CONFIG.limits);
    });

    it("falls back to defaults when the stored config is invalid (e.g. a free-text model id)", () => {
        expect(parseStoredConfig(JSON.stringify({ modelProfiles: { chat: "gpt-9", summary: "fast" } }))).toEqual(DEFAULT_CONFIG);
        expect(parseStoredConfig("{not json")).toEqual(DEFAULT_CONFIG);
    });

    it("AC-13.1 / TS-21: a saved greeting is read back with no restart", async () => {
        const saved = await save({ greeting: { ar: "أهلاً جديد", en: "New hi" } }, 0);
        expect(saved.version).toBe(1);
        expect((await getAgentConfig()).greeting.ar).toBe("أهلاً جديد");
    });

    it("AC-13.2 / TS-55: a save based on a stale version gets config_version_conflict and A's change is kept", async () => {
        await save({ greeting: { ar: "A", en: "A" } }, 0); // admin A → v1
        await expect(save({ greeting: { ar: "B", en: "B" } }, 0)).rejects.toBeInstanceOf(ConfigVersionConflict);
        expect((await getAgentConfig()).greeting.ar).toBe("A");
        const row = await mysql.platformSetting.findUnique({ where: { key: CONFIG_KEY } });
        expect(JSON.parse(row!.value as string).version).toBe(1);
    });

    it("rejects an invalid save (bad HH:MM)", async () => {
        await expect(save({ workingHours: { days: [0], from: "25:00", to: "18:00", tz: "Africa/Cairo" } }, 0)).rejects.toThrow();
    });
});

describe("company facts (FR-S13, AC-24.2, TS-36)", () => {
    it("years are computed from 2013: 13+ in 2026, 14+ in 2027, no settings change", () => {
        expect(yearsOfExperience(2013, new Date("2026-10-05T00:00:00Z"))).toBe("13+");
        expect(yearsOfExperience(2013, new Date("2027-03-01T00:00:00Z"))).toBe("14+");
    });

    it("the core prompt states only the configured figures", () => {
        const p = buildCorePrompt({ ...DEFAULT_CONFIG, companyFacts: { foundedYear: 2013, projects: "160+", moodlePlatforms: "55+" } }, "sales", "en", 3);
        expect(p).toContain("160+ projects");
        expect(p).toContain("55+ Moodle platforms");
        expect(p).not.toContain("150+");
        expect(p).toContain("knowledge v3");
    });
});

describe("widget placement and page prompts (FR-W1, FR-W10, TS-40)", () => {
    it("no widget on dashboard, payment and sign-in pages", () => {
        expect(widgetAllowedOn("/ar/dashboard")).toBe(false);
        expect(widgetAllowedOn("/en/dashboard/contacts")).toBe(false);
        expect(widgetAllowedOn("/ar/payment?x=1")).toBe(false);
        expect(widgetAllowedOn("/ar/forgot-password")).toBe(false);
        expect(widgetAllowedOn("/ar/pricing")).toBe(true);
        expect(widgetAllowedOn("/ar")).toBe(true);
    });

    it("returns the eLearning prompt for the LMS page and none for the dashboard", () => {
        const rules = DEFAULT_CONFIG.pagePromptRules;
        expect(pickPagePrompt(rules, "/ar/moodle-lms", "ar")).toEqual({ id: "lms-legacy", text: DEFAULT_CONFIG.pagePromptRules[1].message.ar, delaySec: 20 });
        expect(pickPagePrompt(rules, "/en/our-services/moodle-lms", "en")?.id).toBe("lms");
        expect(pickPagePrompt(rules, "/ar/dashboard", "ar")).toBeNull();
        expect(pickPagePrompt(rules, "/ar/pricing", "ar")).toBeNull();
    });

    it("respects enabled, locale and priority", () => {
        const base = DEFAULT_CONFIG.pagePromptRules[0];
        const rules = [
            { ...base, id: "low", matcher: "*", priority: 1 },
            { ...base, id: "high-en", matcher: "/pricing", priority: 50, locale: "en" as const },
            { ...base, id: "off", matcher: "/pricing", priority: 99, enabled: false },
        ];
        expect(pickPagePrompt(rules, "/en/pricing", "en")?.id).toBe("high-en");
        expect(pickPagePrompt(rules, "/ar/pricing", "ar")?.id).toBe("low");
    });
});
