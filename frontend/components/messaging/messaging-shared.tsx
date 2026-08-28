"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { sendMessageAction, sendOrgMessageAction } from "@/app/(app)/feed/actions";
import type { MessageItem } from "@/app/(app)/feed/types";
import type { InboxContext } from "@/lib/messaging-context";
import { chatKey, useMessaging, type PersonSummary } from "@/lib/messaging-context";

type MeProfile = {
  full_name?: string;
  profile_picture?: string | null;
};

export async function loadMessages(
  conversationId: number,
  inboxContext: InboxContext
): Promise<MessageItem[] | null> {
  try {
    const url =
      inboxContext.type === "org"
        ? `/api/orgs/${inboxContext.slug}/messaging/conversations/${conversationId}/messages`
        : `/api/messaging/conversations/${conversationId}/messages`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { items: MessageItem[] };
    return [...data.items].reverse();
  } catch {
    return null;
  }
}

export async function loadMe(): Promise<{ name: string; profile_picture?: string | null } | null> {
  try {
    const res = await fetch("/api/profile-switcher", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { me: { email: string; investor_profile: MeProfile | null } };
    const profile = data.me.investor_profile;
    return {
      name: profile?.full_name || data.me.email,
      profile_picture: profile?.profile_picture,
    };
  } catch {
    return null;
  }
}

export function ParticipantAvatar({
  name,
  profilePicture,
  size = "md",
}: {
  name: string;
  profilePicture?: string | null;
  size?: "sm" | "md";
}) {
  const classes = size === "sm" ? "size-10 text-xs" : "size-12 text-sm";
  if (profilePicture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img loading="lazy" src={profilePicture} alt="" className={`${classes} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span
      className={`flex ${classes} shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function ChatWindow({
  conversationId,
  participant,
  inboxContext,
  minimized,
  onMinimize,
  onClose,
  embedded = false,
  onBack,
}: {
  conversationId: number;
  participant: PersonSummary;
  inboxContext: InboxContext;
  minimized: boolean;
  onMinimize: () => void;
  onClose: () => void;
  embedded?: boolean;
  onBack?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (minimized) return;
    let cancelled = false;

    async function refresh() {
      const requestId = ++requestIdRef.current;
      const items = await loadMessages(conversationId, inboxContext);
      if (!cancelled && items && requestId === requestIdRef.current) setMessages(items);
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [conversationId, inboxContext, minimized]);

  function sendMessage() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setError(null);
    startTransition(async () => {
      const result =
        inboxContext.type === "org"
          ? await sendOrgMessageAction(inboxContext.slug, conversationId, body)
          : await sendMessageAction(conversationId, body);
      if ("error" in result) {
        setError(result.error);
        setDraft(body);
        return;
      }
      requestIdRef.current += 1;
      setMessages((prev) => [...prev, result.message]);
    });
  }

  if (minimized && !embedded) {
    return (
      <button
        type="button"
        onClick={onMinimize}
        className="flex h-12 w-[220px] items-center gap-2 rounded-t-lg border border-b-0 border-zinc-300 bg-beedero-white px-3 shadow-lg hover:bg-zinc-50"
      >
        <ParticipantAvatar name={participant.name} profilePicture={participant.profile_picture} size="sm" />
        <span className="truncate text-sm font-semibold text-beedero-black">{participant.name}</span>
      </button>
    );
  }

  return (
    <div
      className={
        embedded
          ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-beedero-white"
          : "flex h-[min(420px,60vh)] w-full flex-col overflow-hidden rounded-t-lg border border-b-0 border-zinc-300 bg-beedero-white shadow-xl lg:w-[min(328px,calc(100vw-2rem))]"
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {embedded && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-beedero-black lg:hidden"
              aria-label="Back to conversations"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <ParticipantAvatar name={participant.name} profilePicture={participant.profile_picture} size="sm" />
          <p className="truncate text-sm font-semibold text-beedero-black">{participant.name}</p>
        </div>
        <div className="flex items-center gap-0.5">
          {!embedded && (
            <>
              <button
                type="button"
                onClick={onMinimize}
                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-beedero-black"
                aria-label="Minimize conversation"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-beedero-black"
                aria-label="Close conversation"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                message.is_mine
                  ? "self-end bg-beedero-yellow text-beedero-black"
                  : "self-start bg-zinc-100 text-beedero-black"
              }`}
            >
              {message.body}
            </div>
          ))}
        </div>
      </div>
      {error && <p className="px-3 text-xs text-danger">{error}</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
        className="flex items-center gap-2 border-t border-zinc-200 p-3"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message…"
          className="flex-1 rounded-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-beedero-black"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={!draft.trim() || isPending}
          className="rounded-full bg-beedero-yellow px-3 py-2 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
        >
          {isPending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

/** Aligns floating chat windows with the left edge of the messages column (max-w-7xl grid). */
export const MESSAGES_CHAT_STACK_CLASS =
  "fixed bottom-0 z-50 hidden flex-row-reverse items-end gap-2 p-2 lg:flex right-[max(1rem,calc((100vw-min(100vw,80rem))/2+320px))]";

export function MessagingChatStack() {
  const pathname = usePathname();
  const { openChats, closeChatWindow, minimizeChatWindow, restoreChatWindow } = useMessaging();

  if (pathname.startsWith("/messages") || openChats.length === 0) return null;

  return (
    <div className={`pointer-events-none messages-chat-stack ${MESSAGES_CHAT_STACK_CLASS}`}>
      {openChats.map((chat) => (
        <div key={chatKey(chat.conversationId, chat.inboxContext)} className="pointer-events-auto">
          <ChatWindow
            conversationId={chat.conversationId}
            participant={chat.participant}
            inboxContext={chat.inboxContext}
            minimized={chat.minimized}
            onMinimize={() =>
              chat.minimized
                ? restoreChatWindow(chat.conversationId, chat.inboxContext)
                : minimizeChatWindow(chat.conversationId, chat.inboxContext)
            }
            onClose={() => closeChatWindow(chat.conversationId, chat.inboxContext)}
          />
        </div>
      ))}
    </div>
  );
}
