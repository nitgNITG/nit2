"use client";
// Admin: every STORE tenant with its provisioning state and the day-2 actions
// (/api/stores/[slug]): change plan, suspend/resume, extend, move to an image
// tag, retry a failed creation, reveal/reset the owner's dashboard password,
// delete. Rows in flight poll /status so the step label updates live.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Link } from "@/navigation";

type Store = {
  id: string; name: string; slug: string; status: string; tier: string; ownerId: string | null;
  subscribedAt: string | null; validUntil: string | null; imageTag: string | null;
  progressJson: { step?: number; total?: number; label?: string; kind?: string } | null;
  lastError: string | null; createdAt: string; url: string; licenseMode: string | null;
};
type License = { key: string; name: string; product: string; active: boolean; priceEgp: number };
type Owner = { id: string; name: string | null; email: string };

const STATUS_CLS: Record<string, string> = {
  live: "bg-green-100 text-green-800", failed: "bg-red-100 text-red-800", suspended: "bg-amber-100 text-amber-800",
  queued: "bg-gray-100 text-gray-700", provisioning: "bg-blue-100 text-blue-800",
};

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [owners, setOwners] = useState<Record<string, Owner>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [cred, setCred] = useState<{ slug: string; username: string | null; password: string | null; dashboardUrl: string; admin?: { username: string; password: string | null } } | null>(null);
  const [filter, setFilter] = useState("");
  const [host, setHost] = useState<{ disk?: { free_pct: number; free_bytes: number }; memory?: { used_pct: number }; docker?: { running: number; mariadb_up: boolean }; image_tag?: string | null } | null>(null);
  const [dbBytes, setDbBytes] = useState<Record<string, number>>({});
  const [rolling, setRolling] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, l, u] = await Promise.all([
        axios.get("/api/stores"),
        axios.get("/api/licenses?product=store"),
        axios.get("/api/users").catch(() => ({ data: { users: [] } })),
      ]);
      setStores(s.data.stores ?? []);
      setLicenses((l.data.licenses ?? []).filter((x: License) => x.active));
      setOwners(Object.fromEntries((u.data.users ?? []).map((x: Owner) => [x.id, x])));
      axios.get("/api/stores/usage").then(({ data }) => {
        setHost(data.host ?? null);
        setDbBytes(Object.fromEntries(Object.entries(data.stores ?? {}).map(([k, v]: [string, any]) => [k, Number(v?.db_bytes ?? 0)])));
      }).catch(() => {});
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Could not load stores");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Live step labels: poll the rows that are still being built.
  const inFlight = useMemo(() => stores.filter((s) => s.status === "queued" || s.status === "provisioning").map((s) => s.slug), [stores]);
  useEffect(() => {
    if (!inFlight.length) return;
    const id = setInterval(async () => {
      for (const slug of inFlight) {
        try {
          const { data } = await axios.get(`/api/stores/${slug}/status`);
          setStores((cur) => cur.map((s) => (s.slug === slug ? { ...s, status: data.status, progressJson: data.progress, lastError: data.lastError, imageTag: data.imageTag } : s)));
        } catch { /* keep polling */ }
      }
    }, 4000);
    return () => clearInterval(id);
  }, [inFlight]);

  const patch = async (slug: string, body: Record<string, unknown>, okMsg: string) => {
    setBusy(slug);
    try {
      await axios.patch(`/api/stores/${slug}`, body);
      toast.success(okMsg);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Request failed");
    } finally {
      setBusy(null);
    }
  };
  const remove = async (slug: string) => {
    if (!confirm(`Delete store "${slug}" — containers, database and files? This cannot be undone.`)) return;
    setBusy(slug);
    try {
      await axios.delete(`/api/stores/${slug}`);
      toast.success("Store deleted");
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Delete failed");
    } finally {
      setBusy(null);
    }
  };
  const showCred = async (slug: string, reset: false | "owner" | "nit" = false) => {
    setBusy(slug);
    try {
      if (reset) await axios.post(`/api/stores/${slug}/credentials`, { which: reset });
      const { data } = await axios.get(`/api/stores/${slug}/credentials`);
      setCred({ slug, username: data.username ?? null, password: data.password ?? null, admin: data.admin, dashboardUrl: data.dashboardUrl ?? `${stores.find((s) => s.slug === slug)?.url}/dashboard` });
      if (reset === "owner") toast.success("Owner password reset and e-mailed");
      if (reset === "nit") toast.success("NIT support password reset");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Could not load credentials");
    } finally {
      setBusy(null);
    }
  };

  const rollout = async () => {
    const tag = prompt("Image tag to roll out to EVERY store (pinned stores are skipped)", host?.image_tag ?? "");
    if (!tag) return;
    if (!confirm(`Roll out ${tag} to all stores? Only containers whose image changed restart.`)) return;
    setRolling(true);
    try {
      await axios.post("/api/stores/update-images", { tag });
      toast.success(`Rollout of ${tag} started — watch imageTag per store`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Rollout failed");
    } finally {
      setRolling(false);
    }
  };
  const gb = (b: number) => `${(b / 1024 ** 3).toFixed(1)} GB`;

  const rows = stores.filter((s) => !filter || `${s.slug} ${s.name} ${owners[s.ownerId ?? ""]?.email ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🛒 Stores</h1>
          <p className="text-sm text-gray-500">{stores.length} stores · commerce product · provisioned as one compose project each</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by slug / name / owner" className="rounded-lg border px-3 py-2 text-sm" />
          <button onClick={rollout} disabled={rolling} className="rounded-lg border border-[#1E7D67] px-4 py-2 text-sm font-bold text-[#1E7D67] disabled:opacity-50">Roll out image…</button>
          <Link href="/build-product?product=store" className="rounded-lg bg-[#1E7D67] px-4 py-2 text-sm font-bold text-white">+ New store (comp)</Link>
        </div>
      </div>
      {host && (
        <div className="mb-4 flex flex-wrap gap-4 rounded-xl border bg-white px-4 py-3 text-xs text-gray-600">
          <span>🖥️ Store host</span>
          {host.disk && <span>Disk free: <b>{host.disk.free_pct}%</b> ({gb(host.disk.free_bytes)})</span>}
          {host.memory && <span>Memory used: <b>{host.memory.used_pct}%</b></span>}
          {host.docker && <span>Containers: <b>{host.docker.running}</b> · MariaDB {host.docker.mariadb_up ? "up ✅" : "DOWN ❌"}</span>}
          <span>Platform tag: <b className="font-mono">{host.image_tag ?? "—"}</b></span>
        </div>
      )}

      {loading ? <p className="text-gray-400">Loading…</p> : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2">Store</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Status</th><th className="px-3 py-2">Term</th><th className="px-3 py-2">Image</th><th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const owner = s.ownerId ? owners[s.ownerId] : undefined;
                const p = s.progressJson;
                const isBusy = busy === s.slug;
                return (
                  <tr key={s.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{s.name}</div>
                      <a href={s.url} target="_blank" rel="noreferrer" className="font-mono text-xs text-[#1E7D67]" dir="ltr">{s.url.replace(/^https:\/\//, "")}</a>
                    </td>
                    <td className="px-3 py-2 text-xs">{owner ? <>{owner.name || "—"}<br /><span className="text-gray-500">{owner.email}</span></> : <span className="text-gray-400">{s.ownerId ?? "—"}</span>}</td>
                    <td className="px-3 py-2">
                      <select value={s.tier} disabled={isBusy} onChange={(e) => patch(s.slug, { tier: e.target.value }, `Plan → ${e.target.value}`)} className="rounded border px-2 py-1 text-xs">
                        {!licenses.some((l) => l.key === s.tier) && <option value={s.tier}>{s.tier}</option>}
                        {licenses.map((l) => <option key={l.key} value={l.key}>{l.name} ({l.key})</option>)}
                      </select>
                      {s.licenseMode && <div className="mt-1 text-[10px] text-gray-400">paid in {s.licenseMode}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_CLS[s.status] ?? "bg-gray-100"}`}>{s.status}</span>
                      {(s.status === "queued" || s.status === "provisioning") && p && (
                        <div className="mt-1 text-xs text-gray-500">{p.label} {p.total ? `(${p.step}/${p.total})` : ""}</div>
                      )}
                      {(s.status === "failed" || s.status === "live") && s.lastError && <div className={`mt-1 max-w-[260px] break-words font-mono text-[11px] ${s.status === "failed" ? "text-red-700" : "text-amber-700"}`} dir="ltr">{s.lastError.slice(0, 160)}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div>from {fmt(s.subscribedAt)}</div>
                      <div>until {s.validUntil ? fmt(s.validUntil) : "∞"}</div>
                      <button disabled={isBusy} className="mt-1 text-[#1E7D67] underline" onClick={() => {
                        const v = prompt("New validUntil (YYYY-MM-DD), empty = never expires", s.validUntil ? s.validUntil.slice(0, 10) : "");
                        if (v === null) return;
                        patch(s.slug, { validUntil: v.trim() ? new Date(v.trim()).toISOString() : null }, "Term updated");
                      }}>extend</button>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {s.imageTag ?? "—"}
                      {dbBytes[s.slug] ? <div className="text-[10px] text-gray-400">db {(dbBytes[s.slug] / 1024 ** 2).toFixed(1)} MB</div> : null}
                      <button disabled={isBusy || !["live", "suspended"].includes(s.status)} className="ms-2 text-[#1E7D67] underline disabled:opacity-40" onClick={() => {
                        const tag = prompt("Image tag to move this store to", s.imageTag ?? "latest");
                        if (tag) patch(s.slug, { updateImage: true, tag }, `Updating to ${tag}`);
                      }}>update</button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {s.status === "failed" && <button disabled={isBusy} onClick={() => patch(s.slug, { retry: true }, "Retry queued")} className="rounded bg-blue-600 px-2 py-1 text-xs text-white">Retry</button>}
                        {s.status === "live" && s.lastError?.startsWith("TLS certificate pending") && <button disabled={isBusy} onClick={() => patch(s.slug, { issueTls: true }, "Certificate issued")} className="rounded bg-purple-600 px-2 py-1 text-xs text-white">Issue TLS</button>}
                        {s.status === "live" && <button disabled={isBusy} onClick={() => patch(s.slug, { suspend: true }, "Suspended")} className="rounded bg-amber-500 px-2 py-1 text-xs text-white">Suspend</button>}
                        {s.status === "suspended" && <button disabled={isBusy} onClick={() => patch(s.slug, { suspend: false }, "Resumed")} className="rounded bg-green-600 px-2 py-1 text-xs text-white">Resume</button>}
                        <button disabled={isBusy} onClick={() => showCred(s.slug)} className="rounded bg-gray-700 px-2 py-1 text-xs text-white">Credentials</button>
                        <button disabled={isBusy} onClick={() => remove(s.slug)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No stores yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {cred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCred(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Owner dashboard login — {cred.slug}</h2>
            <p className="mt-1 text-xs text-gray-500">Temporary password generated at creation / reset; the owner must change it on first login.</p>
            <div className="mt-4 space-y-2 font-mono text-sm" dir="ltr">
              <div><span className="text-gray-500">URL:</span> <a className="text-[#1E7D67]" href={cred.dashboardUrl} target="_blank" rel="noreferrer">{cred.dashboardUrl}</a></div>
              <div><span className="text-gray-500">Email:</span> {cred.username ?? "—"}</div>
              <div><span className="text-gray-500">Password:</span> {cred.password ?? <i className="text-gray-400">not stored (changed by owner, or encryption not configured)</i>}</div>
            </div>
            <h3 className="mt-5 text-sm font-bold">NIT support login (hidden from the merchant)</h3>
            <div className="mt-2 space-y-2 font-mono text-sm" dir="ltr">
              <div><span className="text-gray-500">Email:</span> {cred.admin?.username ?? "—"}</div>
              <div><span className="text-gray-500">Password:</span> {cred.admin?.password ?? <i className="text-gray-400">not stored</i>}</div>
            </div>
            <div className="mt-5 flex flex-wrap justify-between gap-2">
              <div className="flex gap-2">
                <button onClick={() => showCred(cred.slug, "owner")} disabled={busy === cred.slug} className="rounded bg-amber-500 px-3 py-1.5 text-sm text-white">Reset owner & e-mail</button>
                <button onClick={() => showCred(cred.slug, "nit")} disabled={busy === cred.slug} className="rounded bg-gray-700 px-3 py-1.5 text-sm text-white">Reset NIT login</button>
              </div>
              <button onClick={() => setCred(null)} className="rounded border px-3 py-1.5 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
