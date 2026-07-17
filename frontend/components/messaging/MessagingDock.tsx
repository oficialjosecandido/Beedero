"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { sendMessageAction, startConversationAction } from "@/app/(app)/feed/actions";
import type { ConversationSummary, MessageItem } from "@/app/(app)/feed/types";
import { useMessaging, type PersonSummary } from "@/lib/messaging-context";

async function loadConversations(): Promise<ConversationSummary[] | null> {
  try {
    const res = await fetch("/api/messaging/conversations", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { items: ConversationSummary[] };
    return data.items;
  } catch {
    return null;
  }
}

async function loadContacts(): Promise<PersonSummary[]> {
  try {
    const res = await fetch("/api/contacts", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { items: PersonSummary[] };
    return data.items;
  } catch {
    return [];
  }
}

async function loadMessages(conversationId: number): Promise<MessageItem[] | null> {
  try {
    const res = await fetch(`/api/messaging/conversations/${conversationId}/messages`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { items: MessageItem[] };
    return [...data.items].reverse();
  } catch {
    return null;
  }
}

function ParticipantAvatar({
  name,
  profilePicture,
  size = "md",
}: {
  name: string;
  profilePicture?: string | null;
  size?: "sm" | "md";
}) {
  const classes = size === "sm" ? "size-8 text-xs" : "size-9 text-sm";
  if (profilePicture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profilePicture} alt="" className={`${classes} shrink-0 rounded-full object-cover`} />
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

function ChatWindow({
  conversationId,
  participant,
  minimized,
  onMinimize,
  onClose,
}: {
  conversationId: number;
  participant: PersonSummary;
  minimized: boolean;
  onMinimize: () => void;
  onClose: () => void;
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
      const items = await loadMessages(conversationId);
      // A newer request (poll or send) may have started and already
      // applied fresher state while this one was in flight — a response
      // arriving out of order must not clobber it.
      if (!cancelled && items && requestId === requestIdRef.current) setMessages(items);
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [conversationId, minimized]);

  function sendMessage() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setError(null);
    startTransition(async () => {
      const result = await sendMessageAction(conversationId, body);
      if ("error" in result) {
        setError(result.error);
        setDraft(body);
        return;
      }
      requestIdRef.current += 1;
      setMessages((prev) => [...prev, result.message]);
    });
  }

  if (minimized) {
    return (
      <button
        type="button"
        onClick={onMinimize}
        className="flex h-12 w-[220px] items-center gap-2 rounded-t-xl border border-b-0 border-beedero-border bg-beedero-white px-3 shadow-lg hover:bg-zinc-50"
      >
        <ParticipantAvatar name={participant.name} profilePicture={participant.profile_picture} size="sm" />
        <span className="truncate text-sm font-semibold text-beedero-black">{participant.name}</span>
      </button>
    );
  }

  return (
    <div className="flex h-[min(420px,60vh)] w-[min(328px,calc(100vw-2rem))] flex-col overflow-hidden rounded-t-xl border border-b-0 border-beedero-border bg-beedero-white shadow-2xl">
      <div className="flex items-center justify-between gap-2 bg-beedero-black px-3 py-2.5 text-beedero-white">
        <div className="flex min-w-0 items-center gap-2">
          <ParticipantAvatar name={participant.name} profilePicture={participant.profile_picture} size="sm" />
          <p className="truncate text-sm font-semibold">{participant.name}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMinimize}
            className="rounded p-1 hover:bg-white/10"
            aria-label="Minimize conversation"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-white/10"
            aria-label="Close conversation"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
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
      {error && <p className="px-3 text-xs text-red-600">{error}</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
        className="flex items-center gap-2 border-t border-beedero-border p-3"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message…"
          className="flex-1 rounded-full border border-beedero-border px-3 py-2 text-sm outline-none focus:border-beedero-black"
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

export function MessagingDock() {
  const searchParams = useSearchParams();
  const {
    inboxState,
    openChats,
    unreadTotal,
    setUnreadTotal,
    minimizeInbox,
    expandInbox,
    openChatWindow,
    closeChatWindow,
    minimizeChatWindow,
    restoreChatWindow,
  } = useMessaging();

  const [isPending, startTransition] = useTransition();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [contacts, setContacts] = useState<PersonSummary[]>([]);
  const [search, setSearch] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    const items = await loadConversations();
    if (items) {
      setConversations(items);
      setUnreadTotal(items.reduce((sum, item) => sum + item.unread_count, 0));
    }
  }, [setUnreadTotal]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const items = await loadConversations();
      if (cancelled || !items) return;
      setConversations(items);
      setUnreadTotal(items.reduce((sum, item) => sum + item.unread_count, 0));
    }

    void poll();
    void loadContacts().then(setContacts);
    const timer = window.setInterval(() => void poll(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [setUnreadTotal]);

  useEffect(() => {
    const chatParam = searchParams.get("chat");
    if (!chatParam) return;
    const id = Number(chatParam);
    if (!Number.isFinite(id)) return;

    void (async () => {
      const items = await loadConversations();
      if (!items) return;
      const conversation = items.find((item) => item.id === id);
      if (!conversation) return;
      openChatWindow(conversation.id, {
        id: conversation.other_participant.id,
        name: conversation.other_participant.name,
        profile_picture: conversation.other_participant.profile_picture,
      });
    })();
  }, [searchParams, openChatWindow]);

  function openConversation(conversation: ConversationSummary) {
    openChatWindow(conversation.id, {
      id: conversation.other_participant.id,
      name: conversation.other_participant.name,
      profile_picture: conversation.other_participant.profile_picture,
    });
  }

  function openConversationWith(userId: number) {
    const person = contacts.find((item) => item.id === userId) ?? null;
    setShowCompose(false);
    setError(null);
    startTransition(async () => {
      const result = await startConversationAction(userId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const { conversation } = result;
      openChatWindow(conversation.id, person ?? conversation.other_participant);
      await refreshConversations();
    });
  }

  const filteredConversations = conversations.filter((conversation) =>
    conversation.other_participant.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const filteredContacts = contacts.filter((person) =>
    person.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const inboxExpanded = inboxState === "expanded";

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-50 flex flex-row-reverse items-end gap-2 p-2 sm:right-4 sm:gap-3 sm:p-0 sm:pb-0">
      <div className="pointer-events-auto">
        {inboxExpanded ? (
          <div className="flex h-[min(520px,70vh)] w-[min(360px,calc(100vw-1rem))] flex-col overflow-hidden rounded-t-xl border border-b-0 border-beedero-border bg-beedero-white shadow-2xl">
            <div className="flex items-center justify-between gap-2 bg-beedero-black px-4 py-3 text-beedero-white">
              <p className="text-sm font-bold">Messaging</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCompose((value) => !value);
                    setError(null);
                  }}
                  className="rounded p-1.5 hover:bg-white/10"
                  aria-label="New message"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={minimizeInbox}
                  className="rounded p-1.5 hover:bg-white/10"
                  aria-label="Minimize messaging"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="border-b border-beedero-border px-3 py-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search messages"
                className="w-full rounded-full border border-beedero-border bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-beedero-black"
              />
            </div>
            {error && <p className="border-b border-beedero-border px-4 py-2 text-xs text-red-600">{error}</p>}
            {showCompose && (
              <div className="max-h-48 overflow-y-auto border-b border-beedero-border p-2">
                {filteredContacts.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-zinc-500">
                    Follow people from Discover to message them.
                  </p>
                ) : (
                  filteredContacts.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => openConversationWith(person.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-beedero-yellow/20 disabled:opacity-50"
                    >
                      <ParticipantAvatar
                        name={person.name}
                        profilePicture={person.profile_picture}
                        size="sm"
                      />
                      <span className="truncate font-medium">{person.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <p className="px-4 py-6 text-sm text-zinc-500">No conversations yet.</p>
              ) : (
                filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => openConversation(conversation)}
                    className="flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-3 text-left hover:bg-zinc-50"
                  >
                    <ParticipantAvatar
                      name={conversation.other_participant.name}
                      profilePicture={conversation.other_participant.profile_picture}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-beedero-black">
                        {conversation.other_participant.name}
                      </span>
                      {conversation.last_message && (
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">
                          {conversation.last_message.is_mine ? "You: " : ""}
                          {conversation.last_message.body}
                        </span>
                      )}
                    </span>
                    {conversation.unread_count > 0 && (
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-beedero-black text-[10px] font-bold text-beedero-yellow">
                        {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={expandInbox}
            className="flex h-12 w-[min(280px,calc(100vw-2rem))] items-center justify-between rounded-t-xl border border-b-0 border-beedero-border bg-beedero-white px-4 shadow-lg hover:bg-zinc-50"
          >
            <div className="flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="size-5 text-beedero-black"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-sm font-bold text-beedero-black">Messaging</span>
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
        )}
      </div>

      {openChats.map((chat) => (
        <div key={chat.conversationId} className="pointer-events-auto">
          <ChatWindow
            conversationId={chat.conversationId}
            participant={chat.participant}
            minimized={chat.minimized}
            onMinimize={() =>
              chat.minimized
                ? restoreChatWindow(chat.conversationId)
                : minimizeChatWindow(chat.conversationId)
            }
            onClose={() => closeChatWindow(chat.conversationId)}
          />
        </div>
      ))}
    </div>
  );
}
