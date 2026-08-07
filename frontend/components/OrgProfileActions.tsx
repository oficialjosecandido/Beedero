"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { sendOrgConnectionRequestAction } from "@/app/(app)/connections/actions";
import { followOrgAction } from "@/app/(app)/dashboard/actions";

type OrgConnectionStatus = "none" | "pending_sent" | "connected";

export function OrgProfileActions({
  slug,
  isFollowing,
  isMember,
  canConnect = false,
  canMessage = false,
  connectionStatus = "none",
}: {
  slug: string;
  isFollowing: boolean;
  isMember: boolean;
  /** True only for an authenticated, non-member viewer — anonymous visitors
   * have no session to send a connection request from. */
  canConnect?: boolean;
  canMessage?: boolean;
  connectionStatus?: OrgConnectionStatus;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(isFollowing);
  const [isPending, startTransition] = useTransition();
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function follow() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("slug", slug);
      await followOrgAction(formData);
      setFollowing(true);
      router.refresh();
    });
  }

  function sendRequest() {
    startTransition(async () => {
      const result = await sendOrgConnectionRequestAction(slug, note);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSent(true);
      setShowNote(false);
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
      <div className="flex flex-wrap items-center gap-3">
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

        {!isMember && !canMessage && canConnect && (
          <>
            {sent || connectionStatus === "pending_sent" ? (
              <span className="rounded-full border border-beedero-border px-4 py-2 text-sm font-semibold text-zinc-500">
                Request sent
              </span>
            ) : showNote ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 300))}
                  placeholder="Say hello…"
                  rows={2}
                  className="w-64 rounded-xl border border-beedero-border p-2 text-sm text-beedero-black focus:border-beedero-black focus:outline-none"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={sendRequest}
                    disabled={isPending}
                    className="rounded-full bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
                  >
                    {isPending ? "Sending…" : "Send request"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNote(false)}
                    className="text-sm font-semibold text-zinc-500 hover:text-beedero-black"
                  >
                    Cancel
                  </button>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="rounded-full bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
              >
                Ask to connect
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
