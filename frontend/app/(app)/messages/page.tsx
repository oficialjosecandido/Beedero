import { AppShellLayout } from "@/components/AppShellLayout";
import { MessagesHub } from "@/components/messaging/MessagesHub";

export const dynamic = "force-dynamic";

export default function MessagesPage() {
  return (
    <AppShellLayout label="Messages" showMessagesInSidebar={false}>
      <MessagesHub />
    </AppShellLayout>
  );
}
