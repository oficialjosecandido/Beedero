import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase-config";

function firebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * Requests notification permission and returns an FCM registration token,
 * or null if unsupported, unconfigured, or the user declines. Must run
 * from a user-initiated action (a permission-request toggle), not on load.
 */
export async function requestPushToken(): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (!("serviceWorker" in navigator)) return null;
  if (!(await isSupported())) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging(firebaseApp());
    return await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  } catch {
    return null;
  }
}

export type ForegroundPush = { title: string; body: string; link: string };

/** Foreground tab messages skip the service worker's background handler —
 * FCM fires this in-page instead, so we can render a normal toast. */
export function listenForForegroundPush(onReceive: (push: ForegroundPush) => void) {
  if (!isFirebaseConfigured()) return () => {};

  let unsubscribe = () => {};
  let cancelled = false;

  isSupported().then((supported) => {
    if (!supported || cancelled) return;
    const messaging = getMessaging(firebaseApp());
    unsubscribe = onMessage(messaging, (payload) => {
      onReceive({
        title: payload.notification?.title ?? "Beedero",
        body: payload.notification?.body ?? "",
        link: payload.fcmOptions?.link || (payload.data?.link as string | undefined) || "/",
      });
    });
  });

  return () => {
    cancelled = true;
    unsubscribe();
  };
}
