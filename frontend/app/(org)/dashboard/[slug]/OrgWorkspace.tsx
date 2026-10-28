"use client";

import { useLayoutEffect, useState, useSyncExternalStore, type ComponentProps } from "react";

import {
  OrgHero,
  OrgNarrative,
  OrgSignalLog,
  OrgVerificationLadder,
  type NarrativeContent,
  type SignalItem,
} from "@/components/org-workspace/OrgOverview";
import { OrgPlanNotice, type BillingNotice } from "@/components/org-workspace/OrgBilling";
import { OrgWorkspaceNav } from "@/components/org-workspace/OrgWorkspaceNav";
import type { OrgNavCounts, OrgTabId } from "@/components/org-workspace/tabs";
import type { OrgBilling } from "@/lib/billing";
import type { OrgLadder } from "@/lib/org-ladder";

import { OrgTabs } from "./OrgTabs";

type TabsProps = Omit<ComponentProps<typeof OrgTabs>, "active">;
type IdentityProps = Omit<ComponentProps<typeof OrgWorkspaceNav>, "active" | "onSelect" | "counts">;

const LADDER_HASH = "#verification-ladder";

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readLadderHash() {
  return window.location.hash === LADDER_HASH;
}

/**
 * The organisation workspace shell: it owns the active section so the sidebar
 * and the panels stay in step without a round-trip to the server on every
 * click. The URL is kept current with `replaceState`, which is what makes a
 * refresh (or a shared link) land back on the same section via `?tab=`.
 */
export function OrgWorkspace({
  initialTab,
  identity,
  hero,
  narrative,
  ladder,
  billing,
  billingNotice,
  signals,
  counts,
  tabs,
}: {
  initialTab: OrgTabId;
  identity: IdentityProps;
  hero: Omit<ComponentProps<typeof OrgHero>, "onOpenLadder">;
  narrative: NarrativeContent;
  ladder: OrgLadder | null;
  billing: OrgBilling | null;
  billingNotice: BillingNotice;
  signals: SignalItem[];
  counts: OrgNavCounts;
  tabs: TabsProps;
}) {
  const [active, setActive] = useState<OrgTabId>(initialTab);
  // The ladder lives on overview — honour the hash even when `?tab=` still
  // points at profile from an earlier click.
  const hashWantsLadder = useSyncExternalStore(subscribeHash, readLadderHash, () => false);
  const effectiveActive = hashWantsLadder ? ("overview" as const) : active;

  function selectTab(tab: OrgTabId) {
    setActive(tab);
    window.history.replaceState(null, "", `/dashboard/${tabs.slug}?tab=${tab}`);
  }

  function openLadder() {
    setActive("overview");
    window.history.replaceState(null, "", `/dashboard/${tabs.slug}?tab=overview${LADDER_HASH}`);
    // replaceState does not fire hashchange — nudge subscribers manually.
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  useLayoutEffect(() => {
    if (!hashWantsLadder || effectiveActive !== "overview") return;
    document.getElementById("verification-ladder")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [hashWantsLadder, effectiveActive]);

  // Billing actions stay available to owners; everything else is read-only
  // until the organisation has a plan (billing.has_access).
  const canEdit = tabs.canManage && (billing?.has_access ?? true);

  return (
    <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[252px_minmax(0,1fr)]">
      <OrgWorkspaceNav {...identity} counts={counts} active={effectiveActive} onSelect={selectTab} />

      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <OrgPlanNotice
          name={hero.name}
          slug={tabs.slug}
          billing={billing}
          notice={billingNotice}
          canManage={tabs.canManage}
          onSelect={selectTab}
        />
        <OrgHero {...hero} onOpenLadder={openLadder} />

        {effectiveActive === "overview" && (
          // Narrative and signal log share the left column, so the taller
          // ladder on the right never leaves a stretched, empty card beside it.
          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
            <div className="flex min-w-0 flex-col gap-5">
              <OrgNarrative
                name={hero.name}
                content={narrative}
                canManage={canEdit}
                onSelect={selectTab}
              />
              <OrgSignalLog signals={signals} onSelect={selectTab} />
            </div>
            {ladder && (
              <OrgVerificationLadder
                name={hero.name}
                slug={tabs.slug}
                ladder={ladder}
                canManage={canEdit}
                onSelect={selectTab}
              />
            )}
          </div>
        )}

        <div className="mt-6 min-w-0">
          <OrgTabs {...tabs} active={effectiveActive} />
        </div>
      </section>
    </div>
  );
}
