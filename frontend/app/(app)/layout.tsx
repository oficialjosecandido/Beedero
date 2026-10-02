import { MessagingShell } from "@/components/MessagingShell";
import { NavigationLoadingProvider } from "@/components/NavigationLoadingProvider";
import { SessionRefresh } from "@/components/SessionRefresh";
import { AppShell } from "@/components/app-shell/AppShell";
import { apiFetch, safeFetch } from "@/lib/api";
import type { CofounderStatus } from "@/lib/cofounder-options";
import { NetworkProvider } from "@/lib/network-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { noIndexMetadata } from "@/lib/site-metadata";

export const metadata = noIndexMetadata;

type Membership = { slug: string; name: string; logo?: string | null };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [cofounderStatus, orgs] = await Promise.all([
    safeFetch(apiFetch<CofounderStatus>("/cofounder/status/"), null),
    safeFetch(apiFetch<Membership[]>("/orgs/"), [] as Membership[]),
  ]);
  const showCofounder = Boolean(cofounderStatus?.show_entry_point);

  return (
    <NotificationsProvider>
      <NetworkProvider>
        <MessagingShell>
          <SessionRefresh />
          <NavigationLoadingProvider>
            <AppShell showCofounder={showCofounder} orgs={orgs}>
              {children}
            </AppShell>
          </NavigationLoadingProvider>
        </MessagingShell>
      </NetworkProvider>
    </NotificationsProvider>
  );
}
