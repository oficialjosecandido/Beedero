import { MessagingShell } from "@/components/MessagingShell";
import { NavigationLoadingProvider } from "@/components/NavigationLoadingProvider";
import { SessionRefresh } from "@/components/SessionRefresh";
import { AppShell } from "@/components/app-shell/AppShell";
import { WelcomeNudge } from "@/components/onboarding/WelcomeNudge";
import { NetworkProvider } from "@/lib/network-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { noIndexMetadata } from "@/lib/site-metadata";

export const metadata = noIndexMetadata;

/**
 * No server awaits here on purpose: Enter from the marketing site must paint
 * the shell immediately. Orgs load client-side in AppShell / ProfileSwitcher.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationsProvider>
      <NetworkProvider>
        <MessagingShell>
          <SessionRefresh />
          <NavigationLoadingProvider>
            <AppShell>
              {/* §6.4's nudge. Here rather than on each landing page because
                  three of the five first screens are inside this shell, and a
                  layout can't read search params itself — the component does
                  (components/onboarding/WelcomeNudge.tsx). */}
              <WelcomeNudge />
              {children}
            </AppShell>
          </NavigationLoadingProvider>
        </MessagingShell>
      </NetworkProvider>
    </NotificationsProvider>
  );
}
