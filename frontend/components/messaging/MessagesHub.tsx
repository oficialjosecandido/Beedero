"use client";

import { Suspense, useState } from "react";

import type { ConversationSummary } from "@/app/(app)/feed/types";
import { useMessaging, type InboxContext } from "@/lib/messaging-context";

import { ChatWindow } from "./messaging-shared";
import { MessagingInboxWithContext } from "./MessagingInbox";

function inboxContextKey(context: InboxContext) {
  return context.type === "org" ? `org:${context.slug}` : "personal";
}

function MessagesHubContent() {
  const { inboxContext } = useMessaging();
  const [selected, setSelected] = useState<ConversationSummary | null>(null);

  const participant = selected
    ? {
        id: selected.other_participant.id,
        name: selected.other_participant.name,
        profile_picture: selected.other_participant.profile_picture,
      }
    : null;

  return (
    <div className="flex min-h-[min(720px,calc(100vh-8rem))] overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      <div
        className={`flex w-full shrink-0 flex-col border-beedero-border lg:w-[min(360px,40%)] lg:border-r ${
          selected ? "hidden lg:flex" : "flex"
        }`}
      >
        <MessagingInboxWithContext
          variant="hub"
          selectedConversationId={selected?.id ?? null}
          onSelectConversation={setSelected}
        />
      </div>

      <div className={`min-w-0 flex-1 ${selected ? "flex flex-col" : "hidden lg:flex lg:flex-col"}`}>
        {selected && participant ? (
          <ChatWindow
            key={`${inboxContext.type === "org" ? inboxContext.slug : "personal"}:${selected.id}`}
            conversationId={selected.id}
            participant={participant}
            inboxContext={inboxContext}
            minimized={false}
            embedded
            onMinimize={() => {}}
            onClose={() => setSelected(null)}
            onBack={() => setSelected(null)}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-lg font-semibold text-beedero-black">Select a conversation</p>
            <p className="max-w-sm text-sm text-zinc-500">
              Choose someone from your inbox to read and reply to messages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function MessagesHub() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading messages…</p>}>
      <MessagesHubKeyed />
    </Suspense>
  );
}

function MessagesHubKeyed() {
  const { inboxContext } = useMessaging();
  return <MessagesHubContent key={inboxContextKey(inboxContext)} />;
}
