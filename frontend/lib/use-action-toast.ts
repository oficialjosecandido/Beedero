"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

type Options = {
  /** Shown when the action succeeds but returns no message (state stays null). */
  successMessage?: string;
  /** For actions whose success case also returns a string — tells success from error. */
  isSuccess?: (message: string) => boolean;
  /** Called once when the action completes successfully. */
  onSuccess?: () => void;
};

/** Fires a toast once a useActionState submission completes (pending: true -> false). */
export function useActionToast(state: string | null, pending: boolean, options: Options = {}) {
  const optionsRef = useRef(options);
  const prevPending = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const justFinished = mounted.current && prevPending.current && !pending;
    mounted.current = true;
    prevPending.current = pending;
    if (!justFinished) return;

    const { successMessage, isSuccess, onSuccess } = optionsRef.current;
    if (state === null) {
      if (successMessage) toast.success(successMessage);
      onSuccess?.();
    } else if (isSuccess?.(state)) {
      toast.success(successMessage ?? state);
      onSuccess?.();
    } else {
      toast.error(state);
    }
  }, [pending, state]);
}
