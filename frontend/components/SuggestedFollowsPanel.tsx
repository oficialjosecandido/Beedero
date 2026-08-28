"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { followOrgAction } from "@/app/(app)/dashboard/actions";
import { EmptyState } from "@/components/EmptyState";
import { formatAtHandle } from "@/lib/handles";

type SuggestedOrg = {
  slug: string;
  name: string;
  one_liner?: string;
  logo?: string | null;
  is_verified?: boolean;
};

export function SuggestedFollowsPanel({ organizations }: { organizations: SuggestedOrg[] }) {
  const router = useRouter();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (organizations.length === 0) return null;

  function follow(slug: string) {
    setPendingSlug(slug);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("slug", slug);
      await followOrgAction(formData);
      setPendingSlug(null);
      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      <h2 className="text-sm font-extrabold text-beedero-black">Suggested to follow</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Follow a few organizations so your feed has content from day one.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {organizations.slice(0, 5).map((org) => (
          <li
            key={org.slug}
            className="flex items-center gap-3 rounded-2xl border border-beedero-border px-3 py-2.5"
          >
            {org.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" src={org.logo} alt="" className="size-10 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500">
                {org.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <Link href={`/org/${org.slug}`} className="block truncate text-sm font-semibold text-zinc-900 hover:underline">
                {org.name}
              </Link>
              <p className="truncate text-xs text-zinc-500">
                {formatAtHandle(org.slug)}
                {org.one_liner ? ` · ${org.one_liner}` : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={isPending && pendingSlug === org.slug}
              onClick={() => follow(org.slug)}
              className="shrink-0 rounded-full border border-beedero-black px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-yellow disabled:opacity-50"
            >
              Follow
            </button>
          </li>
        ))}
      </ul>
      <Link href="/discovery" className="mt-4 inline-block text-sm font-semibold text-beedero-black hover:underline">
        Browse Discover →
      </Link>
    </section>
  );
}

export function SuggestedFollowsEmpty({ followCount }: { followCount: number }) {
  if (followCount >= 3) return null;
  return (
    <EmptyState
      title="Your feed works best with a few follows"
      description="Follow at least three organizations or people on Discover to see updates here."
      action={{ href: "/discovery", label: "Go to Discover" }}
    />
  );
}
