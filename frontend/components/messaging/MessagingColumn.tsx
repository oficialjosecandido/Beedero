"use client";

import { Suspense } from "react";

import { AppColumnSection } from "@/components/AppColumnSection";

import { MessagingInboxWithContext } from "./MessagingInbox";

function MessagingColumnContent() {
  return (
    <div className="hidden lg:block">
      <div className="sticky top-[5.5rem]">
        <AppColumnSection
          label="Mensagens"
          className="flex min-h-[min(720px,calc(100vh-8rem))] flex-col"
          bodyClassName="flex min-h-0 flex-1 flex-col"
        >
          <MessagingInboxWithContext variant="column" embedded />
        </AppColumnSection>
      </div>
    </div>
  );
}

export function MessagingColumn() {
  return (
    <Suspense fallback={null}>
      <MessagingColumnContent />
    </Suspense>
  );
}
