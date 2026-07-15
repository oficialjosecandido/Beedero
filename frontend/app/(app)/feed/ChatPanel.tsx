"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { sendMessageAction, startConversationAction } from "./actions";
import type { ConversationSummary, MessageItem } from "./types";

type PersonSummary = { id: number; name: string; headline?: string; profile_picture?: string | null };

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

export function ChatPanel({ people }: { people: PersonSummary[] }) {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(() => {
    const chatParam = searchParams.get("chat");
    if (!chatParam) return null;
    const id = Number(chatParam);
    return Number.isFinite(id) ? id : null;
  });
  const [activeParticipant, setActiveParticipant] = useState<PersonSummary | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState("");
  const [showPeople, setShowPeople] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refreshConversations() {
      const items = await loadConversations();
      if (!cancelled && items) setConversations(items);
    }

    void refreshConversations();
    const timer = window.setInterval(() => void refreshConversations(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (activeId == null) return;
    let cancelled = false;

    async function refreshMessages() {
      const items = await loadMessages(activeId as number);
      if (!cancelled && items) setMessages(items);
    }

    void refreshMessages();
    const timer = window.setInterval(() => void refreshMessages(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeId]);

  async function openConversationWith(userId: number) {
    const person = people.find((item) => item.id === userId) ?? null;
    setShowPeople(false);
    setError(null);
    startTransition(async () => {
      const result = await startConversationAction(userId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const { conversation } = result;
      setActiveId(conversation.id);
      setActiveParticipant(person ?? conversation.other_participant);
      setMessages([]);
      const items = await loadConversations();
      if (items) setConversations(items);
    });
  }

  async function sendMessage() {
    const body = draft.trim();
    if (!body || activeId == null) return;
    setDraft("");
    setError(null);
    startTransition(async () => {
      const result = await sendMessageAction(activeId as number, body);
      if ("error" in result) {
        setError(result.error);
        setDraft(body);
        return;
      }
      const items = await loadMessages(activeId as number);
      if (items) setMessages(items);
      const refreshed = await loadConversations();
      if (refreshed) setConversations(refreshed);
    });
  }

  function openConversation(conversation: ConversationSummary) {
    setError(null);
    setMessages([]);
    setActiveId(conversation.id);
    setActiveParticipant({
      id: conversation.other_participant.id,
      name: conversation.other_participant.name,
      profile_picture: conversation.other_participant.profile_picture,
    });
  }

  function backToList() {
    setError(null);
    setActiveId(null);
    setActiveParticipant(null);
    setMessages([]);
  }

  const activeConversation =
    activeId == null ? null : (conversations.find((conversation) => conversation.id === activeId) ?? null);
  const activeName =
    activeParticipant?.name ?? activeConversation?.other_participant.name ?? "Conversation";

  return (
    <div className="flex h-[min(560px,70vh)] flex-col rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm lg:h-[calc(100vh-8rem)]">
      {activeId == null ? (
        <>
          <div className="flex items-center justify-between border-b border-beedero-border p-4">
            <p className="text-sm font-bold uppercase tracking-[0.15em] text-beedero-black/60">
              Messages
            </p>
            <button
              type="button"
              onClick={() => {
                setShowPeople((value) => !value);
                setError(null);
              }}
              className="text-xs font-semibold text-beedero-black/60 hover:text-beedero-black"
            >
              New
            </button>
          </div>
          {error && (
            <p className="border-b border-beedero-border px-4 py-2 text-xs text-red-600">{error}</p>
          )}
          {showPeople && (
            <div className="max-h-56 overflow-y-auto border-b border-beedero-border p-2">
              {people.length === 0 ? (
                <p className="px-2 py-3 text-sm text-zinc-500">
                  Follow people from Discover to message them.
                </p>
              ) : (
                people.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => void openConversationWith(person.id)}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-beedero-yellow/20"
                  >
                    {person.profile_picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={person.profile_picture}
                        alt=""
                        className="size-7 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex size-7 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500">
                        {person.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="truncate font-medium">{person.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <p className="px-2 py-4 text-sm text-zinc-500">No conversations yet.</p>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => openConversation(conversation)}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-beedero-yellow/20"
                >
                  {conversation.other_participant.profile_picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={conversation.other_participant.profile_picture}
                      alt=""
                      className="size-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500">
                      {conversation.other_participant.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {conversation.other_participant.name}
                    </span>
                  </span>
                  {conversation.unread_count > 0 && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-beedero-black text-[10px] font-bold text-beedero-yellow">
                      {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-beedero-border p-4">
            <button
              type="button"
              onClick={backToList}
              className="text-sm font-semibold text-beedero-black/60 hover:text-beedero-black"
              aria-label="Back to conversations"
            >
              ←
            </button>
            <p className="truncate font-semibold">{activeName}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
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
          {error && <p className="px-3 pb-1 text-xs text-red-600">{error}</p>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
            className="flex items-center gap-2 border-t border-beedero-border p-3"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message…"
              className="flex-1 rounded-xl border border-beedero-border px-3 py-2 text-sm outline-none focus:border-beedero-black"
              maxLength={4000}
            />
            <button
              type="submit"
              disabled={!draft.trim() || isPending}
              className="rounded-xl bg-beedero-yellow px-3 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
            >
              {isPending ? "Sending…" : "Send"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
