"use client";

import { Suspense, useCallback, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  FaArrowLeft,
  FaCheck,
  FaClock,
  FaComment,
  FaEllipsisH,
  FaPaperPlane,
  FaSearch,
  FaUserPlus,
} from "react-icons/fa";

import {
  sendMessageAction,
  sendOrgMessageAction,
  startConversationAction,
  startOrgConversationAction,
} from "@/app/(app)/feed/actions";
import type { ConversationSummary, MessageItem } from "@/app/(app)/feed/types";
import { MessagingInboxSwitcher } from "@/components/messaging/MessagingInboxSwitcher";
import { loadMessages, ParticipantAvatar } from "@/components/messaging/messaging-shared";
import { formatMessageTimestamp, formatRelativeTime } from "@/lib/format";
import { useMessaging, type InboxContext, type PersonSummary } from "@/lib/messaging-context";
import { useVisiblePolling } from "@/lib/use-visible-polling";

function inboxContextKey(context: InboxContext) {
  return context.type === "org" ? `org:${context.slug}` : "personal";
}

function compactStamp(value: string | null | undefined) {
  if (!value) return "";
  const relative = formatRelativeTime(value).replace(" ago", "");
  if (relative) return relative;
  return formatMessageTimestamp(value);
}

function toneForName(name: string) {
  const tones = ["bg-[#7b697d]", "bg-[#5e7d70]", "bg-[#68738a]", "bg-[#514f77]", "bg-[#886c60]", "bg-[#586f80]"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % tones.length;
  return tones[hash];
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

function HubChat({
  conversation,
  inboxContext,
  onBack,
}: {
  conversation: ConversationSummary;
  inboxContext: InboxContext;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const participant = conversation.other_participant;

  const refresh = useCallback(async () => {
    const items = await loadMessages(conversation.id, inboxContext);
    if (items) setMessages(items);
  }, [conversation.id, inboxContext]);

  useVisiblePolling({ onPoll: refresh, intervalMs: 15_000 });

  function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    setError(null);
    startTransition(async () => {
      const result =
        inboxContext.type === "org"
          ? await sendOrgMessageAction(inboxContext.slug, conversation.id, body)
          : await sendMessageAction(conversation.id, body);
      if ("error" in result) {
        setError(result.error);
        setDraft(body);
        return;
      }
      setMessages((prev) => [...prev, result.message]);
    });
  }

  const dayLabel = messages[0]
    ? new Date(messages[0].created_at).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <section className="flex min-h-[calc(100dvh-140px)] flex-col sm:min-h-[620px]">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="grid size-9 place-items-center border border-white/10 text-white/65 transition hover:border-beedero-yellow hover:text-beedero-yellow"
          aria-label="Back to messages"
        >
          <FaArrowLeft className="size-[15px]" aria-hidden />
        </button>
        <ParticipantAvatar name={participant.name} profilePicture={participant.profile_picture} size="sm" />
        <div className="min-w-0">
          <b className="block truncate text-sm text-white">{participant.name}</b>
          <p className="flex items-center gap-1 text-[10px] text-emerald-400">
            <FaCheck className="size-[11px]" aria-hidden /> Connection
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8">
        {dayLabel && (
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="font-mono text-[10px] text-white/35">{dayLabel}</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.is_mine ? "ml-auto max-w-[86%] sm:max-w-[64%]" : "max-w-[86%] sm:max-w-[64%]"}
          >
            <p
              className={`px-4 py-3 text-sm leading-6 ${
                message.is_mine
                  ? "bg-beedero-yellow font-semibold text-beedero-black"
                  : "bg-white/[0.07] text-white/85"
              }`}
            >
              {message.body}
            </p>
            <small
              className={`mt-1 flex items-center gap-1 text-[10px] text-white/35 ${
                message.is_mine ? "justify-end" : ""
              }`}
            >
              <FaClock className="size-[10px]" aria-hidden />
              {compactStamp(message.created_at)}
            </small>
          </div>
        ))}
      </div>

      <form
        className="sticky bottom-0 border-t border-white/10 bg-[#11151b] p-3 pb-20 sm:p-5 sm:pb-5"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
        <div className="flex gap-2 border border-white/10 bg-white/[0.025] p-1.5 focus-within:border-beedero-yellow/70">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-base text-white outline-none placeholder:text-white/30"
            placeholder={`Message ${participant.name}…`}
            maxLength={4000}
          />
          <button
            type="submit"
            disabled={!draft.trim() || isPending}
            className="grid size-10 place-items-center bg-beedero-yellow text-beedero-black disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Send message"
          >
            <FaPaperPlane className="size-4" aria-hidden />
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-white/30">
          <FaUserPlus className="size-[11px]" aria-hidden /> You are connected — your message will be
          delivered directly.
        </p>
      </form>
    </section>
  );
}

function MessagesHubContent() {
  const searchParams = useSearchParams();
  const { inboxContext, refreshUnreadTotal } = useMessaging();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [contacts, setContacts] = useState<PersonSummary[]>([]);
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const [items, contactItems] = await Promise.all([
      loadConversations(inboxContext),
      inboxContext.type === "personal" ? loadContacts() : Promise.resolve([] as PersonSummary[]),
    ]);
    setConversations(items);
    if (inboxContext.type === "personal") setContacts(contactItems);
    setLoading(false);
    await refreshUnreadTotal();
  }, [inboxContext, refreshUnreadTotal]);

  useVisiblePolling({
    onPoll: async () => {
      const items = await loadConversations(inboxContext);
      setConversations(items);
      setLoading(false);
    },
    intervalMs: 45_000,
  });

  // Remounts via MessagesHubKeyed's key when inboxContext changes, so selected/
  // loading reset themselves — only kick off the first fetch here.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const chatParam = searchParams.get("chat");
    if (!chatParam || inboxContext.type !== "personal") return;
    const id = Number(chatParam);
    if (!Number.isFinite(id)) return;
    void (async () => {
      const items = await loadConversations(inboxContext);
      const conversation = items.find((item) => item.id === id);
      if (conversation) setSelected(conversation);
    })();
  }, [searchParams, inboxContext]);

  function openConversation(conversation: ConversationSummary) {
    setSelected(conversation);
    setConversations((items) =>
      items.map((item) => (item.id === conversation.id ? { ...item, unread_count: 0 } : item))
    );
  }

  function openWith(userId: number) {
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
      setSelected(result.conversation);
      await refresh();
    });
  }

  const query = search.trim().toLowerCase();
  const unreadCount = conversations.filter((c) => c.unread_count > 0).length;
  const visible = conversations
    .filter((c) => (!unreadOnly || c.unread_count > 0) && (!query || c.other_participant.name.toLowerCase().includes(query)))
    .sort((a, b) => Number(b.unread_count > 0) - Number(a.unread_count > 0));

  const composeContacts = contacts.filter((p) => p.name.toLowerCase().includes(query));

  if (selected) {
    return (
      <div className="overflow-hidden border border-white/10 bg-[#11151b]">
        <HubChat
          key={`${inboxContextKey(inboxContext)}:${selected.id}`}
          conversation={selected}
          inboxContext={inboxContext}
          onBack={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-white/10 bg-[#11151b]">
      <header className="border-b border-white/10 px-5 py-7 sm:px-8 sm:py-9">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FaComment className="size-6 text-beedero-yellow" aria-hidden />
            <h1 className="text-3xl font-black tracking-[-0.055em] sm:text-4xl">Messages</h1>
          </div>
          <div className="flex items-center gap-3">
            <MessagingInboxSwitcher />
            <button
              type="button"
              onClick={() => {
                setShowCompose((v) => !v);
                setError(null);
              }}
              className="text-white/45 transition hover:text-white"
              aria-label="New message"
            >
              <FaEllipsisH className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <label className="mt-7 flex items-center gap-3 border border-white/15 bg-white/[0.025] px-4 py-3.5 text-white/35 focus-within:border-white/35">
          <FaSearch className="size-[18px] shrink-0" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            placeholder="Search messages"
          />
        </label>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => setUnreadOnly(false)}
            className={`px-4 py-2.5 text-sm font-bold ${
              !unreadOnly ? "bg-beedero-yellow text-beedero-black" : "border border-white/15 text-white/60"
            }`}
          >
            All messages
          </button>
          <button
            type="button"
            onClick={() => setUnreadOnly(true)}
            className={`flex items-center gap-2 border px-4 py-2.5 text-sm font-bold ${
              unreadOnly
                ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
                : "border-white/15 text-white/60"
            }`}
          >
            Unread
            <span
              className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] ${
                unreadOnly ? "bg-beedero-black text-beedero-yellow" : "bg-white/10 text-white/65"
              }`}
            >
              {unreadCount}
            </span>
          </button>
        </div>
      </header>

      {error && <p className="border-b border-white/10 px-5 py-3 text-xs text-red-400">{error}</p>}

      {showCompose && (
        <div className="max-h-56 overflow-y-auto border-b border-white/10">
          {composeContacts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-white/40">
              {query ? "No connections match your search." : "Connect with people to start messaging."}
            </p>
          ) : (
            composeContacts.map((person) => (
              <button
                key={person.id}
                type="button"
                disabled={isPending}
                onClick={() => openWith(person.id)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/[0.04] disabled:opacity-50 sm:px-8"
              >
                <ParticipantAvatar name={person.name} profilePicture={person.profile_picture} size="sm" />
                <span className="min-w-0">
                  <b className="block truncate text-sm text-white">{person.name}</b>
                  {person.headline && (
                    <span className="block truncate text-xs text-white/40">{person.headline}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="divide-y divide-white/[0.07]">
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-white/40">Loading messages…</p>
        ) : visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-white/40">
            {unreadOnly ? "You have no unread messages." : "No conversations yet."}
          </p>
        ) : (
          visible.map((c) => {
            const unread = c.unread_count > 0;
            const preview = c.last_message?.body;
            const stamp = compactStamp(c.last_message_at);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openConversation(c)}
                className={`relative flex w-full items-center gap-4 px-5 py-4 text-left transition sm:px-8 sm:py-5 ${
                  unread ? "bg-white/[0.075] hover:bg-white/[0.1]" : "hover:bg-white/[0.035]"
                }`}
              >
                {unread && <span className="absolute inset-y-3 left-0 w-0.5 bg-beedero-yellow" />}
                {c.other_participant.profile_picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.other_participant.profile_picture}
                    alt=""
                    className="size-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className={`grid size-12 shrink-0 place-items-center rounded-full text-sm font-black text-white ${toneForName(
                      c.other_participant.name
                    )}`}
                  >
                    {c.other_participant.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <b className="truncate text-base text-white">{c.other_participant.name}</b>
                    <small className={`shrink-0 text-xs ${unread ? "text-beedero-yellow" : "text-white/35"}`}>
                      {stamp}
                    </small>
                  </span>
                  <span
                    className={`mt-1 flex items-center gap-3 text-sm ${
                      unread ? "font-semibold text-white/75" : "text-white/40"
                    }`}
                  >
                    <span className="truncate">
                      {c.last_message?.is_mine ? "You: " : ""}
                      {preview || "No messages yet"}
                    </span>
                    {unread && <i className="size-2.5 shrink-0 rounded-full bg-beedero-yellow" />}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function MessagesHubKeyed() {
  const { inboxContext } = useMessaging();
  return <MessagesHubContent key={inboxContextKey(inboxContext)} />;
}

export function MessagesHub() {
  return (
    <Suspense fallback={<p className="text-sm text-white/40">Loading messages…</p>}>
      <MessagesHubKeyed />
    </Suspense>
  );
}
