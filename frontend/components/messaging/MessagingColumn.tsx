"use client";

import { Suspense } from "react";

import { AppColumnHeader } from "@/components/AppColumnHeader";

import { MessagingInbox } from "./MessagingInbox";

function MessagingColumnContent() {
  return (
    <div className="hidden flex-col gap-6 lg:flex">
      <AppColumnHeader label="Mensagens" />
      <div className="sticky top-[5.5rem]">
        <MessagingInbox variant="column" />
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
