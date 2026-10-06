// A small in-memory stand-in for the Prisma clients, used by the AI-agent tests.
// It implements the query semantics the agent relies on — conditional updateMany
// (single winner), unique constraints, increments, `in` / `lt` / `has` / `isSet`
// filters, OR / NOT — so the tests exercise real behaviour rather than asserting
// on stubbed return values (AGENT_TESTING.md §4). Every operation applies in one
// synchronous step, which is what makes conditional updates atomic, as in Mongo.

type Row = Record<string, unknown>;
type Defaults = Record<string, (() => unknown) | unknown>;
type ModelSpec = { defaults?: Defaults; unique?: string[][] };

let seq = 0;
const newId = () => (++seq).toString(16).padStart(24, "0");

function clone<T>(v: T): T {
    if (v instanceof Date) return new Date(v.getTime()) as T;
    if (Array.isArray(v)) return v.map(clone) as T;
    if (v && typeof v === "object") {
        const out: Row = {};
        for (const [k, x] of Object.entries(v as Row)) out[k] = clone(x);
        return out as T;
    }
    return v;
}

const cmp = (a: unknown, b: unknown): number => {
    const x = a instanceof Date ? a.getTime() : (a as number | string);
    const y = b instanceof Date ? b.getTime() : (b as number | string);
    return x < y ? -1 : x > y ? 1 : 0;
};
const eq = (a: unknown, b: unknown) => {
    if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
    if ((a === undefined || a === null) && b === null) return a === null; // Mongo: null matches only explicit null
    return a === b;
};

// Prisma.DbNull / JsonNull / AnyNull (they expose _getName()).
const isPrismaNull = (v: unknown) => !!v && typeof (v as { _getName?: unknown })._getName === "function";

function matchField(value: unknown, cond: unknown, present: boolean): boolean {
    if (isPrismaNull(cond)) return value == null;
    if (cond === null || typeof cond !== "object" || cond instanceof Date || Array.isArray(cond)) return eq(value, cond);
    const c = cond as Row;
    for (const [op, arg] of Object.entries(c)) {
        switch (op) {
            case "equals": if (!eq(value, arg)) return false; break;
            case "in": if (!(arg as unknown[]).some((a) => eq(value, a))) return false; break;
            case "notIn": if ((arg as unknown[]).some((a) => eq(value, a))) return false; break;
            case "lt": if (value == null || cmp(value, arg) >= 0) return false; break;
            case "lte": if (value == null || cmp(value, arg) > 0) return false; break;
            case "gt": if (value == null || cmp(value, arg) <= 0) return false; break;
            case "gte": if (value == null || cmp(value, arg) < 0) return false; break;
            case "not": if (matchField(value, arg, present)) return false; break;
            case "contains": if (typeof value !== "string" || !value.includes(arg as string)) return false; break;
            case "startsWith": if (typeof value !== "string" || !value.startsWith(arg as string)) return false; break;
            case "has": if (!Array.isArray(value) || !value.includes(arg)) return false; break;
            case "isSet": if (present !== arg) return false; break;
            case "mode": break;
            default: throw new Error(`memoryPrisma: unsupported filter ${op}`);
        }
    }
    return true;
}

export function matches(row: Row, where: Row | undefined): boolean {
    if (!where) return true;
    for (const [k, cond] of Object.entries(where)) {
        if (cond === undefined) continue;
        if (k === "OR") { if (!(cond as Row[]).some((w) => matches(row, w))) return false; continue; }
        if (k === "AND") { if (!(Array.isArray(cond) ? cond : [cond]).every((w) => matches(row, w as Row))) return false; continue; }
        if (k === "NOT") { if ((Array.isArray(cond) ? cond : [cond]).some((w) => matches(row, w as Row))) return false; continue; }
        // compound unique: { key_windowStart: { key, windowStart } }
        if (k.includes("_") && cond && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)
            && k.split("_").every((part) => part in (cond as Row))) {
            if (!matches(row, cond as Row)) return false;
            continue;
        }
        if (!matchField(row[k], cond, Object.prototype.hasOwnProperty.call(row, k) && row[k] !== undefined)) return false;
    }
    return true;
}

function applyData(row: Row, data: Row) {
    for (const [k, v] of Object.entries(data)) {
        if (v === undefined) continue;
        if (isPrismaNull(v)) { row[k] = null; continue; }
        if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
            const op = v as Row;
            if ("increment" in op) { row[k] = ((row[k] as number) ?? 0) + (op.increment as number); continue; }
            if ("decrement" in op) { row[k] = ((row[k] as number) ?? 0) - (op.decrement as number); continue; }
            if ("set" in op) { row[k] = clone(op.set); continue; }
        }
        row[k] = clone(v);
    }
}

function select(row: Row, sel?: Row): Row {
    const c = clone(row);
    if (!sel) return c;
    const out: Row = {};
    for (const [k, on] of Object.entries(sel)) if (on) out[k] = c[k];
    return out;
}

function sort(rows: Row[], orderBy?: Row | Row[]): Row[] {
    if (!orderBy) return rows;
    const keys = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o) => Object.entries(o));
    return [...rows].sort((a, b) => {
        for (const [k, dir] of keys) {
            const c = cmp(a[k] ?? -Infinity, b[k] ?? -Infinity);
            if (c) return dir === "desc" ? -c : c;
        }
        return 0;
    });
}

export class UniqueError extends Error {
    code = "P2002";
}

export function makeModel(spec: ModelSpec = {}) {
    const rows: Row[] = [];
    const uniques = [["id"], ...(spec.unique ?? [])];
    const find = (where: Row) => rows.find((r) => matches(r, where));
    const checkUnique = (candidate: Row, self?: Row) => {
        for (const fields of uniques) {
            if (fields.some((f) => candidate[f] == null)) continue;
            const clash = rows.find((r) => r !== self && fields.every((f) => eq(r[f], candidate[f])));
            if (clash) throw new UniqueError(`Unique constraint failed on ${fields.join(",")}`);
        }
    };
    const create = ({ data, select: sel }: { data: Row; select?: Row }) => {
        const now = new Date();
        const row: Row = { id: newId(), createdAt: now, updatedAt: now };
        for (const [k, d] of Object.entries(spec.defaults ?? {})) row[k] = typeof d === "function" ? (d as () => unknown)() : clone(d);
        applyData(row, data);
        checkUnique(row);
        rows.push(row);
        return select(row, sel);
    };
    const model = {
        rows,
        async create(args: { data: Row; select?: Row }) { return create(args); },
        async findUnique({ where, select: sel }: { where: Row; select?: Row }) { const r = find(where); return r ? select(r, sel) : null; },
        async findFirst({ where, orderBy, select: sel }: { where?: Row; orderBy?: Row | Row[]; select?: Row } = {}) {
            const r = sort(rows.filter((x) => matches(x, where)), orderBy)[0];
            return r ? select(r, sel) : null;
        },
        async findMany({ where, orderBy, take, skip, select: sel }: { where?: Row; orderBy?: Row | Row[]; take?: number; skip?: number; select?: Row } = {}) {
            let out = sort(rows.filter((x) => matches(x, where)), orderBy);
            if (skip) out = out.slice(skip);
            if (take != null) out = out.slice(0, take);
            return out.map((r) => select(r, sel));
        },
        async count({ where }: { where?: Row } = {}) { return rows.filter((x) => matches(x, where)).length; },
        async update({ where, data, select: sel }: { where: Row; data: Row; select?: Row }) {
            const r = find(where);
            if (!r) throw Object.assign(new Error("Record to update not found."), { code: "P2025" });
            const next = { ...r };
            applyData(next, data);
            checkUnique(next, r);
            applyData(r, { ...data, updatedAt: new Date() });
            return select(r, sel);
        },
        async updateMany({ where, data }: { where?: Row; data: Row }) {
            const hits = rows.filter((x) => matches(x, where));
            for (const r of hits) applyData(r, { ...data, updatedAt: new Date() });
            return { count: hits.length };
        },
        async upsert({ where, create: c, update: u }: { where: Row; create: Row; update: Row }) {
            const r = find(where);
            if (r) { applyData(r, { ...u, updatedAt: new Date() }); return select(r); }
            return create({ data: c });
        },
        async delete({ where }: { where: Row }) {
            const i = rows.findIndex((x) => matches(x, where));
            if (i < 0) throw Object.assign(new Error("Record to delete does not exist."), { code: "P2025" });
            return rows.splice(i, 1)[0];
        },
        async deleteMany({ where }: { where?: Row } = {}) {
            let n = 0;
            for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) { rows.splice(i, 1); n++; }
            return { count: n };
        },
        reset() { rows.length = 0; },
    };
    return model;
}

export type MemoryModel = ReturnType<typeof makeModel>;

/** The Mongo models the agent uses, with their schema defaults. */
export function makeMongo() {
    return {
        conversation: makeModel({
            defaults: {
                channel: "web", mode: "sales", status: "open", locale: "ar", tokensIn: 0, tokensOut: 0, messageCount: 0,
                stateVersion: 0, turnLockUntil: () => new Date(0), lastMessageAt: () => new Date(),
            },
        }),
        chatMessage: makeModel({ defaults: { status: "sent" } }),
        agentSession: makeModel({ defaults: { lastSeenAt: () => new Date() } }),
        toolAudit: makeModel(),
        idempotencyRecord: makeModel({ unique: [["key"]] }),
        usageDaily: makeModel({
            unique: [["date"]],
            defaults: { reservedUsd: 0, spentUsd: 0, committedUsd: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, budgetAlerted: false },
        }),
        agentUsageEvent: makeModel(),
        rateLimitBucket: makeModel({ unique: [["key", "windowStart"]], defaults: { count: 0 } }),
        customPriceRange: makeModel({ unique: [["category"]], defaults: { active: true, version: 1 } }),
        contact: makeModel({ defaults: { score: 0, stage: "lead", status: "new", isReaded: false } }),
        project: makeModel({ defaults: { order: 0, types: [], links: [] } }),
        article: makeModel({ defaults: { publishedAt: () => new Date() } }),
        servicePlan: makeModel({ defaults: { isActive: true, order: 0, currency: "USD" } }),
        meetingRequest: makeModel({ defaults: { status: "requested" } }),
        ticket: makeModel({ defaults: { status: "open" } }),
        activity: makeModel({ defaults: { type: "chat", channel: "web" } }),
    };
}

/** The MySQL models the agent reads. */
export function makeMysql() {
    return {
        license: makeModel({
            unique: [["key"]],
            defaults: {
                product: "academy", active: true, price: 0, priceEgp: 0, priceEgpMonthly: 0, durationDays: 365, maxCourses: -1,
                maxTeachers: -1, storageGb: 1, supportedApp: true, videoSource: "all", contactSales: false, popular: false, order: 0,
                limits: {}, features: {},
            },
        }),
        platformSetting: makeModel({ unique: [["key"]] }),
        user: makeModel({ unique: [["email"]], defaults: { role: "client" } }),
        tenant: makeModel({ unique: [["slug"]], defaults: { product: "academy", status: "live", tier: "demo" } }),
        subscription: makeModel({ unique: [["tenantSlug"]], defaults: { status: "active", autoRenew: true, currency: "EGP", attemptCount: 0 } }),
        payment: makeModel({ unique: [["orderId"]], defaults: { purpose: "new_academy", product: "academy", currency: "EGP", status: "pending", mode: "live" } }),
    };
}

export function resetAll(...dbs: Record<string, { reset: () => void }>[]) {
    for (const db of dbs) for (const m of Object.values(db)) m.reset();
}
