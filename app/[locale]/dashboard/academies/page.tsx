"use client";
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import BuildProductForm from "../../build-product/BuildProductForm";
import { storageInfo, formatBytes } from "@/lib/storageTiers";

type Academy = {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier: string;
};
type License = {
  key: string;
  name: string;
  active: boolean;
  storageGb?: number;
};

// Per-academy moodledata usage bar. `used` is bytes from server B; `cap` is the
// GB quota from the academy's licence (falls back to the tier default inside
// storageInfo). Colours: green ok, amber ≥80%, red over quota.
const StorageBar = ({
  used,
  cap,
  loading,
}: {
  used: number | undefined;
  cap: number | string | undefined;
  loading: boolean;
}) => {
  if (loading && used === undefined)
    return <span className="text-xs text-gray-300">…</span>;
  if (used === undefined)
    return (
      <span className="text-xs text-gray-300" title="Storage unavailable">
        —
      </span>
    );
  const info = storageInfo(used, cap);
  const bar =
    info.status === "over"
      ? "bg-red-500"
      : info.status === "warn"
        ? "bg-amber-500"
        : "bg-emerald-500";
  const txt =
    info.status === "over"
      ? "text-red-600"
      : info.status === "warn"
        ? "text-amber-600"
        : "text-gray-600";
  return (
    <div
      className="min-w-[130px]"
      title={`${formatBytes(used)} of ${info.capGb} GB (${info.pct}%)`}
    >
      <div className="flex justify-between text-xs mb-1">
        <span className={`font-medium ${txt}`}>{formatBytes(used)}</span>
        <span className="text-gray-400">/ {info.capGb} GB</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${bar}`}
          style={{ width: `${Math.min(100, info.pct)}%` }}
        />
      </div>
    </div>
  );
};

const AcademiesPage = () => {
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [brandingSlug, setBrandingSlug] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [hostDiskPct, setHostDiskPct] = useState<number | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [credSlug, setCredSlug] = useState<string | null>(null);
  const [cred, setCred] = useState<{
    username: string;
    password: string | null;
    hasPassword: boolean;
  } | null>(null);
  const [credLoading, setCredLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const licenseName = (key: string) =>
    licenses.find((l) => l.key === key)?.name ?? key;

  // Each academy's Google OAuth redirect URI must be added to the Web OAuth
  // client's "Authorized redirect URIs" in the Google Cloud Console (Google
  // has no API/wildcard for this). Domain matches provisioning/create.sh.
  const ACADEMY_DOMAIN = "academy2026.nitg-eg.com";
  const GOOGLE_CONSOLE_URL =
    "https://console.cloud.google.com/auth/clients/31169484251-lkhbei8fv9eq6tc03u498569l9jobj9r.apps.googleusercontent.com?authuser=1&project=new-academy-504912";
  const redirectUri = (slug: string) =>
    `https://${slug}.${ACADEMY_DOMAIN}/admin/oauth2callback.php`;
  const copyRedirect = async (slug: string) => {
    const url = redirectUri(slug);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(
        "Redirect URI copied — paste it into Google Cloud → Authorized redirect URIs",
      );
    } catch {
      // Clipboard API can fail (insecure context / permissions) — show it to copy by hand.
      window.prompt(
        "Copy this redirect URI into Google Cloud → Authorized redirect URIs:",
        url,
      );
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, l] = await Promise.all([
        axios.get("/api/academies"),
        axios.get("/api/licenses"),
      ]);
      setAcademies(a.data.academies ?? []);
      setLicenses(l.data.licenses ?? []);
    } catch {
      toast.error("Could not load academies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Storage usage comes from server B (a disk scan) — fetch it separately so a
  // slow/unreachable provisioning box never blocks the academies table.
  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const { data } = await axios.get("/api/academies/usage");
      setUsage(data.academies ?? {});
      setHostDiskPct(
        typeof data.host_disk_pct === "number" ? data.host_disk_pct : null,
      );
    } catch {
      // leave usage empty — the column shows "—"
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const changeTier = async (slug: string, tier: string) => {
    const prev = academies;
    setSavingSlug(slug);
    setAcademies((list) =>
      list.map((a) => (a.slug === slug ? { ...a, tier } : a)),
    );
    try {
      await axios.patch(`/api/academies/${slug}`, { tier });
      toast.success(
        `${slug} → ${licenseName(tier)} (re-applying to the site…)`,
      );
    } catch (err: any) {
      setAcademies(prev);
      toast.error(err?.response?.data?.error || "Failed to change licence");
    } finally {
      setSavingSlug(null);
    }
  };

  // Recreate EVERY live academy onto the latest baked image (the baked
  // equivalent of "pull latest code" — data is preserved).
  const updateAll = async () => {
    if (
      !window.confirm(
        "Update every live academy onto the latest image now? Each restarts for ~30s; data is preserved.",
      )
    )
      return;
    setUpdatingAll(true);
    try {
      const { data } = await axios.post("/api/academies/update-images");
      toast.success(
        `Update queued for ${data.queued}/${data.academies} academies`,
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Update failed");
    } finally {
      setUpdatingAll(false);
    }
  };

  const updateImage = async (slug: string) => {
    if (
      !window.confirm(
        `Update "${slug}" onto the latest image? Its data (courses, users, files) is preserved; the site restarts for ~30s.`,
      )
    )
      return;
    setBusySlug(slug);
    try {
      await axios.patch(`/api/academies/${slug}`, { updateImage: true });
      toast.success(`${slug}: updating to the latest image…`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Image update failed");
    } finally {
      setBusySlug(null);
    }
  };

  const toggleSuspend = async (slug: string, status: string) => {
    const suspend = status !== "suspended";
    if (
      suspend &&
      !window.confirm(
        `Suspend "${slug}"? Users will see a "suspended" notice until you resume it (data is kept).`,
      )
    )
      return;
    setBusySlug(slug);
    try {
      await axios.patch(`/api/academies/${slug}`, { suspend });
      setAcademies((list) =>
        list.map((a) =>
          a.slug === slug
            ? { ...a, status: suspend ? "suspended" : "live" }
            : a,
        ),
      );
      toast.success(`${slug} ${suspend ? "suspended" : "resumed"}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed");
    } finally {
      setBusySlug(null);
    }
  };

  const openCreds = async (slug: string) => {
    setCredSlug(slug);
    setCred(null);
    setCredLoading(true);
    try {
      const { data } = await axios.get(`/api/academies/${slug}/credentials`);
      setCred({
        username: data.username,
        password: data.password,
        hasPassword: data.hasPassword,
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Could not load credentials");
    } finally {
      setCredLoading(false);
    }
  };

  const resetCreds = async (slug: string) => {
    if (
      !window.confirm(
        `Reset "${slug}" owner password to a new one? The old password stops working; the new one is shown here and emailed to the owner.`,
      )
    )
      return;
    setResetting(true);
    try {
      const { data } = await axios.post(`/api/academies/${slug}/credentials`);
      setCred({
        username: data.username,
        password: data.password,
        hasPassword: true,
      });
      toast.success("Owner password reset");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  const copyText = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      toast.success("Copied");
    } catch {
      window.prompt("Copy:", t);
    }
  };

  const removeAcademy = async (slug: string) => {
    if (
      !window.confirm(
        `Delete "${slug}"? This tears down the live site and its data — cannot be undone.`,
      )
    )
      return;
    setBusySlug(slug);
    try {
      await axios.delete(`/api/academies/${slug}`);
      setAcademies((list) => list.filter((a) => a.slug !== slug));
      toast.success(`${slug} deleted`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Delete failed");
    } finally {
      setBusySlug(null);
    }
  };

  const options = licenses.filter((l) => l.active).map((l) => l.key);

  return (
    <div className="dashboard-container py-5 lg:py-10 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-lg md:text-xl lg:text-2xl">
            🎓 Academies
          </h4>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Manage every academy: change its licence, suspend/resume it, pull
            the latest code, or delete it. Licences are defined on the{" "}
            <strong>Licenses</strong> page.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {hostDiskPct !== null && (
            <span
              title="Disk used on the academies server (server B). Above ~85% means it is time to free space or add disk."
              className={`rounded-md border px-3 py-2 text-xs font-semibold ${hostDiskPct >= 85 ? "border-red-300 bg-red-50 text-red-600" : hostDiskPct >= 70 ? "border-amber-300 bg-amber-50 text-amber-700" : "border-gray-200 bg-gray-50 text-gray-600"}`}
            >
              🖥 Server disk {hostDiskPct}%
            </span>
          )}
          <button
            type="button"
            onClick={updateAll}
            disabled={updatingAll}
            title="Recreate every live academy onto the latest baked image (after a new image is built + SAAS_IMAGE bumped). Data is preserved."
            className="rounded-md border border-indigo-400 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-60"
          >
            {updatingAll ? "Updating…" : "⟳ Update all to latest image"}
          </button>
        </div>
      </div>

      {/* Google login redirect-URI helper — Google has no API/wildcard for this. */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <strong>Google login:</strong> for each academy, click{" "}
        <span className="font-semibold">🔗 OAuth URL</span> to copy its redirect
        URI, then paste it into the{" "}
        <a
          href={GOOGLE_CONSOLE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline"
        >
          Google Cloud OAuth client
        </a>{" "}
        → <span className="font-mono">Authorized redirect URIs</span> → Save.
        Sign in to Google as{" "}
        <span className="font-mono">nitteam2024@gmail.com</span>. Google offers
        no API or wildcard, so this is one line per academy.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Academy</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Storage</th>
              <th className="px-4 py-3 font-semibold">Licence</th>
              <th className="px-4 py-3 font-semibold">Change licence</th>
              <th className="px-4 py-3 font-semibold">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  Loading…
                </td>
              </tr>
            ) : academies.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  No academies yet.
                </td>
              </tr>
            ) : (
              academies.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{a.name}</div>
                    <div className="text-xs text-gray-400 font-mono">
                      {a.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${a.status === "suspended" ? "bg-red-50 text-red-600" : a.status === "live" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StorageBar
                      used={usage[a.slug]}
                      cap={
                        licenses.find((l) => l.key === a.tier)?.storageGb ??
                        a.tier
                      }
                      loading={usageLoading}
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#0B2923]">
                    {licenseName(a.tier)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="border rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
                      value={a.tier}
                      disabled={savingSlug === a.slug || options.length === 0}
                      onChange={(e) => changeTier(a.slug, e.target.value)}
                    >
                      {/* current tier first, in case it's inactive/removed */}
                      {!options.includes(a.tier) && (
                        <option value={a.tier}>{licenseName(a.tier)}</option>
                      )}
                      {options.map((k) => (
                        <option key={k} value={k}>
                          {licenseName(k)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateImage(a.slug)}
                        disabled={
                          busySlug === a.slug ||
                          !["live", "suspended"].includes(a.status)
                        }
                        title="Update this academy onto the latest baked image (theme/core/plugin changes + token/settings refresh) — data is preserved"
                        className="rounded-lg border border-indigo-300 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
                      >
                        {busySlug === a.slug ? "…" : "⟳ Update"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrandingSlug(a.slug)}
                        disabled={!["live", "suspended"].includes(a.status)}
                        title="Re-apply branding (logo, colours, hero, about, gallery, contact, login, footer) to this live academy"
                        className="rounded-lg border border-[#268F79]/50 px-2.5 py-1.5 text-xs font-semibold text-[#268F79] hover:bg-[#268F79]/5 disabled:opacity-40"
                      >
                        🎨 Branding
                      </button>
                      <button
                        type="button"
                        onClick={() => copyRedirect(a.slug)}
                        title={`Copy this academy's Google OAuth redirect URI:\n${redirectUri(a.slug)}\nThen paste it into the Google Cloud OAuth client (nitteam2024@gmail.com).`}
                        className="rounded-lg border border-blue-300 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        🔗 OAuth URL
                      </button>
                      <button
                        type="button"
                        onClick={() => openCreds(a.slug)}
                        disabled={!["live", "suspended"].includes(a.status)}
                        title="View the admin login for this academy (recover a lost welcome email) or reset its password"
                        className="rounded-lg border border-purple-300 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-40"
                      >
                        🔑 Login
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSuspend(a.slug, a.status)}
                        disabled={busySlug === a.slug}
                        title={
                          a.status === "suspended"
                            ? "Resume this academy"
                            : "Suspend (soft-lock) this academy"
                        }
                        className="rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      >
                        {a.status === "suspended" ? "▶ Resume" : "⏸ Suspend"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAcademy(a.slug)}
                        disabled={busySlug === a.slug}
                        title="Delete this academy permanently"
                        className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Owner credentials modal — reveal the stored owner password or reset it. */}
      {credSlug && (
        <div
          className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setCredSlug(null)}
        >
          <div
            className="relative my-16 w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h5 className="font-bold text-lg">
                🔑 Owner login —{" "}
                <span className="font-mono text-sm">{credSlug}</span>
              </h5>
              <button
                type="button"
                onClick={() => setCredSlug(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            {credLoading ? (
              <p className="text-gray-400 py-6 text-center">Loading…</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Username
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={cred?.username ?? "owner"}
                      className="flex-1 border rounded-lg px-3 py-2 font-mono text-sm bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={() => copyText(cred?.username ?? "owner")}
                      className="border rounded-lg px-3 text-sm hover:bg-gray-50"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Password
                  </label>
                  {cred?.hasPassword && cred.password ? (
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={cred.password}
                        className="flex-1 border rounded-lg px-3 py-2 font-mono text-sm bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={() => copyText(cred.password!)}
                        className="border rounded-lg px-3 text-sm hover:bg-gray-50"
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 rounded-lg bg-gray-50 border px-3 py-2">
                      No saved password (created before this feature, or the
                      owner changed it). Use <b>Reset</b> to set a new one.
                    </p>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  This is the password we generated. If the owner changed it in
                  the academy, it can’t be shown here — reset it to regain
                  access.
                </p>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => resetCreds(credSlug)}
                    disabled={resetting}
                    className="flex-1 bg-gradient-to-r from-[#268F79] to-[#0B2923] text-[#00FFB2] font-bold px-4 py-2 rounded-md disabled:opacity-60"
                  >
                    {resetting ? "Resetting…" : "↻ Reset & resend password"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCredSlug(null)}
                    className="border border-gray-300 px-4 py-2 rounded-md text-gray-600 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Re-apply-branding modal — reuses the build form in edit mode. */}
      {brandingSlug && (
        <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-xl">
            <div className="mb-2 flex items-center justify-between text-white">
              <span className="font-bold">
                🎨 Branding — <span className="font-mono">{brandingSlug}</span>
              </span>
              <button
                type="button"
                onClick={() => setBrandingSlug(null)}
                className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold hover:bg-white/20"
              >
                ✕ Close
              </button>
            </div>
            <BuildProductForm
              editSlug={brandingSlug}
              onSuccess={() => {
                setBrandingSlug(null);
                toast.success("Branding queued — it applies in ~1 min");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademiesPage;
