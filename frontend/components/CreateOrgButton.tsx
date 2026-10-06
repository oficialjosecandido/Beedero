"use client";

import { useState } from "react";

import { CreateOrgForm } from "@/components/CreateOrgForm";

export function CreateOrgButton({
  className = "mt-4",
  variant = "default",
  label = "Create organization",
}: {
  className?: string;
  /** `dark` matches the app shell's `/(app)` surfaces; the form itself is light. */
  variant?: "default" | "dark" | "sidebar";
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  const buttonClass =
    variant === "sidebar"
      ? `flex items-center gap-2 px-3 text-xs font-bold text-beedero-yellow transition hover:text-white ${className}`
      : variant === "dark"
        ? `w-full border border-beedero-yellow/55 px-3 py-2.5 text-xs font-bold text-beedero-yellow transition hover:bg-beedero-yellow hover:text-beedero-black ${className}`
        : `w-full rounded-full border border-zinc-500 px-3 py-1.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-900 hover:bg-zinc-50 hover:text-zinc-900 ${className}`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        {label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-beedero-black/60">
                New organization
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-sm font-semibold text-zinc-500 hover:text-beedero-black"
              >
                ✕
              </button>
            </div>
            <CreateOrgForm />
          </div>
        </div>
      )}
    </>
  );
}
