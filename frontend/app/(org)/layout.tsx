import { MessagingShell } from "@/components/MessagingShell";
import { NavigationLoadingProvider } from "@/components/NavigationLoadingProvider";
import { SessionRefresh } from "@/components/SessionRefresh";
import { NotificationsProvider } from "@/lib/notifications-context";
import { noIndexMetadata } from "@/lib/site-metadata";

export const metadata = noIndexMetadata;

/**
 * The organisation workspace is a context switch, not another page of the
 * personal app: it brings its own header and sidebar, so it sits outside
 * `AppShell`. The session and messaging providers still wrap it — the
 * workspace header shows the same message and notification counts.
 *
 * `(org)` and `(app)` are groups under the single root layout, so moving
 * between them is still a client-side navigation.
 */
export default function OrgWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationsProvider>
      <MessagingShell>
        <SessionRefresh />
        <NavigationLoadingProvider>{children}</NavigationLoadingProvider>
      </MessagingShell>
    </NotificationsProvider>
  );
}
