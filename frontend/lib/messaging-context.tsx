"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type PersonSummary = {
  id: number;
  name: string;
  headline?: string;
  profile_picture?: string | null;
};

export type OrgMembership = {
  slug: string;
  name: string;
  role: string;
  logo?: string | null;
};

export type InboxContext =
  | { type: "personal" }
  | { type: "org"; slug: string; name: string; logo?: string | null };

export type OpenChat = {
  conversationId: number;
  participant: PersonSummary;
  minimized: boolean;
  inboxContext: InboxContext;
};

function chatKey(conversationId: number, context: InboxContext) {
  return context.type === "org" ? `org:${context.slug}:${conversationId}` : `personal:${conversationId}`;
}

export { chatKey };

type InboxState = "minimized" | "expanded";

const DESKTOP_MQ = "(min-width: 1024px)";

type MessagingContextValue = {
  inboxState: InboxState;
  isDesktop: boolean;
  inboxContext: InboxContext;
  openChats: OpenChat[];
  unreadTotal: number;
  setUnreadTotal: (count: number) => void;
  setInboxContext: (context: InboxContext) => void;
  minimizeInbox: () => void;
  expandInbox: () => void;
  toggleInboxFromHeader: () => void;
  openChatWindow: (conversationId: number, participant: PersonSummary, inboxContext?: InboxContext) => void;
  closeChatWindow: (conversationId: number, inboxContext?: InboxContext) => void;
  minimizeChatWindow: (conversationId: number, inboxContext?: InboxContext) => void;
  restoreChatWindow: (conversationId: number, inboxContext?: InboxContext) => void;
};

const MessagingContext = createContext<MessagingContextValue | null>(null);

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [inboxState, setInboxState] = useState<InboxState>("minimized");
  const [inboxContext, setInboxContext] = useState<InboxContext>({ type: "personal" });
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MQ);
    const syncViewport = () => {
      const desktop = media.matches;
      setIsDesktop(desktop);
      if (desktop) setInboxState("expanded");
    };
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  const minimizeInbox = useCallback(() => {
    setInboxState((current) => {
      if (window.matchMedia(DESKTOP_MQ).matches) return "expanded";
      return current === "expanded" ? "minimized" : current;
    });
  }, []);

  const expandInbox = useCallback(() => setInboxState("expanded"), []);

  const toggleInboxFromHeader = useCallback(() => {
    if (window.matchMedia(DESKTOP_MQ).matches) {
      setInboxState("expanded");
      return;
    }
    setInboxState((current) => (current === "expanded" ? "minimized" : "expanded"));
  }, []);

  const openChatWindow = useCallback(
    (conversationId: number, participant: PersonSummary, context?: InboxContext) => {
      const resolvedContext = context ?? inboxContext;
      const key = chatKey(conversationId, resolvedContext);
      setOpenChats((prev) => {
        const existing = prev.find(
          (chat) => chatKey(chat.conversationId, chat.inboxContext) === key
        );
        if (existing) {
          return prev.map((chat) =>
            chatKey(chat.conversationId, chat.inboxContext) === key
              ? { ...chat, minimized: false, inboxContext: resolvedContext }
              : chat
          );
        }
        return [...prev, { conversationId, participant, minimized: false, inboxContext: resolvedContext }];
      });
      if (!window.matchMedia(DESKTOP_MQ).matches) {
        setInboxState("minimized");
      }
    },
    [inboxContext]
  );

  const closeChatWindow = useCallback((conversationId: number, context?: InboxContext) => {
    const resolvedContext = context ?? inboxContext;
    const key = chatKey(conversationId, resolvedContext);
    setOpenChats((prev) =>
      prev.filter((chat) => chatKey(chat.conversationId, chat.inboxContext) !== key)
    );
  }, [inboxContext]);

  const minimizeChatWindow = useCallback((conversationId: number, context?: InboxContext) => {
    const resolvedContext = context ?? inboxContext;
    const key = chatKey(conversationId, resolvedContext);
    setOpenChats((prev) =>
      prev.map((chat) =>
        chatKey(chat.conversationId, chat.inboxContext) === key ? { ...chat, minimized: true } : chat
      )
    );
  }, [inboxContext]);

  const restoreChatWindow = useCallback((conversationId: number, context?: InboxContext) => {
    const resolvedContext = context ?? inboxContext;
    const key = chatKey(conversationId, resolvedContext);
    setOpenChats((prev) =>
      prev.map((chat) =>
        chatKey(chat.conversationId, chat.inboxContext) === key ? { ...chat, minimized: false } : chat
      )
    );
  }, [inboxContext]);

  const value = useMemo(
    () => ({
      inboxState,
      isDesktop,
      inboxContext,
      openChats,
      unreadTotal,
      setUnreadTotal,
      setInboxContext,
      minimizeInbox,
      expandInbox,
      toggleInboxFromHeader,
      openChatWindow,
      closeChatWindow,
      minimizeChatWindow,
      restoreChatWindow,
    }),
    [
      inboxState,
      isDesktop,
      inboxContext,
      openChats,
      unreadTotal,
      minimizeInbox,
      expandInbox,
      toggleInboxFromHeader,
      openChatWindow,
      closeChatWindow,
      minimizeChatWindow,
      restoreChatWindow,
    ]
  );

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error("useMessaging must be used within MessagingProvider");
  }
  return context;
}
