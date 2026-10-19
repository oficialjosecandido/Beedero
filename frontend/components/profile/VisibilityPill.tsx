"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Globe2, Lock, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

import {
  setSectionVisibilityAction,
  type VisibilityKey,
  type VisibilityLevel,
} from "@/app/(app)/profile/section-actions";

const OPTIONS: { value: VisibilityLevel; label: string; hint: string; Icon: typeof Globe2 }[] = [
  { value: "public", label: "Public", hint: "Anyone with your link", Icon: Globe2 },
  { value: "connections", label: "Connections", hint: "People you've connected with", Icon: Users },
  {
    value: "verified_investors",
    label: "Verified members",
    hint: "Members whose own profile is verified",
    Icon: ShieldCheck,
  },
  { value: "private", label: "Only me", hint: "Hidden from everyone else", Icon: Lock },
];

/**
 * "Who sees this", on the section it governs. Saves on pick (optimistic,
 * reverted on error) — no form, no Save button, no separate settings block.
 */
export function VisibilityPill({
  section,
  value,
  label,
}: {
  section: VisibilityKey;
  value: string | undefined;
  /** What the pill governs, for screen readers: "About", "Location"… */
  label: string;
}) {
  const [level, setLevel] = useState<VisibilityLevel>(
    (OPTIONS.find((o) => o.value === value)?.value ?? "public") as VisibilityLevel
  );
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.value === level) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: VisibilityLevel) {
    setOpen(false);
    if (next === level) return;
    const previous = level;
    setLevel(next);
    startTransition(async () => {
      const result = await setSectionVisibilityAction(section, next);
      if ("error" in result) {
        setLevel(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: visible to ${current.label}. Change`}
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-11 items-center gap-1.5 border px-2.5 text-[10px] font-black uppercase tracking-[0.1em] transition sm:h-9 ${
          level === "public"
            ? "border-emerald-400/40 text-emerald-400"
            : "border-sky-300/40 text-sky-300"
        }`}
      >
        <current.Icon size={12} aria-hidden />
        {current.label}
        <ChevronDown size={12} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`Who can see ${label}`}
          className="absolute right-0 z-20 mt-1 w-64 border border-white/15 bg-app-elevated p-1 shadow-xl"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === level}
              onClick={() => pick(option.value)}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
            >
              <option.Icon size={14} className="mt-0.5 shrink-0 text-white/55" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-white">{option.label}</span>
                <span className="block text-[11px] text-white/45">{option.hint}</span>
              </span>
              {option.value === level && (
                <Check size={14} className="mt-0.5 text-beedero-yellow" aria-hidden />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
