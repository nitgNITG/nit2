// Default guided-qualification scripts (FR-S9). The admin edits them in the
// agent settings (config.qualificationScripts); these are the shipped defaults.
import { z } from "zod";
import type { QualificationService } from "./schemas";

const FIELDS = [
    "projectType", "expectedUsers", "mobileApps", "paymentGateway", "coupons",
    "videoProtection", "languages", "integrations", "budgetMinUsd", "timeline",
    "country", "orgType",
] as const;

export const QuestionSchema = z.strictObject({
    id: z.string().regex(/^[a-z0-9_]{1,40}$/),
    field: z.enum(FIELDS), // the LeadRequirements field this question fills
    required: z.boolean().default(true),
    ar: z.string().min(1).max(300),
    en: z.string().min(1).max(300),
});
export type Question = z.infer<typeof QuestionSchema>;

export const ScriptSchema = z.strictObject({
    version: z.number().int().min(1).default(1),
    questions: z.array(QuestionSchema).min(1).max(20),
});
export type Script = z.infer<typeof ScriptSchema>;

export const ScriptsSchema = z.strictObject({
    elearning: ScriptSchema,
    ecommerce: ScriptSchema,
    custom: ScriptSchema,
    mobile: ScriptSchema,
});
export type Scripts = Record<QualificationService, Script>;

const q = (id: string, field: (typeof FIELDS)[number], ar: string, en: string, required = true): Question =>
    ({ id, field, required, ar, en });

const budget = q("budget", "budgetMinUsd", "ما الميزانية التقريبية للمشروع بالدولار؟", "What is your approximate budget in USD?");
const timeline = q("timeline", "timeline", "متى تحتاج إطلاق المشروع؟", "When do you need to launch?");

export const DEFAULT_SCRIPTS: Scripts = {
    elearning: {
        version: 1,
        questions: [
            q("platform_type", "projectType", "ما نوع المنصة؟ (كورسات أونلاين، تدريب شركات، جامعة أو جهة حكومية، أكاديمية تجارية)", "What kind of platform is it? (online courses, corporate training, university or government, commercial academy)"),
            q("expected_users", "expectedUsers", "كم عدد المستخدمين المتوقع؟", "How many users do you expect?"),
            q("mobile_apps", "mobileApps", "هل تحتاج تطبيقات موبايل (أندرويد وiOS)؟", "Do you need mobile apps (Android and iOS)?"),
            q("payments", "paymentGateway", "هل تحتاج بوابة دفع وكوبونات خصم للطلاب؟", "Do you need online payments and coupons for students?"),
            q("video_protection", "videoProtection", "هل تحتاج حماية للفيديوهات من التحميل والتسريب؟", "Do you need video protection against downloads and leaks?"),
            budget,
            timeline,
        ],
    },
    ecommerce: {
        version: 1,
        questions: [
            q("mobile_apps", "mobileApps", "هل تحتاج تطبيق موبايل للمتجر؟", "Do you need a mobile app for the store?"),
            q("payments", "paymentGateway", "هل تحتاج الدفع الإلكتروني داخل المتجر؟", "Do you need online payments in the store?"),
            q("languages", "languages", "بأي لغات سيعمل المتجر؟", "Which languages should the store support?", false),
            budget,
            timeline,
        ],
    },
    custom: {
        version: 1,
        questions: [
            q("org_type", "orgType", "هل المشروع لفرد أم شركة أم جهة حكومية أم تعليمية؟", "Is this for an individual, a company, a government or an education body?"),
            q("integrations", "integrations", "هل يحتاج النظام للربط مع أنظمة أخرى؟ ما هي؟", "Does it need to integrate with other systems? Which ones?", false),
            q("mobile_apps", "mobileApps", "هل تحتاج تطبيقات موبايل؟", "Do you need mobile apps?"),
            budget,
            timeline,
        ],
    },
    mobile: {
        version: 1,
        questions: [
            q("org_type", "orgType", "هل التطبيق لفرد أم شركة أم جهة حكومية أم تعليمية؟", "Is the app for an individual, a company, a government or an education body?"),
            q("payments", "paymentGateway", "هل يحتاج التطبيق الدفع الإلكتروني؟", "Does the app need online payments?"),
            q("expected_users", "expectedUsers", "كم عدد المستخدمين المتوقع؟", "How many users do you expect?", false),
            budget,
            timeline,
        ],
    },
};
