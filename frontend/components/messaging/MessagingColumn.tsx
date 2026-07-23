"use client";

import { Suspense } from "react";

import { AppColumnSection } from "@/components/AppColumnSection";

import { MessagingInboxWithContext } from "./MessagingInbox";

function MessagingColumnContent({ embedded = false }: { embedded?: boolean }) {
  const section = (
    <AppColumnSection
      label="Messages"
      className="flex min-h-[min(720px,calc(100vh-8rem))] flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      <MessagingInboxWithContext variant="column" embedded />
    </AppColumnSection>
  );

  if (embedded) return section;

  return (
    <div className="hidden lg:block">
      <div className="sticky top-[5.5rem]">{section}</div>
    </div>
  );
}

export function MessagingColumn({ embedded = false }: { embedded?: boolean }) {
  return (
    <Suspense fallback={null}>
      <MessagingColumnContent embedded={embedded} />
    </Suspense>
  );
}
