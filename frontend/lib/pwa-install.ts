export type InstallPlatform = "ios" | "android" | "other";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "beedero-pwa-install-dismissed";
const DISMISS_DAYS = 30;

export function isMobileUa(ua: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

export function detectPlatform(ua: string): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export function isStandaloneDisplay(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

/** Subscribe form of the above, for useSyncExternalStore.
 *
 * Whether we're inside the installed app can only be known in the browser, so
 * components used to read it in an effect and setState — which costs a second
 * render pass and trips react-hooks/set-state-in-effect. Reading it through a
 * store instead lets the server snapshot be `null` ("don't know yet"), which is
 * the loading state these components already wanted. */
export function subscribeToDisplayMode(onChange: () => void): () => void {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** The server/hydration snapshot: nothing about `window` is knowable yet. */
export const unknownDisplayMode = (): boolean | null => null;

export function wasInstallPromptRecentlyDismissed(): boolean {
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_DAYS;
}

export function markInstallPromptDismissed(): void {
  window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
}
