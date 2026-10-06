// Agent settings (FR-C1, FR-C2, NFR-19, §13.7). Stored as JSON in the MySQL
// PlatformSetting key `ai_agent_config`, validated with Zod, merged over the
// defaults below. Saves are versioned compare-and-swap: a save based on a stale
// version returns config_version_conflict (409) and keeps the newer data.
import { z } from "zod";
import mysql from "@/lib/prismaMysql";
import { MODEL_PROFILES } from "./llm/profiles";
import { DEFAULT_SCRIPTS, ScriptsSchema } from "./qualification/scripts";
import { DEFAULT_SCORING, ScoringSchema } from "./scoring/config";

export const CONFIG_KEY = "ai_agent_config";

const Hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");
const Bilingual = (max: number) => z.strictObject({ ar: z.string().max(max), en: z.string().max(max) });

export const PagePromptRuleSchema = z.strictObject({
    id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
    matcher: z.string().min(1).max(200), // path prefix after the locale, e.g. "/moodle-lms"; "*" = any public page
    delaySeconds: z.number().int().min(0).max(600),
    locale: z.enum(["ar", "en", "any"]),
    message: Bilingual(300),
    enabled: z.boolean(),
    priority: z.number().int().min(0).max(1000),
});
export type PagePromptRule = z.infer<typeof PagePromptRuleSchema>;

export const LimitsSchema = z.strictObject({
    maxToolCallsPerTurn: z.number().int().min(1).max(20),
    maxModelIterationsPerTurn: z.number().int().min(1).max(20),
    maxTurnInputTokens: z.number().int().min(1000).max(500_000),
    maxTurnOutputTokens: z.number().int().min(256).max(64_000),
    maxConversationMessages: z.number().int().min(2).max(1000),
    maxConversationTokens: z.number().int().min(1000).max(5_000_000),
    turnTimeoutSeconds: z.number().int().min(5).max(120),
});

const ConfigBodySchema = z.strictObject({
    enabled: z.strictObject({ web: z.boolean(), whatsapp: z.boolean() }),
    greeting: Bilingual(500),
    suggestions: z.strictObject({
        ar: z.array(z.string().min(1).max(120)).max(3),
        en: z.array(z.string().min(1).max(120)).max(3),
    }),
    workingHours: z.strictObject({
        days: z.array(z.number().int().min(0).max(6)).max(7), // 0 = Sunday
        from: Hhmm,
        to: Hhmm,
        tz: z.string().min(1).max(64),
    }),
    notes: Bilingual(20_000),
    dailyBudgetUsd: z.number().min(0).max(10_000),
    modelProfiles: z.strictObject({ chat: z.enum(MODEL_PROFILES), summary: z.enum(MODEL_PROFILES) }),
    companyFacts: z.strictObject({
        foundedYear: z.number().int().min(1990).max(2100),
        projects: z.string().min(1).max(20),
        moodlePlatforms: z.string().min(1).max(20),
    }),
    qualificationScripts: ScriptsSchema,
    pagePromptRules: z.array(PagePromptRuleSchema).max(50),
    scoring: ScoringSchema,
    brochures: z.strictObject({
        company: z.string().max(500),
        services: z.record(z.string().regex(/^[a-z0-9_-]{1,40}$/), z.string().max(500)),
    }),
    // Optional public booking page (Calendly etc.) shown after request_meeting (FR-S16).
    bookingUrl: z.string().max(500).refine((u) => u === "" || /^https:\/\//.test(u), "must be https://"),
    limits: LimitsSchema,
});
export type AgentConfigBody = z.infer<typeof ConfigBodySchema>;
export type AgentConfig = AgentConfigBody & { version: number };

/** Body of PUT /api/agent/admin/config (E12): the full config plus the version it was based on. */
export const ConfigSaveSchema = ConfigBodySchema.extend({ version: z.number().int().min(0) });

export const DEFAULT_CONFIG: AgentConfig = {
    version: 0,
    // Off until an admin switches it on (deploy order, §13.4).
    enabled: { web: false, whatsapp: false },
    greeting: {
        ar: "أهلاً بك! أنا المساعد الذكي لشركة N.I.T (مساعد آلي يعمل بالذكاء الاصطناعي). كيف أقدر أساعدك؟",
        en: "Hi! I'm the N.I.T AI assistant (an automated AI assistant). How can I help you?",
    },
    suggestions: {
        ar: ["ما هي باقات الأكاديمية وأسعارها؟", "عايز أعمل منصة تعليمية", "هل نفذتم مشاريع مشابهة؟"],
        en: ["What are the academy plans and prices?", "I want to build an eLearning platform", "Have you built similar projects?"],
    },
    workingHours: { days: [0, 1, 2, 3, 4], from: "10:00", to: "18:00", tz: "Africa/Cairo" },
    notes: { ar: "", en: "" },
    dailyBudgetUsd: 0, // D2: the admin sets it before go-live; 0 = no model calls
    modelProfiles: { chat: "standard", summary: "fast" },
    companyFacts: { foundedYear: 2013, projects: "150+", moodlePlatforms: "50+" },
    qualificationScripts: DEFAULT_SCRIPTS,
    // /moodle-lms redirects to /our-services/moodle-lms (next.config.mjs); both match.
    pagePromptRules: ["/our-services/moodle-lms", "/moodle-lms"].map((matcher, i) => ({
        id: i === 0 ? "lms" : "lms-legacy", matcher, delaySeconds: 20, locale: "any" as const, enabled: true, priority: 10,
        message: {
            ar: "تبحث عن منصة تعليم إلكتروني؟ أقدر أرشح لك الحل المناسب في دقيقتين.",
            en: "Looking for an eLearning platform? I can recommend a solution in 2 minutes.",
        },
    })),
    scoring: DEFAULT_SCORING,
    brochures: { company: "", services: {} },
    bookingUrl: "",
    limits: {
        maxToolCallsPerTurn: 6,
        maxModelIterationsPerTurn: 8,
        maxTurnInputTokens: 30_000,
        maxTurnOutputTokens: 1_500,
        maxConversationMessages: 60,
        maxConversationTokens: 250_000,
        turnTimeoutSeconds: 30,
    },
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Stored values over defaults, one level of objects deep at a time (arrays replace). */
function deepMerge<T>(base: T, over: unknown): T {
    if (!isPlainObject(base) || !isPlainObject(over)) return (over === undefined ? base : over) as T;
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(over)) {
        if (!(k in out)) continue; // drop keys this build doesn't know
        out[k] = isPlainObject(out[k]) && isPlainObject(v) && !["services"].includes(k) ? deepMerge(out[k], v) : v;
    }
    return out as T;
}

/** Parse a stored JSON string into a full config; anything invalid falls back to defaults. */
export function parseStoredConfig(raw: string | null | undefined): AgentConfig {
    if (!raw) return DEFAULT_CONFIG;
    try {
        const stored = JSON.parse(raw);
        const merged = deepMerge(DEFAULT_CONFIG, stored);
        const version = Number.isInteger(stored?.version) ? stored.version : 0;
        const body = ConfigBodySchema.parse(stripVersion(merged));
        return { ...body, version };
    } catch (e) {
        console.error("[agent] stored ai_agent_config is invalid — using defaults", (e as Error).message);
        return DEFAULT_CONFIG;
    }
}

function stripVersion(c: AgentConfig | Record<string, unknown>) {
    const { version: _v, ...rest } = c as Record<string, unknown>;
    void _v;
    return rest;
}

export async function getAgentConfig(): Promise<AgentConfig> {
    try {
        const row = await mysql.platformSetting.findUnique({ where: { key: CONFIG_KEY } });
        return parseStoredConfig(row?.value);
    } catch (e) {
        console.error("[agent] could not read ai_agent_config", (e as Error).message);
        return DEFAULT_CONFIG;
    }
}

export class ConfigVersionConflict extends Error {
    constructor() { super("config_version_conflict"); }
}

/**
 * Save a full config based on `input.version`. Compare-and-swap on the stored
 * string, so two admins saving from the same version: the second gets a conflict.
 */
export async function saveAgentConfig(input: z.infer<typeof ConfigSaveSchema>): Promise<AgentConfig> {
    const row = await mysql.platformSetting.findUnique({ where: { key: CONFIG_KEY } });
    const current = parseStoredConfig(row?.value);
    if (input.version !== current.version) throw new ConfigVersionConflict();
    const next: AgentConfig = { ...ConfigBodySchema.parse(stripVersion(input)), version: current.version + 1 };
    const value = JSON.stringify(next);
    if (!row) {
        try {
            await mysql.platformSetting.create({ data: { key: CONFIG_KEY, value } });
        } catch {
            throw new ConfigVersionConflict(); // someone created it first
        }
    } else {
        const res = await mysql.platformSetting.updateMany({ where: { key: CONFIG_KEY, value: row.value }, data: { value } });
        if (res.count !== 1) throw new ConfigVersionConflict();
    }
    return next;
}

/** Years of experience computed from the founding year (FR-S13): 2026 → "13+". */
export function yearsOfExperience(foundedYear: number, now: Date = new Date()): string {
    return `${Math.max(0, now.getUTCFullYear() - foundedYear)}+`;
}
