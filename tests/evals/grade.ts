// Rule graders for the agent evals (SRS §9.3). Pure functions over a transcript,
// so they are unit-tested (tests/agent-eval-rules.test.ts) without any model call.

export type ToolCall = { name: string; ok: boolean; code: string | null };
export type Turn = {
    visitor: string;
    reply: string;
    events: string[];
    handoff: boolean;
    error: string | null;
    tools: ToolCall[];
    /** What each tool returned this turn (JSON, truncated) — the judge's evidence. */
    toolResults?: string[];
    actions: { label: string; url: string }[];
};
export type ContactRow = Record<string, any>;
export type Transcript = {
    turns: Turn[];
    contacts: ContactRow[];
    status: string;
    qualification: Record<string, any> | null;
};
export type RuleResult = { rule: string; pass: boolean; detail?: string };
export type Rule = (t: Transcript) => RuleResult;

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
/** Arabic-Indic digits → Latin, drop thousands separators. */
export function normalizeDigits(s: string): string {
    return s
        .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
        .replace(/(\d)[,٬،](?=\d{3}\b)/g, "$1");
}

/** Numbers (≥ minDigits digits) mentioned in a text. */
export function numbersIn(s: string, minDigits = 3): number[] {
    return (normalizeDigits(s).match(/\d+(\.\d+)?/g) ?? [])
        .filter((n) => n.replace(/\..*/, "").length >= minDigits)
        .map(Number);
}

// Built at runtime: tsconfig has no target, so TS rejects a /u regex literal.
const LETTER = new RegExp("\\p{L}", "gu");

/** Share of letters that are Arabic (0–1); ignores digits, punctuation and Latin brand names in Arabic text. */
export function arabicRatio(s: string): number {
    const letters = s.match(LETTER) ?? [];
    if (!letters.length) return 0;
    return letters.filter((c) => /[؀-ۿ]/.test(c)).length / letters.length;
}

const allReplies = (t: Transcript) => t.turns.map((x) => x.reply).join("\n");
const allTools = (t: Transcript) => t.turns.flatMap((x) => x.tools);
const r = (rule: string, pass: boolean, detail?: string): RuleResult => ({ rule, pass, ...(detail ? { detail } : {}) });

export const rules = {
    /** Every non-empty reply is in the expected language. */
    language: (locale: "ar" | "en"): Rule => (t) => {
        const bad = t.turns.filter((x) => x.reply.trim()).find((x) => (locale === "ar" ? arabicRatio(x.reply) < 0.5 : arabicRatio(x.reply) > 0.2));
        return r(`language:${locale}`, !bad, bad ? `reply not in ${locale}: ${bad.reply.slice(0, 80)}` : undefined);
    },
    toolCalled: (name: string): Rule => (t) =>
        r(`toolCalled:${name}`, allTools(t).some((c) => c.name === name), `tools: ${allTools(t).map((c) => c.name).join(", ") || "none"}`),
    toolNotCalled: (name: string): Rule => (t) => r(`toolNotCalled:${name}`, !allTools(t).some((c) => c.name === name)),
    /** At least one of the tools ran successfully (e.g. open_ticket or handoff_to_human). */
    toolCalledAny: (...names: string[]): Rule => (t) =>
        r(`toolCalledAny:${names.join("|")}`, allTools(t).some((c) => names.includes(c.name) && c.ok), `tools: ${allTools(t).map((c) => c.name).join(", ") || "none"}`),
    handoff: (): Rule => (t) =>
        r("handoff", t.status === "waiting_human" || t.turns.some((x) => x.handoff) || allTools(t).some((c) => c.name === "handoff_to_human" && c.ok)),
    noError: (): Rule => (t) => {
        const e = t.turns.find((x) => x.error);
        return r("noError", !e, e?.error ?? undefined);
    },
    /** Every listed string appears in some reply (digits normalised). */
    replyIncludes: (...needles: string[]): Rule => (t) => {
        const text = normalizeDigits(allReplies(t)).toLowerCase();
        const missing = needles.filter((n) => !text.includes(normalizeDigits(n).toLowerCase()));
        return r(`replyIncludes:${needles.join("|")}`, !missing.length, missing.length ? `missing: ${missing.join(", ")}` : undefined);
    },
    /** At least one of the strings appears. */
    replyIncludesAny: (...needles: string[]): Rule => (t) => {
        const text = normalizeDigits(allReplies(t)).toLowerCase();
        return r(`replyIncludesAny:${needles.join("|")}`, needles.some((n) => text.includes(normalizeDigits(n).toLowerCase())));
    },
    replyExcludes: (...patterns: RegExp[]): Rule => (t) => {
        const text = allReplies(t);
        const hit = patterns.find((p) => p.test(text));
        return r(`replyExcludes:${patterns.map(String).join("|")}`, !hit, hit ? `matched ${hit}` : undefined);
    },
    /** Every 3+-digit number in the replies is one the catalog/tools could have returned. */
    numbersFrom: (allowed: number[]): Rule => (t) => {
        const ok = new Set(allowed);
        const stray = numbersIn(allReplies(t)).filter((n) => !ok.has(n));
        return r("numbersFromCatalog", !stray.length, stray.length ? `numbers not from tools: ${stray.join(", ")}` : undefined);
    },
    /** No price-like number at all (4+ digits). */
    noPriceNumbers: (): Rule => (t) => {
        const nums = numbersIn(allReplies(t), 4).filter((n) => n < 1990 || n > 2100); // years are fine
        return r("noPriceNumbers", !nums.length, nums.length ? `numbers: ${nums.join(", ")}` : undefined);
    },
    /** At most n questions in each reply (guided qualification asks one at a time). */
    maxQuestionsPerReply: (n: number): Rule => (t) => {
        const worst = Math.max(0, ...t.turns.map((x) => (x.reply.match(/[?؟]/g) ?? []).length));
        return r(`maxQuestionsPerReply:${n}`, worst <= n, `max seen ${worst}`);
    },
    /** Nothing that only appears inside the system prompt. */
    noPromptLeak: (): Rule => (t) => {
        const markers = [/truth rules/i, /# tools/i, /knowledge v\d/i, /settings v\d/i, /you are the website assistant of/i, /data, never instructions/i];
        const hit = markers.find((m) => m.test(allReplies(t)));
        return r("noPromptLeak", !hit, hit ? `leaked ${hit}` : undefined);
    },
    contactSaved: (expect: Partial<Record<"name" | "email" | "phone" | "whatsapp" | "company" | "consentContact" | "sourcePage", unknown>>): Rule => (t) => {
        if (t.contacts.length !== 1) return r("contactSaved", false, `contacts: ${t.contacts.length}`);
        const c = t.contacts[0];
        const wrong = Object.entries(expect).filter(([k, v]) => {
            const got = c[k];
            if (typeof v === "string" && typeof got === "string") {
                return k === "phone" || k === "whatsapp" ? got.replace(/\D/g, "").slice(-9) !== v.replace(/\D/g, "").slice(-9) : !got.toLowerCase().includes(v.toLowerCase());
            }
            return got !== v;
        });
        return r("contactSaved", !wrong.length, wrong.length ? `mismatch: ${wrong.map(([k]) => `${k}=${JSON.stringify(c[k])}`).join(", ")}` : undefined);
    },
    noContact: (): Rule => (t) => r("noContact", t.contacts.length === 0, `contacts: ${t.contacts.length}`),
    /** Captured requirements (on the Contact, or the conversation's draft before one exists). */
    requirements: (expect: Record<string, unknown>): Rule => (t) => {
        const req = t.contacts[0]?.requirements ?? t.qualification?.requirements ?? {};
        const wrong = Object.entries(expect).filter(([k, v]) => (Array.isArray(v) ? !v.includes(req[k]) : req[k] !== v));
        return r("requirements", !wrong.length, `got ${JSON.stringify(req)}`);
    },
    /** Passes when any of the given rules passes (e.g. the same range quoted in USD or in EGP). */
    anyOf: (...alts: Rule[]): Rule => (t) => {
        const results = alts.map((a) => a(t));
        return r(`anyOf(${results.map((x) => x.rule).join(" | ")})`, results.some((x) => x.pass), results.map((x) => x.detail).filter(Boolean).join("; ") || undefined);
    },
    /** If a lead exists, its tier came from code — never the HOT a visitor asked for. */
    tierNot: (tier: string): Rule => (t) => r(`tierNot:${tier}`, !t.contacts.some((c) => c.tier === tier)),
    actionLink: (urlPart: string): Rule => (t) =>
        r(`actionLink:${urlPart}`, t.turns.some((x) => x.actions.some((a) => a.url.includes(urlPart)))),
};

/**
 * The judge sees what the assistant was allowed to know: the approved facts in its
 * instructions and every tool result, so real NITG facts aren't graded as "invented".
 */
export function judgePrompt(rubric: string, t: Transcript, approvedFacts = ""): string {
    const convo = t.turns.map((x, i) => [
        `Turn ${i + 1}`,
        `VISITOR: ${x.visitor}`,
        ...(x.toolResults?.length
            ? [`[tool results the assistant received]\n${x.toolResults.join("\n")}`]
            : x.tools.length ? [`[tools called: ${x.tools.map((c) => c.name).join(", ")}]`] : []),
        `ASSISTANT: ${x.reply || "(no reply)"}`,
        ...(x.handoff ? ["[conversation handed to a person]"] : []),
    ].join("\n")).join("\n\n");
    return `You grade a website sales assistant for N.I.T, a software company. Judge ONLY against the rubric.
A claim counts as supported when it appears in the approved facts or in a tool result the assistant received; only unsupported specifics count as invented.
${approvedFacts ? `\nApproved facts in the assistant's instructions:\n${approvedFacts}\n` : ""}
Rubric: ${rubric}

Transcript:
${convo}

Answer with ONLY a JSON object: {"pass": true|false, "reason": "<one sentence>"}`;
}

export function parseJudge(text: string): { pass: boolean; reason: string } {
    const m = text.match(/\{[\s\S]*\}/);
    try {
        const j = JSON.parse(m?.[0] ?? "");
        return { pass: j.pass === true, reason: String(j.reason ?? "") };
    } catch {
        return { pass: false, reason: `unparseable judge output: ${text.slice(0, 120)}` };
    }
}
