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
