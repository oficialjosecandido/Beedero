"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type NotificationItem = {
  id: number;
  kind: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  updated_at: string;
  payload?: { suggestion_title?: string; suggestion_body?: string };
};

export type NotificationPreferences = { digest_email: boolean; inapp_engagement: boolean };

type NotificationsContextValue = {
  unread: number;
  items: NotificationItem[];
  prefs: NotificationPreferences | null;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  updatePreference: (field: keyof NotificationPreferences, value: boolean) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread_count: number; items: NotificationItem[] };
      setUnread(data.unread_count);
      setItems(data.items);
    } catch {
      // ignore polling errors
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { unread_count: number; items: NotificationItem[] };
        setUnread(data.unread_count);
        setItems(data.items);
      } catch {
        // ignore polling errors
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications", { method: "POST", body: JSON.stringify({}) });
    setUnread(0);
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/preferences", { cache: "no-store" });
      if (!res.ok) return;
      setPrefs((await res.json()) as NotificationPreferences);
    } catch {
      // ignore
    }
  }, []);

  const updatePreference = useCallback(
    async (field: keyof NotificationPreferences, value: boolean) => {
      setPrefs((prev) => (prev ? { ...prev, [field]: value } : prev));
      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          body: JSON.stringify({ [field]: value }),
        });
        if (res.ok) setPrefs((await res.json()) as NotificationPreferences);
      } catch {
        // ignore
      }
    },
    []
  );

  const value = useMemo(
    () => ({ unread, items, prefs, refresh, markAllRead, loadPreferences, updatePreference }),
    [unread, items, prefs, refresh, markAllRead, loadPreferences, updatePreference]
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return context;
}
