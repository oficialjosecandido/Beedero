import { AppShellLayout } from "@/components/AppShellLayout";
import { NotificationsPanel } from "@/components/NotificationsPanel";

export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  return (
    <AppShellLayout label="Notifications" showMessagesInSidebar={false}>
      <NotificationsPanel />
    </AppShellLayout>
  );
}
