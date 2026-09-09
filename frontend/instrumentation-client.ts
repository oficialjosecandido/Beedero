import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Session Replay is the heaviest part of the browser SDK and it instruments
// the DOM as it loads, so bundling it here taxes first paint and TBT on every
// page. It's a debugging aid sampled at 10% — nothing renders because of it —
// so it's fetched from Sentry's CDN once the page has gone idle instead.
// Sample rates above still apply; the integration reads them from init.
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const loadReplay = () => {
    Sentry.lazyLoadIntegration("replayIntegration")
      .then((replayIntegration) => {
        Sentry.addIntegration(replayIntegration());
      })
      .catch(() => {
        // Blocked by an ad blocker or offline — replay is optional telemetry,
        // never a reason to surface an error to the user.
      });
  };

  const schedule = () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(loadReplay, { timeout: 5000 });
    } else {
      window.setTimeout(loadReplay, 2000);
    }
  };

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
