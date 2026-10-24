"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FaRegPaperPlane } from "react-icons/fa";

import { sendConnectionRequestAction } from "@/app/(app)/connections/actions";
import { startConversationAction } from "@/app/(app)/feed/actions";
import { LOCKED_BODY, LOCKED_TITLE } from "@/lib/connection-gate";

export type ConnectionStatus = "none" | "pending_sent" | "pending_received" | "connected";

type PersonProfileActionsProps = {
  userId: number;
  name: string;
  canMessage: boolean;
  connectionStatus: ConnectionStatus;
  /** False while the viewer is below the ladder's gate (rungs 1–4). */
  canRequest?: boolean;
};

export function PersonProfileActions({
  userId,
  name,
  canMessage,
  connectionStatus,
  canRequest = true,
}: PersonProfileActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  function handleMessage() {
    startTransition(async () => {
      const result = await startConversationAction(userId);
      if ("error" in result) return;
      router.push(`/feed?chat=${result.conversation.id}`);
    });
  }

  function handleSendRequest() {
    startTransition(async () => {
      const result = await sendConnectionRequestAction(userId, note);
      if ("error" in result) {
        if (result.locked) {
          setLocked(true);
          setShowNote(false);
          return;
        }
        setError(result.error);
        return;
      }
      setSent(true);
      setShowNote(false);
    });
  }

  if (canMessage) {
    return (
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleMessage}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
        >
          <FaRegPaperPlane className="text-sm" aria-hidden />
          {isPending ? "Opening…" : `Message ${name.split(" ")[0]}`}
        </button>
      </div>
    );
  }

  if (sent || connectionStatus === "pending_sent") {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-beedero-border px-5 py-2.5 text-sm font-semibold text-zinc-500">
          Request sent
        </span>
      </div>
    );
  }

  if (connectionStatus === "pending_received") {
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/network"
          className="inline-flex items-center gap-2 rounded-full bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
        >
          Respond to their request
        </Link>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="mt-6 rounded-2xl border-2 border-beedero-yellow bg-beedero-yellow/10 p-4" role="status">
        <p className="text-sm font-bold text-beedero-black">{LOCKED_TITLE}</p>
        <p className="mt-1 text-sm leading-6 text-zinc-600">{LOCKED_BODY}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 rounded-full bg-beedero-black px-5 py-2.5 text-sm font-bold text-beedero-yellow hover:bg-beedero-yellow hover:text-beedero-black"
          >
            Finish my profile
          </Link>
          <button
            type="button"
            onClick={() => setLocked(false)}
            className="text-sm font-semibold text-zinc-500 hover:text-beedero-black"
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {showNote ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder={`Say hello to ${name.split(" ")[0]}…`}
            rows={3}
            className="w-full rounded-xl border border-beedero-border p-3 text-sm text-beedero-black focus:border-beedero-black focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSendRequest}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
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
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => (canRequest ? setShowNote(true) : setLocked(true))}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
          >
            <FaRegPaperPlane className="text-sm" aria-hidden />
            Ask to connect
          </button>
        </div>
      )}
    </div>
  );
}
