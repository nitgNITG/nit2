import { describe, it, expect } from "vitest";
import { applyAnswers, emptySession, nextQuestion, readSession } from "@/lib/agent/qualification/engine";
import { LeadRequirementsSchema, serviceForProjectType } from "@/lib/agent/qualification/schemas";
import { DEFAULT_SCRIPTS } from "@/lib/agent/qualification/scripts";

const script = DEFAULT_SCRIPTS.elearning;

describe("qualification engine (FR-S9, TS-44)", () => {
    it("starts with the first question of the script", () => {
        expect(nextQuestion(script, emptySession())?.id).toBe("platform_type");
    });

    it("answers out of order: returns the first unanswered question in script order, never an answered one", () => {
        let s = applyAnswers(emptySession(), script, "elearning", { videoProtection: true, budgetMinUsd: 5000 });
        expect(s.answered.sort()).toEqual(["budget", "video_protection"]);
        expect(s.currentQuestionId).toBe("platform_type");

        s = applyAnswers(s, script, "elearning", { projectType: "academy", expectedUsers: 500 });
        expect(nextQuestion(script, s)?.id).toBe("mobile_apps");
        expect(s.completed).toBe(false);
    });

    it("a changed answer replaces the old one (latest wins)", () => {
        let s = applyAnswers(emptySession(), script, "elearning", { expectedUsers: 100 });
        s = applyAnswers(s, script, "elearning", { expectedUsers: 20_000 });
        expect(s.requirements.expectedUsers).toBe(20_000);
        expect(s.answered.filter((a) => a === "expected_users")).toHaveLength(1);
    });

    it("completes when every required question is answered or skipped", () => {
        let s = applyAnswers(emptySession(), script, "elearning", {
            projectType: "corporate_training", expectedUsers: 20_000, mobileApps: true, paymentGateway: true, videoProtection: true, timeline: "1to3months",
        });
        expect(s.completed).toBe(false);
        expect(s.currentQuestionId).toBe("budget");
        s = applyAnswers(s, script, "elearning", {}, ["budget"]);
        expect(s.completed).toBe(true);
        expect(s.currentQuestionId).toBeNull();
        expect(nextQuestion(script, s)).toBeNull();
    });

    it("reads a malformed stored session as empty", () => {
        expect(readSession("nonsense")).toEqual(emptySession());
        expect(readSession({ answered: [1, "x"], service: "elearning" }).answered).toEqual(["x"]);
    });
});

describe("LeadRequirements schema (§13.10, TS-32)", () => {
    it("accepts the documented fields and upper-cases the country", () => {
        const r = LeadRequirementsSchema.parse({ projectType: "online_courses", languages: ["ar", "en"], country: "sa" });
        expect(r.country).toBe("SA");
    });

    it("rejects an unknown project type and unknown keys (e.g. a model-supplied score)", () => {
        expect(LeadRequirementsSchema.safeParse({ projectType: "spaceship" }).success).toBe(false);
        expect(LeadRequirementsSchema.safeParse({ score: 100 }).success).toBe(false);
        expect(LeadRequirementsSchema.safeParse({ expectedUsers: 0 }).success).toBe(false);
        expect(LeadRequirementsSchema.safeParse({ integrations: ["x".repeat(61)] }).success).toBe(false);
    });

    it("maps project types to qualification scripts", () => {
        expect(serviceForProjectType("university")).toBe("elearning");
        expect(serviceForProjectType("ecommerce")).toBe("ecommerce");
        expect(serviceForProjectType("mobile_app")).toBe("mobile");
        expect(serviceForProjectType("custom_software")).toBe("custom");
        expect(serviceForProjectType(undefined)).toBeNull();
    });
});
