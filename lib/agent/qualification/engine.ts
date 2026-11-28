// Qualification engine (SRS §13.10). The SERVER keeps the session and decides the
// next question; the model only phrases it. Answers arrive through capture_lead.
import type { LeadRequirements, QualificationService, RequirementField } from "./schemas";
import type { Question, Script } from "./scripts";

export type QualificationSession = {
    service: QualificationService | null;
    scriptVersion: number | null;
    currentQuestionId: string | null;
    answered: string[]; // question ids
    skipped: string[]; // question ids the visitor declined to answer
    requirements: LeadRequirements;
    completed: boolean;
};

export function emptySession(): QualificationSession {
    return { service: null, scriptVersion: null, currentQuestionId: null, answered: [], skipped: [], requirements: {}, completed: false };
}

/** Read a stored session defensively (it is JSON on the Conversation). */
export function readSession(raw: unknown): QualificationSession {
    const base = emptySession();
    if (!raw || typeof raw !== "object") return base;
    const r = raw as Partial<QualificationSession>;
    return {
        service: r.service ?? null,
        scriptVersion: typeof r.scriptVersion === "number" ? r.scriptVersion : null,
        currentQuestionId: r.currentQuestionId ?? null,
        answered: Array.isArray(r.answered) ? r.answered.filter((x) => typeof x === "string") : [],
        skipped: Array.isArray(r.skipped) ? r.skipped.filter((x) => typeof x === "string") : [],
        requirements: r.requirements && typeof r.requirements === "object" ? r.requirements : {},
        completed: !!r.completed,
    };
}

function hasValue(v: unknown): boolean {
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
}

/** First unanswered, unskipped question in script order; null when none remain. */
export function nextQuestion(script: Script, s: QualificationSession): Question | null {
    for (const q of script.questions) {
        if (s.answered.includes(q.id) || s.skipped.includes(q.id)) continue;
        if (hasValue(s.requirements[q.field as RequirementField])) continue;
        return q;
    }
    return null;
}

/**
 * Merge a requirements patch (latest answer wins), mark questions answered/skipped,
 * then recompute the current question and completion.
 */
export function applyAnswers(
    s: QualificationSession,
    script: Script | null,
    service: QualificationService | null,
    patch: LeadRequirements,
    skippedIds: string[] = [],
): QualificationSession {
    const requirements: LeadRequirements = { ...s.requirements };
    for (const [k, v] of Object.entries(patch)) {
        if (hasValue(v)) (requirements as Record<string, unknown>)[k] = v;
    }
    const next: QualificationSession = {
        ...s,
        service: service ?? s.service,
        scriptVersion: script?.version ?? s.scriptVersion,
        requirements,
        answered: [...s.answered],
        skipped: [...s.skipped],
    };
    if (script) {
        for (const q of script.questions) {
            if (hasValue(requirements[q.field as RequirementField]) && !next.answered.includes(q.id)) next.answered.push(q.id);
            if (skippedIds.includes(q.id) && !next.answered.includes(q.id) && !next.skipped.includes(q.id)) next.skipped.push(q.id);
        }
        const nq = nextQuestion(script, next);
        next.currentQuestionId = nq?.id ?? null;
        next.completed = script.questions
            .filter((q) => q.required)
            .every((q) => next.answered.includes(q.id) || next.skipped.includes(q.id));
    }
    return next;
}
