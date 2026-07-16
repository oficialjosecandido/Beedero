"use client";

import { Suspense } from "react";

import { MessagingDock } from "@/components/messaging/MessagingDock";
import { MessagingProvider } from "@/lib/messaging-context";

export function MessagingShell({ children }: { children: React.ReactNode }) {
  return (
    <MessagingProvider>
      {children}
      <Suspense fallback={null}>
        <MessagingDock />
      </Suspense>
    </MessagingProvider>
  );
}
