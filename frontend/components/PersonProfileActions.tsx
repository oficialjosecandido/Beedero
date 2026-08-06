"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FaRegPaperPlane } from "react-icons/fa";

import { startConversationAction } from "@/app/(app)/feed/actions";

type PersonProfileActionsProps = {
  userId: number;
  name: string;
};

export function PersonProfileActions({ userId, name }: PersonProfileActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleMessage() {
    startTransition(async () => {
      const result = await startConversationAction(userId);
      if ("error" in result) return;
      router.push(`/feed?chat=${result.conversation.id}`);
    });
  }

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
