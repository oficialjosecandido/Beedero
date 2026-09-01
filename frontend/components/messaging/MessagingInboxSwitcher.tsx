"use client";

import { useEffect, useState } from "react";

import type { InboxContext, OrgMembership } from "@/lib/messaging-context";
import { useMessaging } from "@/lib/messaging-context";
import { fetchProfileSwitcher } from "@/lib/profile-switcher-client";

function ContextAvatar({
  name,
  image,
  selected,
  onClick,
  label,
}: {
  name: string;
  image?: string | null;
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={`rounded-full p-0.5 transition ${
        selected ? "ring-2 ring-beedero-black ring-offset-1" : "opacity-70 hover:opacity-100"
      }`}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img loading="lazy" src={image} alt="" className="size-10 rounded-full object-cover" />
      ) : (
        <span className="flex size-10 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </button>
  );
}

export function MessagingInboxSwitcher() {
  const { inboxContext, setInboxContext } = useMessaging();
  const [personalName, setPersonalName] = useState("You");
  const [personalImage, setPersonalImage] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const data = await fetchProfileSwitcher();
      if (!data || cancelled) return;
      const profile = data.me.investor_profile;
      setPersonalName(profile?.full_name || data.me.email);
      setPersonalImage(profile?.profile_picture ?? null);
      setOrgs(data.orgs);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function isSelected(context: InboxContext) {
    if (context.type === "personal" && inboxContext.type === "personal") return true;
    if (context.type === "org" && inboxContext.type === "org" && context.slug === inboxContext.slug) {
      return true;
    }
    return false;
  }

  if (orgs.length === 0) {
    return (
      <ContextAvatar
        name={personalName}
        image={personalImage}
        selected
        onClick={() => setInboxContext({ type: "personal" })}
        label="Personal messages"
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <ContextAvatar
        name={personalName}
        image={personalImage}
        selected={isSelected({ type: "personal" })}
        onClick={() => setInboxContext({ type: "personal" })}
        label="Personal messages"
      />
      {orgs.map((org) => (
        <ContextAvatar
          key={org.slug}
          name={org.name}
          image={org.logo}
          selected={isSelected({
            type: "org",
            slug: org.slug,
            name: org.name,
            logo: org.logo,
          })}
          onClick={() =>
            setInboxContext({
              type: "org",
              slug: org.slug,
              name: org.name,
              logo: org.logo,
            })
          }
          label={`${org.name} messages`}
        />
      ))}
    </div>
  );
}
