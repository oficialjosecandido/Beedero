"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type PersonSummary = {
  id: number;
  name: string;
  headline?: string;
  profile_picture?: string | null;
};

export type OpenChat = {
  conversationId: number;
  participant: PersonSummary;
  minimized: boolean;
};

type InboxState = "hidden" | "minimized" | "expanded";

type MessagingContextValue = {
  inboxState: InboxState;
  openChats: OpenChat[];
  unreadTotal: number;
  setUnreadTotal: (count: number) => void;
  openInbox: () => void;
  minimizeInbox: () => void;
  expandInbox: () => void;
  toggleInboxFromHeader: () => void;
  openChatWindow: (conversationId: number, participant: PersonSummary) => void;
  closeChatWindow: (conversationId: number) => void;
  minimizeChatWindow: (conversationId: number) => void;
  restoreChatWindow: (conversationId: number) => void;
};

const MessagingContext = createContext<MessagingContextValue | null>(null);

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const [inboxState, setInboxState] = useState<InboxState>("minimized");
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const openInbox = useCallback(() => setInboxState("expanded"), []);
  const minimizeInbox = useCallback(() => setInboxState("minimized"), []);
  const expandInbox = useCallback(() => setInboxState("expanded"), []);

  const toggleInboxFromHeader = useCallback(() => {
    setInboxState((current) => (current === "expanded" ? "minimized" : "expanded"));
  }, []);

  const openChatWindow = useCallback((conversationId: number, participant: PersonSummary) => {
    setOpenChats((prev) => {
      const existing = prev.find((chat) => chat.conversationId === conversationId);
      if (existing) {
        return prev.map((chat) =>
          chat.conversationId === conversationId ? { ...chat, minimized: false } : chat
        );
      }
      return [...prev, { conversationId, participant, minimized: false }];
    });
    setInboxState("minimized");
  }, []);

  const closeChatWindow = useCallback((conversationId: number) => {
    setOpenChats((prev) => prev.filter((chat) => chat.conversationId !== conversationId));
  }, []);

  const minimizeChatWindow = useCallback((conversationId: number) => {
    setOpenChats((prev) =>
      prev.map((chat) =>
        chat.conversationId === conversationId ? { ...chat, minimized: true } : chat
      )
    );
  }, []);

  const restoreChatWindow = useCallback((conversationId: number) => {
    setOpenChats((prev) =>
      prev.map((chat) =>
        chat.conversationId === conversationId ? { ...chat, minimized: false } : chat
      )
    );
  }, []);

  const value = useMemo(
    () => ({
      inboxState,
      openChats,
      unreadTotal,
      setUnreadTotal,
      openInbox,
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
      openChats,
      unreadTotal,
      openInbox,
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
