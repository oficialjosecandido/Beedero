"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

type Options = {
  /** Shown when the action succeeds but returns no message (state stays null). */
  successMessage?: string;
  /** For actions whose success case also returns a string — tells success from error. */
  isSuccess?: (message: string) => boolean;
};

/** Fires a toast once a useActionState submission completes (pending: true -> false). */
export function useActionToast(state: string | null, pending: boolean, options: Options = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const prevPending = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    const justFinished = mounted.current && prevPending.current && !pending;
    mounted.current = true;
    prevPending.current = pending;
    if (!justFinished) return;

    const { successMessage, isSuccess } = optionsRef.current;
    if (state === null) {
      if (successMessage) toast.success(successMessage);
    } else if (isSuccess?.(state)) {
      toast.success(successMessage ?? state);
    } else {
      toast.error(state);
    }
  }, [pending, state]);
}
