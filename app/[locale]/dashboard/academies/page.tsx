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
  validUntil?: string | null;
  subscribedAt?: string | null;
  createdAt?: string | null;
  googleOauthAdded?: boolean;
  owner?: { id: string; name: string | null; email: string } | null;
};
type License = {
  key: string;
  name: string;
  active: boolean;
  storageGb?: number;
};

// Display-only mirror of LICENSE_GRACE_DAYS (server default) so the badge matches
// when the expiry cron actually suspends.
const GRACE_DAYS = 3;

const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

// Expiry badge from validUntil + the academy's own status.
const expiryBadge = (
  validUntil?: string | null,
  status?: string,
): { text: string; cls: string } => {
  if (status === "suspended")
    return { text: "Suspended", cls: "bg-red-50 text-red-600" };
  if (!validUntil) return { text: "No expiry", cls: "bg-gray-100 text-gray-500" };
  const days = Math.ceil((new Date(validUntil).getTime() - Date.now()) / 86_400_000);
  if (days < -GRACE_DAYS)
    return { text: "Expired", cls: "bg-red-50 text-red-600" };
  if (days < 0)
    return {
      text: `Expired · ${GRACE_DAYS + days}d grace`,
      cls: "bg-amber-50 text-amber-700",
    };
  if (days <= 7)
    return { text: `Expiring · ${days}d`, cls: "bg-amber-50 text-amber-700" };
  return { text: "Active", cls: "bg-emerald-50 text-emerald-700" };
};

// Inline "more" icon (three dots) — avoids adding a lucide-react dependency.
const MoreHorizontalIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

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
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);
  const [subs, setSubs] = useState<Record<string, { autoRenew: boolean; status: string }>>({});
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
    admin?: {
      username: string;
      password: string | null;
      hasPassword: boolean;
    } | null;
  } | null>(null);
  const [credLoading, setCredLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Open row-actions menu: which academy + where to render the fixed dropdown.
  const [menu, setMenu] = useState<{ slug: string; top: number; left: number } | null>(null);
  // Extend-expiry modal.
  const [expiryAcademy, setExpiryAcademy] = useState<Academy | null>(null);
  const [expiryValue, setExpiryValue] = useState("");
  const [savingExpiry, setSavingExpiry] = useState(false);

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

  // Flip the per-academy bookkeeping flag: whether this academy's redirect URI has
  // been added to the Google console. Optimistic; reverts on failure.
  const toggleGoogleOauth = async (slug: string, added: boolean) => {
    setAcademies((list) =>
      list.map((a) => (a.slug === slug ? { ...a, googleOauthAdded: added } : a)),
    );
    try {
      await axios.patch(`/api/academies/${slug}`, { googleOauthAdded: added });
      toast.success(
        added ? "Marked: Google URL added ✓" : "Marked: Google URL not added",
      );
    } catch {
      setAcademies((list) =>
        list.map((a) => (a.slug === slug ? { ...a, googleOauthAdded: !added } : a)),
      );
      toast.error("Could not update Google OAuth status");
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, l, s] = await Promise.all([
        axios.get("/api/academies"),
        axios.get("/api/licenses"),
        axios.get("/api/subscriptions").catch(() => ({ data: {} })),
      ]);
      setAcademies(a.data.academies ?? []);
      setGoogleConfigured(a.data.googleConfigured ?? null);
      setLicenses(l.data.licenses ?? []);
      const map: Record<string, { autoRenew: boolean; status: string }> = {};
      for (const sub of s.data?.subscriptions ?? [])
        map[sub.academySlug] = { autoRenew: sub.autoRenew, status: sub.status };
      setSubs(map);
    } catch {
      toast.error("Could not load academies");
    } finally {
      setLoading(false);
    }
  }, []);

  // Toggle a subscription's auto-renew (admin). Optimistic; reverts on failure.
  const toggleSubAutoRenew = async (slug: string, on: boolean) => {
    const prev = subs[slug];
    setSubs((m) => ({ ...m, [slug]: { autoRenew: on, status: on ? "active" : "canceled" } }));
    try {
      await axios.patch(`/api/subscriptions/${slug}`, { autoRenew: on });
      toast.success(on ? "Auto-renew resumed" : "Auto-renew cancelled");
    } catch {
      setSubs((m) => ({ ...m, [slug]: prev }));
      toast.error("Could not update auto-renew");
    }
  };

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
        admin: data.admin ?? null,
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
      setCred((prev) => ({
        username: data.username,
        password: data.password,
        hasPassword: true,
        admin: prev?.admin ?? null, // reset only touches the owner account
      }));
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

  // Close the actions menu on Escape (keyboard accessibility).
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  // Open the extend-expiry modal, prefilled with the current expiry (YYYY-MM-DD).
  const openExpiry = (a: Academy) => {
    const d = a.validUntil ? new Date(a.validUntil) : null;
    const ymd = d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      : "";
    setExpiryValue(ymd);
    setExpiryAcademy(a);
  };

  const saveExpiry = async () => {
    if (!expiryAcademy || !expiryValue) return;
    setSavingExpiry(true);
    try {
      // Send end-of-day so the chosen day is fully included.
      const iso = new Date(`${expiryValue}T23:59:59`).toISOString();
      const { data } = await axios.patch(
        `/api/academies/${expiryAcademy.slug}`,
        { validUntil: iso },
      );
      const newUntil = data?.validUntil ?? iso;
      setAcademies((list) =>
        list.map((a) =>
          a.slug === expiryAcademy.slug ? { ...a, validUntil: newUntil } : a,
        ),
      );
      toast.success(`${expiryAcademy.slug}: expiry updated`);
      setExpiryAcademy(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Could not update expiry");
    } finally {
      setSavingExpiry(false);
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
      <div
        className={
          googleConfigured === false
            ? "rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            : "rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
        }
      >
        {/* Boolean: is the shared Google OAuth client (id + secret) configured? */}
        {googleConfigured !== null && (
          <div className="mb-2 flex items-center gap-2 font-semibold">
            {googleConfigured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-800">
                ✓ Google OAuth client configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-amber-900">
                ✗ Google OAuth client NOT configured
              </span>
            )}
            {googleConfigured === false && (
              <span className="font-normal">
                — set{" "}
                <span className="font-mono">google_client_id</span> +{" "}
                <span className="font-mono">google_client_secret</span> in{" "}
                <a href="platform-settings" className="font-semibold underline">
                  Platform Settings
                </a>{" "}
                first.
              </span>
            )}
          </div>
        )}
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
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Storage</th>
              <th className="px-4 py-3 font-semibold">Licence</th>
              <th className="px-4 py-3 font-semibold">Valid until</th>
              <th className="px-4 py-3 font-semibold">Subscribed</th>
              <th className="px-4 py-3 font-semibold">Change licence</th>
              <th className="px-4 py-3 font-semibold">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-gray-400"
                >
                  Loading…
                </td>
              </tr>
            ) : academies.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
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
                    {/* Google redirect-URI bookkeeping — click to toggle. */}
                    <button
                      type="button"
                      onClick={() => toggleGoogleOauth(a.slug, !a.googleOauthAdded)}
                      title={
                        a.googleOauthAdded
                          ? "This academy's redirect URI is added to the Google console — click to unmark"
                          : "Redirect URI NOT added to the Google console yet — add it (🔗 Copy OAuth URL), then click to mark done"
                      }
                      className={
                        "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                        (a.googleOauthAdded
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-200")
                      }
                    >
                      {a.googleOauthAdded ? "✓ Google URL added" : "✗ Google URL missing"}
                    </button>
                    {/* Auto-renew status (only when a subscription exists). */}
                    {subs[a.slug] && (
                      <span
                        title={
                          subs[a.slug].autoRenew
                            ? "Auto-renew is on for this academy"
                            : `Auto-renew ${subs[a.slug].status === "past_due" ? "past due" : "cancelled"}`
                        }
                        className={
                          "mt-1 ms-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                          (subs[a.slug].status === "past_due"
                            ? "bg-red-100 text-red-700"
                            : subs[a.slug].autoRenew
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-500")
                        }
                      >
                        {subs[a.slug].status === "past_due"
                          ? "⚠ auto-renew past due"
                          : subs[a.slug].autoRenew
                            ? "↻ auto-renew on"
                            : "auto-renew off"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {a.owner ? (
                      <div className="min-w-[140px]">
                        <div className="text-gray-800">
                          {a.owner.name || "—"}
                        </div>
                        <div className="text-xs text-gray-400 font-mono truncate max-w-[200px]">
                          {a.owner.email}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
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
                    {(() => {
                      const b = expiryBadge(a.validUntil, a.status);
                      return (
                        <div className="min-w-[130px]">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${b.cls}`}
                          >
                            {b.text}
                          </span>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {fmtDate(a.validUntil)}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {fmtDate(a.subscribedAt ?? a.createdAt)}
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
                    <button
                      type="button"
                      onClick={(e) => {
                        if (menu?.slug === a.slug) {
                          setMenu(null);
                          return;
                        }
                        const r = e.currentTarget.getBoundingClientRect();
                        // Flip the menu up when there isn't room below (rows near
                        // the bottom of the page), so it's never clipped.
                        const estH = 360;
                        const top =
                          r.bottom + estH > window.innerHeight
                            ? Math.max(8, r.top - estH - 4)
                            : r.bottom + 4;
                        setMenu({
                          slug: a.slug,
                          top,
                          left: Math.max(8, r.right - 208),
                        });
                      }}
                      aria-haspopup="menu"
                      aria-expanded={menu?.slug === a.slug}
                      title="Actions"
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-gray-600 hover:bg-gray-50"
                    >
                      <MoreHorizontalIcon />
                    </button>
                    {menu?.slug === a.slug && (
                      <>
                        {/* Backdrop closes the menu on any outside click. */}
                        <div
                          className="fixed inset-0 z-[90]"
                          onClick={() => setMenu(null)}
                        />
                        <div
                          className="fixed z-[100] w-52 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-xl"
                          style={{
                            top: menu.top,
                            left: menu.left,
                            maxHeight: "calc(100vh - 16px)",
                          }}
                          role="menu"
                        >
                          <a
                            role="menuitem"
                            href={`https://${a.slug}.${ACADEMY_DOMAIN}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setMenu(null)}
                            className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                          >
                            ↗ Open academy
                          </a>
                          <div className="my-1 border-t border-gray-100" />
                          <button
                            type="button"
                            role="menuitem"
                            disabled={
                              busySlug === a.slug ||
                              !["live", "suspended"].includes(a.status)
                            }
                            onClick={() => {
                              setMenu(null);
                              updateImage(a.slug);
                            }}
                            className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            {busySlug === a.slug ? "⟳ Updating…" : "⟳ Update image"}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={!["live", "suspended"].includes(a.status)}
                            onClick={() => {
                              setMenu(null);
                              setBrandingSlug(a.slug);
                            }}
                            className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            🎨 Branding
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenu(null);
                              copyRedirect(a.slug);
                            }}
                            className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                          >
                            🔗 Copy OAuth URL
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenu(null);
                              toggleGoogleOauth(a.slug, !a.googleOauthAdded);
                            }}
                            className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                          >
                            {a.googleOauthAdded
                              ? "↩︎ Google URL added — unmark"
                              : "✓ Mark Google URL added"}
                          </button>
                          {subs[a.slug] && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenu(null);
                                toggleSubAutoRenew(a.slug, !subs[a.slug].autoRenew);
                              }}
                              className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                            >
                              {subs[a.slug].autoRenew
                                ? "🚫 Cancel auto-renew"
                                : "↻ Resume auto-renew"}
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            disabled={!["live", "suspended"].includes(a.status)}
                            onClick={() => {
                              setMenu(null);
                              openCreds(a.slug);
                            }}
                            className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            🔑 Login credentials
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={busySlug === a.slug}
                            onClick={() => {
                              setMenu(null);
                              toggleSuspend(a.slug, a.status);
                            }}
                            className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            {a.status === "suspended" ? "▶ Resume" : "⏸ Suspend"}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenu(null);
                              openExpiry(a);
                            }}
                            className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                          >
                            📅 Extend expiry
                          </button>
                          <div className="my-1 border-t border-gray-100" />
                          <button
                            type="button"
                            role="menuitem"
                            disabled={busySlug === a.slug}
                            onClick={() => {
                              setMenu(null);
                              removeAcademy(a.slug);
                            }}
                            className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 disabled:opacity-40"
                          >
                            🗑 Delete
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Extend-expiry modal — set a new subscription end date (extend the term). */}
      {expiryAcademy && (
        <div
          className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setExpiryAcademy(null)}
        >
          <div
            className="relative my-24 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h5 className="font-bold text-lg">
                📅 Extend expiry —{" "}
                <span className="font-mono text-sm">{expiryAcademy.slug}</span>
              </h5>
              <button
                type="button"
                onClick={() => setExpiryAcademy(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              New valid-until date
            </label>
            <input
              type="date"
              value={expiryValue}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setExpiryValue(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <p className="mt-2 text-[11px] text-gray-400">
              Sets the subscription end date. The academy is kept live and its
              in-app renewal banner + expiry reminders update to the new date.
            </p>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={saveExpiry}
                disabled={savingExpiry || !expiryValue}
                className="flex-1 bg-gradient-to-r from-[#268F79] to-[#0B2923] text-[#00FFB2] font-bold px-4 py-2 rounded-md disabled:opacity-60"
              >
                {savingExpiry ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setExpiryAcademy(null)}
                className="border border-gray-300 px-4 py-2 rounded-md text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

                {/* NIT super-admin (support) — the site-admin account, for
                    debugging a broken academy. Not the customer's login. */}
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-700">
                      🛠️ NIT super-admin (support)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={cred?.admin?.username ?? "admin"}
                      className="w-28 border rounded-lg px-3 py-2 font-mono text-sm bg-white"
                    />
                    {cred?.admin?.hasPassword && cred.admin.password ? (
                      <>
                        <input
                          readOnly
                          value={cred.admin.password}
                          className="flex-1 border rounded-lg px-3 py-2 font-mono text-sm bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => copyText(cred.admin!.password!)}
                          className="border rounded-lg px-3 text-sm hover:bg-white"
                        >
                          Copy
                        </button>
                      </>
                    ) : (
                      <p className="flex-1 text-xs text-gray-500 rounded-lg bg-white border px-3 py-2">
                        Not stored (academy provisioned before this feature).
                        Reset via CLI on the server if needed.
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-700/80">
                    Full site-admin access — for debugging only. Don’t share
                    with the customer.
                  </p>
                </div>

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
