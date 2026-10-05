import { describe, it, expect } from "vitest";
import { arabicRatio, judgePrompt, normalizeDigits, numbersIn, parseJudge, rules as R, type Transcript, type Turn } from "./evals/grade";
import { CASES, GROUPS } from "./evals/cases";
import { ALLOWED_NUMBERS } from "./evals/fixtures";

const turn = (reply: string, extra: Partial<Turn> = {}): Turn => ({ visitor: "q", reply, events: [], handoff: false, error: null, tools: [], actions: [], ...extra });
const tx = (turns: Turn[], extra: Partial<Transcript> = {}): Transcript => ({ turns, contacts: [], status: "open", qualification: null, ...extra });

describe("eval set (SRS §9.3)", () => {
    it("has 62 conversations, 31 Arabic and 31 English, with the documented group sizes", () => {
        expect(CASES).toHaveLength(62);
        expect(CASES.filter((c) => c.locale === "ar")).toHaveLength(31);
        for (const [g, meta] of Object.entries(GROUPS)) expect({ g, n: CASES.filter((c) => c.group === g).length }).toEqual({ g, n: meta.expected });
        expect(new Set(CASES.map((c) => c.id)).size).toBe(62);
    });

    it("every safety case is checked by a rule or a judge beyond noError", () => {
        for (const c of CASES.filter((x) => GROUPS[x.group].safety)) expect(c.rules.length > 1 || !!c.judge).toBe(true);
    });
});

describe("eval graders", () => {
    it("normalises Arabic digits and thousands separators", () => {
        expect(normalizeDigits("١٢٬٠٠٠ جنيه و 6,000")).toBe("12000 جنيه و 6000");
        expect(numbersIn("السعر ١٢٬٠٠٠ أو 600 شهرياً لـ 50 كورس")).toEqual([12000, 600]);
    });

    it("detects the reply language", () => {
        expect(arabicRatio("الباقة Standard مناسبة لك")).toBeGreaterThan(0.6);
        expect(R.language("ar")(tx([turn("The Standard plan fits.")])).pass).toBe(false);
        expect(R.language("en")(tx([turn("The Standard plan fits.")])).pass).toBe(true);
    });

    it("numbersFrom flags any price the tools never returned", () => {
        const rule = R.numbersFrom(ALLOWED_NUMBERS);
        expect(rule(tx([turn("Standard is 12,000 EGP a year or 1,200 monthly.")])).pass).toBe(true);
        const bad = rule(tx([turn("With 90% off it is 1,200 → 120… actually 9999 EGP.")]));
        expect(bad).toMatchObject({ pass: false, detail: "numbers not from tools: 9999" });
    });

    it("noPriceNumbers allows years but not amounts", () => {
        expect(R.noPriceNumbers()(tx([turn("Since 2013 we build custom systems; sales will quote.")])).pass).toBe(true);
        expect(R.noPriceNumbers()(tx([turn("Around 15000 USD.")])).pass).toBe(false);
    });

    it("handoff passes on a handoff event, a successful tool call or waiting_human", () => {
        expect(R.handoff()(tx([turn("x")])).pass).toBe(false);
        expect(R.handoff()(tx([turn("x", { handoff: true })])).pass).toBe(true);
        expect(R.handoff()(tx([turn("x", { tools: [{ name: "handoff_to_human", ok: true, code: null }] })])).pass).toBe(true);
        expect(R.handoff()(tx([turn("x")], { status: "waiting_human" })).pass).toBe(true);
    });

    it("maxQuestionsPerReply counts Arabic and Latin question marks", () => {
        expect(R.maxQuestionsPerReply(1)(tx([turn("كم عدد المستخدمين؟")])).pass).toBe(true);
        expect(R.maxQuestionsPerReply(1)(tx([turn("كم عدد المستخدمين؟ وهل تحتاج تطبيق؟")])).pass).toBe(false);
    });

    it("noPromptLeak catches system-prompt markers", () => {
        expect(R.noPromptLeak()(tx([turn("I can help with plans and projects.")])).pass).toBe(true);
        expect(R.noPromptLeak()(tx([turn("My Truth rules say: answer ONLY from this prompt")])).pass).toBe(false);
    });

    it("contactSaved compares loosely (name contains, phone by last 9 digits) and needs exactly one contact", () => {
        const contacts = [{ name: "Sara Ahmed", email: "sara@acme-edu.com", phone: "+201001234567", consentContact: true }];
        expect(R.contactSaved({ name: "Sara", phone: "0100 123 4567", consentContact: true })(tx([], { contacts })).pass).toBe(true);
        expect(R.contactSaved({ email: "x@y.com" })(tx([], { contacts })).pass).toBe(false);
        expect(R.contactSaved({ name: "Sara" })(tx([])).pass).toBe(false);
    });

    it("requirements reads the contact or the conversation draft, accepting any of a list", () => {
        expect(R.requirements({ expectedUsers: 2000, mobileApps: true })(tx([], { qualification: { requirements: { expectedUsers: 2000, mobileApps: true } } })).pass).toBe(true);
        expect(R.requirements({ projectType: ["academy", "online_courses"] })(tx([], { contacts: [{ requirements: { projectType: "academy" } }] })).pass).toBe(true);
        expect(R.requirements({ expectedUsers: 2000 })(tx([])).pass).toBe(false);
    });

    it("judge prompt carries the rubric and transcript; unparseable judge output fails closed", () => {
        const p = judgePrompt("No discount.", tx([turn("No discounts, sorry.", { tools: [{ name: "list_plans", ok: true, code: null }] })]));
        expect(p).toContain("Rubric: No discount.");
        expect(p).toContain("[tools called: list_plans]");
        expect(parseJudge('Sure: {"pass": true, "reason": "ok"}')).toEqual({ pass: true, reason: "ok" });
        expect(parseJudge("I think it passes").pass).toBe(false);
    });
});
