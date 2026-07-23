"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { followOrgAction } from "@/app/(app)/dashboard/actions";

export function OrgProfileActions({
  slug,
  isFollowing,
  isMember,
}: {
  slug: string;
  isFollowing: boolean;
  isMember: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(isFollowing);
  const [isPending, startTransition] = useTransition();

  function follow() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("slug", slug);
      await followOrgAction(formData);
      setFollowing(true);
      router.refresh();
    });
  }

  const showFollow = !isMember && !following;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-beedero-black"
      >
        <span aria-hidden="true">←</span>
        Back
      </button>
      {showFollow ? (
        <button
          type="button"
          disabled={isPending}
          onClick={follow}
          className="rounded-full border-2 border-beedero-black bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-yellow disabled:opacity-50"
        >
          {isPending ? "Following…" : "Follow"}
        </button>
      ) : !isMember && following ? (
        <span className="rounded-full border border-beedero-border px-4 py-2 text-sm font-semibold text-zinc-600">
          Following
        </span>
      ) : isMember ? (
        <Link
          href={`/dashboard/${slug}`}
          className="rounded-full border-2 border-beedero-black px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-yellow"
        >
          Manage
        </Link>
      ) : null}
    </div>
  );
}
