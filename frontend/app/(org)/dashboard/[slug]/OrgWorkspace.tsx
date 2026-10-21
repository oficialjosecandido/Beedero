"use client";

import { useLayoutEffect, useState, useSyncExternalStore, type ComponentProps } from "react";

import {
  OrgCredibilityLadder,
  OrgHero,
  OrgNarrative,
  OrgPublishGate,
  OrgSignalLog,
  type LadderRung,
  type NarrativeContent,
  type PublishChecklistItem,
  type SignalItem,
} from "@/components/org-workspace/OrgOverview";
import { OrgWorkspaceNav } from "@/components/org-workspace/OrgWorkspaceNav";
import type { OrgNavCounts, OrgTabId } from "@/components/org-workspace/tabs";

import { OrgTabs } from "./OrgTabs";

type TabsProps = Omit<ComponentProps<typeof OrgTabs>, "active">;
type IdentityProps = Omit<ComponentProps<typeof OrgWorkspaceNav>, "active" | "onSelect" | "counts">;

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readPublishHash() {
  return window.location.hash === "#publish-checklist";
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
  signals,
  counts,
  tabs,
}: {
  initialTab: OrgTabId;
  identity: IdentityProps;
  hero: Omit<ComponentProps<typeof OrgHero>, "onOpenPublishChecklist">;
  narrative: NarrativeContent;
  ladder: LadderRung[];
  signals: SignalItem[];
  counts: OrgNavCounts;
  tabs: TabsProps;
}) {
  const [active, setActive] = useState<OrgTabId>(initialTab);
  // `#publish-checklist` is the draft gate on overview — honour it even when
  // `?tab=` still points at profile from an earlier click.
  const hashWantsPublish = useSyncExternalStore(subscribeHash, readPublishHash, () => false);
  const effectiveActive =
    hashWantsPublish && hero.isDraft ? ("overview" as const) : active;

  function selectTab(tab: OrgTabId) {
    setActive(tab);
    window.history.replaceState(null, "", `/dashboard/${tabs.slug}?tab=${tab}`);
  }

  function openPublishChecklist() {
    setActive("overview");
    window.history.replaceState(
      null,
      "",
      `/dashboard/${tabs.slug}?tab=overview#publish-checklist`
    );
    // replaceState does not fire hashchange — nudge subscribers manually.
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  useLayoutEffect(() => {
    if (!hashWantsPublish || !hero.isDraft || effectiveActive !== "overview") return;
    document.getElementById("publish-checklist")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [hashWantsPublish, hero.isDraft, effectiveActive]);

  const showPublishGate = hero.isDraft && effectiveActive === "overview";
  const publishChecklist: PublishChecklistItem[] = tabs.onboarding.checklist;

  return (
    <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[252px_minmax(0,1fr)]">
      <OrgWorkspaceNav {...identity} counts={counts} active={effectiveActive} onSelect={selectTab} />

      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <OrgHero {...hero} onOpenPublishChecklist={openPublishChecklist} />

        {showPublishGate && (
          <OrgPublishGate
            slug={tabs.slug}
            orgName={hero.name}
            publishReady={tabs.onboarding.publish_ready}
            checklist={publishChecklist}
            canManage={tabs.canManage}
            onSelect={selectTab}
          />
        )}

        {effectiveActive === "overview" && (
          <>
            <div
              className={`mt-5 grid gap-5 ${
                !hero.isDraft && ladder.length > 0
                  ? "xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]"
                  : ""
              }`}
            >
              <OrgNarrative
                name={hero.name}
                content={narrative}
                canManage={tabs.canManage}
                onSelect={selectTab}
              />
              {/* Credibility ladder is post-publish proof — while draft, the publish gate owns the checklist. */}
              {!hero.isDraft && ladder.length > 0 && (
                <OrgCredibilityLadder name={hero.name} rungs={ladder} onSelect={selectTab} />
              )}
            </div>
            <OrgSignalLog signals={signals} onSelect={selectTab} />
          </>
        )}

        <div className="mt-6 min-w-0">
          <OrgTabs {...tabs} active={effectiveActive} />
        </div>
      </section>
    </div>
  );
}
