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

export type DnsInstruction = {
    apex: boolean;
    // Preferred record to add at the owner's DNS provider.
    record: { type: "A" | "CNAME"; host: string; value: string };
    // The always-valid A-record fallback (also the only option for an apex).
    aRecordValue: string; // server B IP, or "" if not configured
    cnameValue: string;    // <slug>.<base>
    note: string;
};

/** What to tell the owner to add at their registrar. */
export function dnsInstructions(domain: string, slug: string): DnsInstruction {
    const apex = isApex(domain);
    const cnameValue = `${slug}.${baseDomain()}`;
    const aRecordValue = serverPublicIp();
    const record: DnsInstruction["record"] = apex
        ? { type: "A", host: "@", value: aRecordValue || "(server IP — ask support)" }
        : { type: "CNAME", host: domain, value: cnameValue };
    const note = apex
        ? "Root domains can’t use CNAME, so add an A record to the server IP."
        : "Add a CNAME so it always follows the server, even if its IP changes.";
    return { apex, record, aRecordValue, cnameValue, note };
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
    domain: string, slug: string,
): Promise<{ ok: boolean; resolved: string[]; expected: string[]; detail: string }> {
    const [domainIps, subIps] = await Promise.all([resolve4(domain), resolve4(`${slug}.${baseDomain()}`)]);
    const expected = new Set(subIps);
    const ip = serverPublicIp();
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
