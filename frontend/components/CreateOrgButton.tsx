"use client";

import { useState } from "react";

import { CreateOrgForm } from "@/components/CreateOrgForm";

export function CreateOrgButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-xl bg-beedero-yellow px-3 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
      >
        Create organization
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
