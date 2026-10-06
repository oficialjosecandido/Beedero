"use client";

import { useState, type ComponentProps } from "react";

import {
  OrgCredibilityLadder,
  OrgHero,
  OrgNarrative,
  OrgSignalLog,
  type LadderRung,
  type NarrativeContent,
  type SignalItem,
} from "@/components/org-workspace/OrgOverview";
import { OrgWorkspaceNav } from "@/components/org-workspace/OrgWorkspaceNav";
import type { OrgNavCounts, OrgTabId } from "@/components/org-workspace/tabs";

import { OrgTabs } from "./OrgTabs";

type TabsProps = Omit<ComponentProps<typeof OrgTabs>, "active">;
type IdentityProps = Omit<ComponentProps<typeof OrgWorkspaceNav>, "active" | "onSelect" | "counts">;

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
  signals,
  counts,
  tabs,
}: {
  initialTab: OrgTabId;
  identity: IdentityProps;
  hero: ComponentProps<typeof OrgHero>;
  narrative: NarrativeContent;
  ladder: LadderRung[];
  signals: SignalItem[];
  counts: OrgNavCounts;
  tabs: TabsProps;
}) {
  const [active, setActive] = useState<OrgTabId>(initialTab);

  function selectTab(tab: OrgTabId) {
    setActive(tab);
    window.history.replaceState(null, "", `/dashboard/${tabs.slug}?tab=${tab}`);
  }

  return (
    <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[252px_minmax(0,1fr)]">
      <OrgWorkspaceNav {...identity} counts={counts} active={active} onSelect={selectTab} />

      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <OrgHero {...hero} />

        {active === "overview" && (
          <>
            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
              <OrgNarrative
                name={hero.name}
                content={narrative}
                canManage={tabs.canManage}
                onSelect={selectTab}
              />
              {ladder.length > 0 && (
                <OrgCredibilityLadder name={hero.name} rungs={ladder} onSelect={selectTab} />
              )}
            </div>
            <OrgSignalLog signals={signals} onSelect={selectTab} />
          </>
        )}

        <div className="mt-6 min-w-0">
          <OrgTabs {...tabs} active={active} />
        </div>
      </section>
    </div>
  );
}
