import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase-config";

// The Firebase SDK is imported dynamically rather than at module scope.
// `listenForForegroundPush` is mounted from the root layout, so a static
// import would pull firebase/app + firebase/messaging into the first-load
// bundle of every route — including logged-out pages that can never receive
// a push. These imports resolve to a separate chunk fetched after hydration,
// and only when Firebase is actually configured.
async function messagingApi() {
  const [{ getApp, getApps, initializeApp }, messaging] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { app, ...messaging };
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

  const { app, getMessaging, getToken, isSupported } = await messagingApi();
  if (!(await isSupported())) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);
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

  void (async () => {
    try {
      const { app, getMessaging, isSupported, onMessage } = await messagingApi();
      if (!(await isSupported()) || cancelled) return;
      unsubscribe = onMessage(getMessaging(app), (payload) => {
        onReceive({
          title: payload.notification?.title ?? "Beedero",
          body: payload.notification?.body ?? "",
          link: payload.fcmOptions?.link || (payload.data?.link as string | undefined) || "/",
        });
      });
    } catch {
      // Push is a progressive enhancement — a failed chunk load or an
      // unsupported browser should never break the page it's mounted on.
    }
  })();

  return () => {
    cancelled = true;
    unsubscribe();
  };
}
