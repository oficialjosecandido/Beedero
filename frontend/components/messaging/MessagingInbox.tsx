"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { startConversationAction, startOrgConversationAction } from "@/app/(app)/feed/actions";
import type { ConversationSummary } from "@/app/(app)/feed/types";
import { formatMessageTimestamp } from "@/lib/format";
import { useMessaging, type InboxContext, type PersonSummary } from "@/lib/messaging-context";

import { MessagingInboxSwitcher } from "./MessagingInboxSwitcher";
import { ParticipantAvatar } from "./messaging-shared";

function inboxContextKey(context: InboxContext) {
  return context.type === "org" ? `org:${context.slug}` : "personal";
}

async function loadConversations(inboxContext: InboxContext): Promise<ConversationSummary[]> {
  try {
    const url =
      inboxContext.type === "org"
        ? `/api/orgs/${inboxContext.slug}/messaging/conversations`
        : "/api/messaging/conversations";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { items: ConversationSummary[] };
    return data.items;
  } catch {
    return [];
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

type InboxTab = "all" | "unread";

type MessagingInboxProps = {
  variant: "column" | "dock" | "hub";
  embedded?: boolean;
  expanded?: boolean;
  onMinimize?: () => void;
  selectedConversationId?: number | null;
  onSelectConversation?: (conversation: ConversationSummary) => void;
};

export function MessagingInbox({
  variant,
  embedded = false,
  expanded = true,
  onMinimize,
  selectedConversationId = null,
  onSelectConversation,
}: MessagingInboxProps) {
  const searchParams = useSearchParams();
  const { inboxContext, refreshUnreadTotal, openChatWindow } = useMessaging();

  const [isPending, startTransition] = useTransition();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [contacts, setContacts] = useState<PersonSummary[]>([]);
  const [search, setSearch] = useState("");
  const [inboxTab, setInboxTab] = useState<InboxTab>("all");
  const [showCompose, setShowCompose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshConversations = useCallback(async () => {
    const items = await loadConversations(inboxContext);
    setConversations(items);
    await refreshUnreadTotal();
  }, [inboxContext, refreshUnreadTotal]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const items = await loadConversations(inboxContext);
      if (cancelled) return;
      setConversations(items);
      await refreshUnreadTotal();
      setLoading(false);
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [inboxContext, refreshUnreadTotal]);

  useEffect(() => {
    void loadContacts().then(setContacts);
  }, []);

  useEffect(() => {
    const chatParam = searchParams.get("chat");
    if (!chatParam || inboxContext.type !== "personal") return;
    const id = Number(chatParam);
    if (!Number.isFinite(id)) return;

    void (async () => {
      const items = await loadConversations(inboxContext);
      if (!items) return;
      const conversation = items.find((item) => item.id === id);
      if (!conversation) return;
      if (onSelectConversation) {
        onSelectConversation(conversation);
        return;
      }
      openChatWindow(
        conversation.id,
        {
          id: conversation.other_participant.id,
          name: conversation.other_participant.name,
          profile_picture: conversation.other_participant.profile_picture,
        },
        inboxContext
      );
    })();
  }, [searchParams, openChatWindow, inboxContext, onSelectConversation]);

  function openConversation(conversation: ConversationSummary) {
    if (onSelectConversation) {
      onSelectConversation(conversation);
      return;
    }
    openChatWindow(
      conversation.id,
      {
        id: conversation.other_participant.id,
        name: conversation.other_participant.name,
        profile_picture: conversation.other_participant.profile_picture,
      },
      inboxContext
    );
  }

  function openConversationWith(userId: number) {
    const person = contacts.find((item) => item.id === userId) ?? null;
    setShowCompose(false);
    setError(null);
    startTransition(async () => {
      const result =
        inboxContext.type === "org"
          ? await startOrgConversationAction(inboxContext.slug, userId)
          : await startConversationAction(userId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const { conversation } = result;
      if (onSelectConversation) {
        onSelectConversation(conversation);
      } else {
        openChatWindow(conversation.id, person ?? conversation.other_participant, inboxContext);
      }
      await refreshConversations();
    });
  }

  const query = search.trim().toLowerCase();
  const filteredConversations = conversations.filter((conversation) => {
    if (inboxTab === "unread" && conversation.unread_count === 0) return false;
    if (!query) return true;
    return conversation.other_participant.name.toLowerCase().includes(query);
  });

  const filteredContacts = contacts.filter((person) =>
    person.name.toLowerCase().includes(query)
  );

  const unreadInList = conversations.filter((c) => c.unread_count > 0).length;

  const emptyMessage =
    inboxContext.type === "org"
      ? inboxTab === "unread"
        ? `No unread messages for ${inboxContext.name}.`
        : `No messages yet for ${inboxContext.name}. Use ✏️ to reach someone on behalf of the organization.`
      : inboxTab === "unread"
        ? "No unread messages."
        : "You don't have any conversations yet.";

  if (!expanded) return null;

  const containerClass =
    variant === "hub"
      ? "flex h-full min-h-0 flex-col overflow-hidden bg-beedero-white"
      : variant === "column"
        ? embedded
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "flex min-h-[min(720px,calc(100vh-8rem))] flex-col overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm"
        : "flex h-[min(520px,70vh)] w-full flex-col overflow-hidden rounded-t-xl border border-b-0 border-zinc-300 bg-beedero-white shadow-xl";

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2.5">
        <MessagingInboxSwitcher />
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              setShowCompose((value) => !value);
              setError(null);
            }}
            className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-beedero-black"
            aria-label="New message"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          {variant === "dock" && onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-beedero-black"
              aria-label="Minimize messages"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-zinc-200 px-3 py-2">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search messages"
            className="w-full rounded-md border border-zinc-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-beedero-black"
          />
        </div>
      </div>

      <div className="flex border-b border-zinc-200 px-3">
        <button
          type="button"
          onClick={() => setInboxTab("all")}
          className={`relative px-3 py-2.5 text-sm font-semibold transition-colors ${
            inboxTab === "all" ? "text-beedero-black" : "text-zinc-500 hover:text-beedero-black"
          }`}
        >
          All
          {inboxTab === "all" && (
            <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-beedero-black" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setInboxTab("unread")}
          className={`relative px-3 py-2.5 text-sm font-semibold transition-colors ${
            inboxTab === "unread" ? "text-beedero-black" : "text-zinc-500 hover:text-beedero-black"
          }`}
        >
          Unread
          {unreadInList > 0 && (
            <span className="ml-1.5 text-xs font-bold text-zinc-500">({unreadInList})</span>
          )}
          {inboxTab === "unread" && (
            <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-beedero-black" />
          )}
        </button>
      </div>

      {error && <p className="border-b border-zinc-200 px-4 py-2 text-xs text-red-600">{error}</p>}
      {showCompose && (
        <div className="max-h-44 overflow-y-auto border-b border-zinc-200 p-2">
          {filteredContacts.length === 0 ? (
            <p className="px-2 py-3 text-sm text-zinc-500">
              Follow people on Discover to message them.
            </p>
          ) : (
            filteredContacts.map((person) => (
              <button
                key={person.id}
                type="button"
                disabled={isPending}
                onClick={() => openConversationWith(person.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-zinc-100 disabled:opacity-50"
              >
                <ParticipantAvatar name={person.name} profilePicture={person.profile_picture} size="sm" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="block font-semibold text-beedero-black">{person.name}</span>
                  {person.headline && (
                    <span className="block truncate text-xs text-zinc-500">{person.headline}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-6 text-sm text-zinc-500">Loading…</p>
        ) : filteredConversations.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">{emptyMessage}</p>
        ) : (
          filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => openConversation(conversation)}
              className={`flex w-full items-start gap-3 border-b border-zinc-100 px-3 py-3 text-left hover:bg-zinc-50 ${
                conversation.unread_count > 0 ? "bg-beedero-yellow/10" : ""
              } ${selectedConversationId === conversation.id ? "bg-zinc-100" : ""}`}
            >
              <ParticipantAvatar
                name={conversation.other_participant.name}
                profilePicture={conversation.other_participant.profile_picture}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={`truncate text-sm ${
                      conversation.unread_count > 0
                        ? "font-bold text-beedero-black"
                        : "font-semibold text-beedero-black"
                    }`}
                  >
                    {conversation.other_participant.name}
                  </span>
                  {conversation.last_message_at && (
                    <span className="shrink-0 text-[11px] text-zinc-500">
                      {formatMessageTimestamp(conversation.last_message_at)}
                    </span>
                  )}
                </span>
                {conversation.last_message && (
                  <span
                    className={`mt-0.5 block truncate text-xs ${
                      conversation.unread_count > 0 ? "font-medium text-zinc-700" : "text-zinc-500"
                    }`}
                  >
                    {conversation.last_message.is_mine ? "You: " : ""}
                    {conversation.last_message.body}
                  </span>
                )}
              </span>
              {conversation.unread_count > 0 && (
                <span className="mt-1 flex size-2 shrink-0 rounded-full bg-beedero-black" aria-hidden />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function MessagingInboxWithContext(props: MessagingInboxProps) {
  const { inboxContext } = useMessaging();
  return <MessagingInbox key={inboxContextKey(inboxContext)} {...props} />;
}
