"use client";

import { Suspense, useEffect, useState } from "react";

import { useMessaging } from "@/lib/messaging-context";

import { ChatWindow, loadMe, MessagingChatStack, ParticipantAvatar } from "./messaging-shared";
import { MessagingInboxWithContext } from "./MessagingInbox";

function MobileInboxTrigger({
  unreadTotal,
  onExpand,
}: {
  unreadTotal: number;
  onExpand: () => void;
}) {
  const [me, setMe] = useState<{ name: string; profile_picture?: string | null } | null>(null);

  useEffect(() => {
    void loadMe().then(setMe);
  }, []);

  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex h-12 w-[min(280px,calc(100vw-2rem))] items-center justify-between rounded-t-lg border border-b-0 border-zinc-300 bg-beedero-white px-4 shadow-lg hover:bg-zinc-50"
    >
      <div className="flex items-center gap-2">
        {me ? (
          <ParticipantAvatar name={me.name} profilePicture={me.profile_picture} size="sm" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="size-5 text-beedero-black"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        <span className="text-sm font-semibold text-beedero-black">Messages</span>
        {unreadTotal > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-beedero-black text-[10px] font-bold text-beedero-yellow">
            {unreadTotal > 9 ? "9+" : unreadTotal}
          </span>
        )}
      </div>
      <svg viewBox="0 0 24 24" className="size-4 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  );
}

function MobileMessagingDock() {
  const {
    inboxState,
    isDesktop,
    openChats,
    unreadTotal,
    minimizeInbox,
    expandInbox,
    closeChatWindow,
    minimizeChatWindow,
  } = useMessaging();

  const inboxExpanded = !isDesktop && inboxState === "expanded";

  const activeMobileChat =
    !isDesktop && inboxState === "minimized"
      ? [...openChats].reverse().find((chat) => !chat.minimized) ?? null
      : null;

  return (
    <>
      <div className="pointer-events-none fixed bottom-0 right-0 z-50 flex flex-row-reverse items-end gap-2 p-2 sm:right-4 lg:hidden">
        <div className={`pointer-events-auto ${activeMobileChat ? "hidden" : ""}`}>
          {inboxExpanded ? (
            <MessagingInboxWithContext variant="dock" expanded onMinimize={minimizeInbox} />
          ) : (
            <MobileInboxTrigger unreadTotal={unreadTotal} onExpand={expandInbox} />
          )}
        </div>
      </div>

      {activeMobileChat && (
        <div className="pointer-events-auto fixed inset-x-2 bottom-0 z-[60] lg:hidden">
          <ChatWindow
            conversationId={activeMobileChat.conversationId}
            participant={activeMobileChat.participant}
            inboxContext={activeMobileChat.inboxContext}
            minimized={false}
            onMinimize={() => {
              minimizeChatWindow(activeMobileChat.conversationId, activeMobileChat.inboxContext);
              expandInbox();
            }}
            onClose={() => closeChatWindow(activeMobileChat.conversationId, activeMobileChat.inboxContext)}
          />
        </div>
      )}
    </>
  );
}

export function MessagingDock() {
  return (
    <>
      <Suspense fallback={null}>
        <MobileMessagingDock />
      </Suspense>
      <MessagingChatStack />
    </>
  );
}
