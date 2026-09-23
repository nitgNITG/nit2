"use client";

import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import AcademyCard, { ClientAcademy } from "./AcademyCard";
import StoreCard, { ClientStore } from "./StoreCard";
import LocaleLink from "../components/LocaleLink";
import { FiPlus, FiCreditCard, FiShoppingBag } from "react-icons/fi";
import { FaRocket } from "react-icons/fa";

type DashUser = { name: string | null; email: string; role: string };

// One list for every product the user owns (academies and stores), newest first,
// each card labelled with its kind. Both card types share the same look; the
// store card shows the provisioner's live steps while it is being prepared.
export default function Dashboard({
  user,
  academies,
  stores: initialStores = [],
  domain,
}: Readonly<{
  user: DashUser;
  academies: ClientAcademy[];
  stores?: ClientStore[];
  domain: string;
}>) {
  const t = useTranslations("Dashboard");
  const tn = useTranslations("Navbar");
  const [stores, setStores] = useState(initialStores);
  const items = useMemo(() => {
    const all: {
      kind: "academy" | "store";
      createdAt: string;
      key: string;
      node: React.ReactNode;
    }[] = [
      ...academies.map((a) => ({
        kind: "academy" as const,
        createdAt: a.createdAt,
        key: `a-${a.id}`,
        node: <AcademyCard academy={a} domain={domain} />,
      })),
      ...stores.map((s) => ({
        kind: "store" as const,
        createdAt: s.createdAt,
        key: `s-${s.id}`,
        node: (
          <StoreCard
            store={s}
            onDeleted={(slug) =>
              setStores((cur) => cur.filter((x) => x.slug !== slug))
            }
          />
        ),
      })),
    ];
    return all.sort((x, y) =>
      (y.createdAt || "").localeCompare(x.createdAt || ""),
    );
  }, [academies, stores, domain]);
  const empty = items.length === 0;

  return (
    <div className="bg-[#0B2923] text-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10">
        {/* Title + quick link to the profile page. */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#00FFB2]/70">
              {t("greeting", { name: user.name || user.email })}
            </span>
            <h1 className="mt-1 text-2xl font-extrabold">{t("title")}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LocaleLink
              href="/account/payments"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white/90 hover:bg-white/10 transition-colors"
            >
              <FiCreditCard className="text-base" /> {tn("payments")}
            </LocaleLink>
            <LocaleLink
              href="/account/profile"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white/90 hover:bg-white/10 transition-colors"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00FFB2] text-xs font-extrabold text-[#0B2923]">
                {(user.name || user.email || "?")
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </span>
              {tn("profile")}
            </LocaleLink>
          </div>
        </header>

        {/* Action bar */}
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-white/50">
            {items.length ? t("count", { n: items.length }) : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <LocaleLink
              href="/build-product?product=store"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#00FFB2]/40 px-5 py-2.5 text-sm font-extrabold text-[#00FFB2] hover:bg-[#00FFB2]/10 transition-colors"
            >
              <FiShoppingBag className="text-base" /> {t("newStore")}
            </LocaleLink>
            <LocaleLink
              href="/build-product"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#00FFB2] px-5 py-2.5 text-sm font-extrabold text-[#0B2923] hover:scale-[1.03] transition-transform"
            >
              <FiPlus className="text-base" /> {t("newAcademy")}
            </LocaleLink>
          </div>
        </div>

        {/* Console */}
        {empty ? (
          <div className="mt-10 rounded-3xl border border-dashed border-white/15 p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#00FFB2]/10 text-2xl text-[#00FFB2]">
              <FaRocket />
            </div>
            <h2 className="mt-4 text-xl font-extrabold">{t("emptyTitle")}</h2>
            <p className="mt-2 text-white/60 max-w-sm mx-auto">
              {t("emptyBody")}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <LocaleLink
                href="/build-product"
                className="inline-block rounded-full bg-[#00FFB2] px-6 py-3 font-extrabold text-[#0B2923] hover:scale-[1.03] transition-transform"
              >
                {t("emptyCta")}
              </LocaleLink>
              <LocaleLink
                href="/build-product?product=store"
                className="inline-block rounded-full border border-[#00FFB2]/40 px-6 py-3 font-extrabold text-[#00FFB2] hover:bg-[#00FFB2]/10 transition-colors"
              >
                {t("emptyCtaStore")}
              </LocaleLink>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <React.Fragment key={it.key}>{it.node}</React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
