"use client";

import { useMessaging } from "@/lib/messaging-context";

export function MessageBell() {
  const { toggleInboxFromHeader } = useMessaging();

  return (
    <button
      type="button"
      onClick={toggleInboxFromHeader}
      className="relative rounded-full p-2.5 text-beedero-black/65 hover:bg-beedero-yellow hover:text-beedero-black lg:hidden"
      aria-label="Mensagens"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden="true"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
