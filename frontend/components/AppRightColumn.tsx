"use client";

import { RecentOrgUpdatesPanel, type RecentOrgUpdateItem } from "@/components/RecentOrgUpdatesPanel";
import { MessagingColumn } from "@/components/messaging/MessagingColumn";
import { useMessaging } from "@/lib/messaging-context";

export function AppRightColumn({
  updates,
  showMessages = true,
}: {
  updates: RecentOrgUpdateItem[];
  showMessages?: boolean;
}) {
  // `hidden lg:block` only hides this visually — below lg, MessagingColumn
  // (and its 45s inbox poll) stayed mounted and kept polling in the
  // background. Gating on isDesktop actually unmounts it on small viewports.
  const { isDesktop } = useMessaging();
  if (!isDesktop) return null;

  return (
    <div>
      <div className="sticky top-[5.5rem] space-y-2">
        <RecentOrgUpdatesPanel items={updates} />
        {showMessages && <MessagingColumn embedded />}
      </div>
    </div>
  );
}
