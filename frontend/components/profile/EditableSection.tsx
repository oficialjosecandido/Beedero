"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import type { SectionResult } from "@/app/(app)/profile/section-actions";
import { btnGhost, btnPrimary } from "@/components/app-shell/ui";

import { useProfileEditor } from "./ProfileEditorContext";

function snapshot(form: HTMLFormElement | null): string {
  if (!form) return "";
  return JSON.stringify([...new FormData(form).entries()].map(([k, v]) => [k, String(v)]));
}

/**
 * A profile section that reads like the public profile until you press Edit,
 * then turns into a small form for that section only, with its own Save.
 *
 * - `view` is what visitors see; `fields` are rendered only while editing,
 *   so every open starts from the saved values.
 * - `isEmpty` swaps the view for a one-line prompt that opens the editor.
 * - Focus moves to the first field on open and back to Edit on close.
 */
export function EditableSection({
  id,
  eyebrow,
  title,
  aside,
  view,
  fields,
  isEmpty = false,
  emptyPrompt,
  onSave,
  saveLabel = "Save",
  hideTitle = false,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  /** Keep the heading for screen readers only (the identity card). */
  hideTitle?: boolean;
  /** Header slot, e.g. the visibility pill. */
  aside?: React.ReactNode;
  view: React.ReactNode;
  fields: React.ReactNode;
  isEmpty?: boolean;
  emptyPrompt?: string;
  onSave: (data: FormData) => Promise<SectionResult>;
  saveLabel?: string;
}) {
  const { openId, request, register } = useProfileEditor();
  const editing = openId === id;
  const formRef = useRef<HTMLFormElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const initial = useRef("");
  const wasEditing = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => register(id, () => editing && snapshot(formRef.current) !== initial.current), [
    id,
    editing,
    register,
  ]);

  useEffect(() => {
    if (editing) {
      initial.current = snapshot(formRef.current);
      formRef.current
        ?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select")
        ?.focus();
    } else if (wasEditing.current) {
      editButtonRef.current?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);

  function close() {
    setError(null);
    request(null);
  }

  // Esc cancels, asking first when something was typed.
  function onKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Escape" || pending) return;
    event.preventDefault();
    const dirty = snapshot(formRef.current) !== initial.current;
    if (!dirty || window.confirm("Discard your changes?")) close();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await onSave(data);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.success(`${title} saved.`);
      initial.current = snapshot(formRef.current);
      request(null);
    });
  }

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 border border-white/10 bg-white/[0.025] p-5 sm:p-7"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow">
              {eyebrow}
            </p>
          )}
          <h2
            id={`${id}-title`}
            className={hideTitle ? "sr-only" : "mt-1 text-2xl font-black tracking-[-0.02em]"}
          >
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {aside}
          {!editing && !isEmpty && (
            <button
              ref={editButtonRef}
              type="button"
              onClick={() => request(id)}
              aria-label={`Edit ${title}`}
              className="grid size-9 place-items-center border border-white/10 text-white/55 transition hover:border-beedero-yellow hover:text-beedero-yellow"
            >
              <Pencil size={14} aria-hidden />
            </button>
          )}
        </div>
      </header>

      {editing ? (
        <form ref={formRef} onSubmit={submit} onKeyDown={onKeyDown} className="mt-5 flex flex-col gap-5">
          {fields}
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            <button type="submit" disabled={pending} className={btnPrimary}>
              {pending ? "Saving…" : saveLabel}
            </button>
            <button type="button" onClick={close} disabled={pending} className={btnGhost}>
              Cancel
            </button>
          </div>
        </form>
      ) : isEmpty ? (
        <button
          ref={editButtonRef}
          type="button"
          onClick={() => request(id)}
          className="mt-4 w-full border border-dashed border-white/15 p-5 text-left text-sm text-white/55 transition hover:border-beedero-yellow hover:text-white"
        >
          <span className="font-bold text-beedero-yellow">+ </span>
          {emptyPrompt ?? `Add ${title.toLowerCase()}`}
        </button>
      ) : (
        <div className="mt-4">{view}</div>
      )}
    </section>
  );
}
