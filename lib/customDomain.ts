// Custom-domain binding (Phase 2). Pure helpers — validation, apex vs subdomain
// detection, the DNS instructions we show the owner, and a DNS check that the
// domain actually points at server B. No DB or side effects here.
import { promises as dns } from "dns";

/** The base subdomain zone we own, e.g. academy2026.nitg-eg.com. */
export function baseDomain(): string {
    return (process.env.SAAS_CLIENT_DOMAIN ?? "academy2026.nitg-eg.com").toLowerCase();
}

/** Server B's public IPv4, for the apex A-record instruction. Optional — the DNS
 *  check derives "our IP" from the subdomain when this isn't set. */
export function serverPublicIp(): string {
    return (process.env.SERVER_PUBLIC_IP ?? "").trim();
}

export type DomainStatus = "none" | "pending_dns" | "verifying" | "active" | "failed";

/** Normalise owner input to a bare hostname: lowercase, no scheme/path/port/trailing dot. */
export function normalizeDomain(input: string): string {
    let d = (input ?? "").trim().toLowerCase();
    d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
    return d;
}

const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** A syntactically valid, bindable custom domain (and not one of ours). */
export function validateDomain(input: string): { ok: true; domain: string } | { ok: false; error: string } {
    const domain = normalizeDomain(input);
    if (!domain) return { ok: false, error: "Enter a domain." };
    if (!HOST_RE.test(domain)) return { ok: false, error: "That doesn’t look like a valid domain (e.g. academy.yourschool.com)." };
    const base = baseDomain();
    if (domain === base || domain.endsWith("." + base)) {
        return { ok: false, error: `Use your own domain — ${base} subdomains are managed automatically.` };
    }
    if (domain === "localhost" || /\d+\.\d+\.\d+\.\d+/.test(domain)) {
        return { ok: false, error: "Enter a domain name, not an IP or localhost." };
    }
    return { ok: true, domain };
}

/** Apex/root domain (two labels, e.g. school.com) → needs an A record; a deeper
 *  name (academy.school.com) → can use a CNAME. Heuristic: label count. Multi-part
 *  public suffixes (co.uk) are treated as apex, which is safe — we show both. */
export function isApex(domain: string): boolean {
    return domain.split(".").length <= 2;
}

export type DnsOption = {
    type: "A" | "CNAME";
    host: string;
    value: string;        // "" when the server IP isn't configured for an A record
    recommended: boolean;
    note: string;
};
export type DnsInstruction = {
    apex: boolean;
    // Both records the owner MAY add — either one works; add just one. CNAME is
    // recommended for subdomains; the A record is the alternative (and the only
    // standard option for an apex).
    options: DnsOption[];
    aRecordValue: string; // server B IP, or "" if not configured
    cnameValue: string;    // <slug>.<base>
    note: string;
};

/** What to tell the owner to add at their registrar — both a CNAME and an A
 *  record where possible, so they can use whichever their DNS provider supports. */
/** Per-product zone/IP: academies default to SAAS_CLIENT_DOMAIN + SERVER_PUBLIC_IP;
 *  stores pass their own base (STORE_CLIENT_DOMAIN) and no fixed IP (derived from DNS). */
export type DomainZone = { base?: string; publicIp?: string | null };

export function dnsInstructions(domain: string, slug: string, zone: DomainZone = {}): DnsInstruction {
    const apex = isApex(domain);
    const cnameValue = `${slug}.${zone.base ?? baseDomain()}`;
    const aRecordValue = zone.publicIp === undefined ? serverPublicIp() : (zone.publicIp ?? "");
    const options: DnsOption[] = [];

    if (!apex) {
        options.push({
            type: "CNAME", host: domain, value: cnameValue, recommended: true,
            note: "Recommended — keeps working even if our server IP ever changes.",
        });
    }
    options.push({
        type: "A", host: apex ? "@" : domain, value: aRecordValue, recommended: apex,
        note: aRecordValue
            ? (apex ? "Root domains use an A record." : "Alternative — points straight at the server IP.")
            : "Ask support for the server IP.",
    });

    const note = apex
        ? "Root domains can’t use CNAME. If your DNS provider supports ALIAS / ANAME (e.g. Cloudflare, Route 53) you can point that at the CNAME value below; otherwise use the A record. A subdomain like academy.yourschool.com is simpler."
        : "Add EITHER record — you only need one. CNAME is recommended; the A record is the alternative if your provider needs it.";
    return { apex, options, aRecordValue, cnameValue, note };
}

/** Resolve a host to its A records (following CNAMEs); [] on any failure. */
async function resolve4(host: string): Promise<string[]> {
    try {
        return await dns.resolve4(host);
    } catch {
        return [];
    }
}

/**
 * Does `domain` currently resolve to the same server as our own subdomain for this
 * academy? We compare A records: the wildcard subdomain <slug>.<base> already
 * points at server B, so if the custom domain resolves to the same IP(s) it's
 * pointing here and certbot will succeed. Also accepts a configured SERVER_PUBLIC_IP.
 */
export async function verifyDnsPointsHere(
    domain: string, slug: string, zone: DomainZone = {},
): Promise<{ ok: boolean; resolved: string[]; expected: string[]; detail: string }> {
    const [domainIps, subIps] = await Promise.all([resolve4(domain), resolve4(`${slug}.${zone.base ?? baseDomain()}`)]);
    const expected = new Set(subIps);
    const ip = zone.publicIp === undefined ? serverPublicIp() : (zone.publicIp ?? "");
    if (ip) expected.add(ip);
    if (domainIps.length === 0) {
        return { ok: false, resolved: [], expected: Array.from(expected), detail: "The domain doesn’t resolve yet. DNS can take up to a few hours to propagate." };
    }
    const match = domainIps.some((d) => expected.has(d));
    return {
        ok: match,
        resolved: domainIps,
        expected: Array.from(expected),
        detail: match ? "DNS is pointing to the server." :
            `The domain resolves to ${domainIps.join(", ")} but should point to ${Array.from(expected).join(", ") || "the academies server"}.`,
    };
}
