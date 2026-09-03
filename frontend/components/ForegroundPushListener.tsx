"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { listenForForegroundPush } from "@/lib/push";

export function ForegroundPushListener() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = listenForForegroundPush((push) => {
      toast(push.title, {
        description: push.body || undefined,
        action: {
          label: "View",
          onClick: () => router.push(push.link),
        },
      });
    });
    return unsubscribe;
  }, [router]);

  return null;
}
