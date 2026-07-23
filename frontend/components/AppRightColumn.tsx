import { RecentOrgUpdatesPanel, type RecentOrgUpdateItem } from "@/components/RecentOrgUpdatesPanel";
import { MessagingColumn } from "@/components/messaging/MessagingColumn";

export function AppRightColumn({
  updates,
  showMessages = true,
}: {
  updates: RecentOrgUpdateItem[];
  showMessages?: boolean;
}) {
  return (
    <div className="hidden lg:block">
      <div className="sticky top-[5.5rem] space-y-2">
        <RecentOrgUpdatesPanel items={updates} />
        {showMessages && <MessagingColumn embedded />}
      </div>
    </div>
  );
}
