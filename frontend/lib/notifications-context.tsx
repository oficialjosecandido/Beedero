"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { requestPushToken } from "@/lib/push";
import { useVisiblePolling } from "@/lib/use-visible-polling";

export type NotificationItem = {
  id: number;
  kind: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  updated_at: string;
  payload?: {
    suggestion_title?: string;
    suggestion_body?: string;
    affiliation_id?: number;
    can_accept?: boolean;
  };
};

export type NotificationPreferences = {
  digest_email: boolean;
  inapp_engagement: boolean;
  push_enabled: boolean;
};

const DEFAULT_PREFS: NotificationPreferences = {
  digest_email: true,
  inapp_engagement: true,
  push_enabled: false,
};

type NotificationsContextValue = {
  unread: number;
  items: NotificationItem[];
  loading: boolean;
  prefs: NotificationPreferences;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  updatePreference: (field: keyof NotificationPreferences, value: boolean) => Promise<void>;
  setPushEnabled: (value: boolean) => Promise<string | null>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  // Starts true so consumers can distinguish "still fetching" from a real
  // empty inbox — without this, NotificationsPanel briefly rendered "No
  // notifications yet" for users who do have notifications, before the
  // first poll resolved.
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread_count: number; items: NotificationItem[] };
      setUnread(data.unread_count);
      setItems(data.items);
    } catch {
      // ignore polling errors
    } finally {
      setLoading(false);
    }
  }, []);

  const pollUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread_count: number };
      setUnread(data.unread_count);
    } catch {
      // ignore polling errors
    } finally {
      setLoading(false);
    }
  }, []);

  useVisiblePolling({ onPoll: pollUnread, intervalMs: 60_000 });

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
      setPrefs((prev) => ({ ...prev, [field]: value }));
      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        if (res.ok) {
          setPrefs((await res.json()) as NotificationPreferences);
          return;
        }
        // Revert optimistic update if the server rejected it.
        setPrefs((prev) => ({ ...prev, [field]: !value }));
      } catch {
        setPrefs((prev) => ({ ...prev, [field]: !value }));
      }
    },
    []
  );

  const setPushEnabled = useCallback(
    async (value: boolean): Promise<string | null> => {
      if (value) {
        const token = await requestPushToken();
        if (!token) {
          return "Push is not available on this device. Allow notifications in system settings, or add Beedero to your Home Screen.";
        }
        try {
          const res = await fetch("/api/notifications/push-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          if (!res.ok) return "Could not register this device for push notifications.";
        } catch {
          return "Could not register this device for push notifications.";
        }
      } else {
        try {
          await fetch("/api/notifications/push-token", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        } catch {
          // Prefer turning the preference off even if unregister fails.
        }
      }
      await updatePreference("push_enabled", value);
      return null;
    },
    [updatePreference]
  );

  const value = useMemo(
    () => ({
      unread,
      items,
      loading,
      prefs,
      refresh,
      markAllRead,
      loadPreferences,
      updatePreference,
      setPushEnabled,
    }),
    [unread, items, loading, prefs, refresh, markAllRead, loadPreferences, updatePreference, setPushEnabled]
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
