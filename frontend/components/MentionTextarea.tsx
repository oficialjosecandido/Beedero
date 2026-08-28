"use client";

import { useEffect, useRef, useState } from "react";

type MentionOption = {
  type: "user" | "org";
  name: string;
  avatar?: string | null;
  handle?: string;
  slug?: string;
};

type MentionSearchResponse = {
  users?: { handle: string; name: string; avatar?: string | null }[];
  orgs?: { slug: string; name: string; avatar?: string | null }[];
};

const TRIGGER_RE = /(?:^|\s)@([a-zA-Z0-9_-]{0,40})$/;

/** Plain <textarea> that inserts `@[user:handle]`/`@[org:slug]` markers on
 * selection from a `@`-triggered autocomplete dropdown (spec §B). The
 * textarea's own value — markers and all — is what gets submitted; RichText
 * resolves markers to clickable names at render time. */
export function MentionTextarea({
  name,
  defaultValue = "",
  placeholder,
  rows = 3,
  maxLength,
  required,
  autoFocus,
  className,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState<string | null>(null);
  const [options, setOptions] = useState<MentionOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerStartRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Stale `options` from a previous query are harmless here — the dropdown
    // is only rendered while `query !== null`, so nothing shows them.
    if (query === null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/mentions/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((res) => (res.ok ? (res.json() as Promise<MentionSearchResponse>) : null))
        .then((data) => {
          if (!data) return;
          const merged: MentionOption[] = [
            ...(data.users ?? []).map((u) => ({
              type: "user" as const,
              name: u.name,
              avatar: u.avatar,
              handle: u.handle,
            })),
            ...(data.orgs ?? []).map((o) => ({
              type: "org" as const,
              name: o.name,
              avatar: o.avatar,
              slug: o.slug,
            })),
          ];
          setOptions(merged);
          setActiveIndex(0);
        })
        .catch(() => {});
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  function updateTriggerFromCaret(text: string, caret: number) {
    const match = TRIGGER_RE.exec(text.slice(0, caret));
    if (match) {
      triggerStartRef.current = caret - match[1].length - 1;
      setQuery(match[1]);
    } else {
      triggerStartRef.current = null;
      setQuery(null);
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    setValue(next);
    updateTriggerFromCaret(next, event.target.selectionStart ?? next.length);
  }

  function handleKeyUp(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      updateTriggerFromCaret(value, event.currentTarget.selectionStart ?? value.length);
    }
  }

  function selectOption(option: MentionOption) {
    const triggerStart = triggerStartRef.current;
    const textarea = textareaRef.current;
    if (triggerStart === null || !textarea) return;
    const marker = option.type === "user" ? `@[user:${option.handle}]` : `@[org:${option.slug}]`;
    const caret = textarea.selectionStart ?? value.length;
    const next = `${value.slice(0, triggerStart)}${marker} ${value.slice(caret)}`;
    setValue(next);
    setQuery(null);
    triggerStartRef.current = null;
    const cursor = triggerStart + marker.length + 1;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (query === null || options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + options.length) % options.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      selectOption(options[activeIndex]);
    } else if (event.key === "Escape") {
      setQuery(null);
    }
  }

  return (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        name={name}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={() => setQuery(null)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        required={required}
        autoFocus={autoFocus}
        className={className}
      />
      {query !== null && options.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full max-w-xs overflow-y-auto rounded-xl border border-beedero-border bg-beedero-white py-1 shadow-lg">
          {options.map((option, index) => (
            <li key={`${option.type}-${option.handle ?? option.slug}`}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(option);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-beedero-yellow/20" : "hover:bg-zinc-50"
                }`}
              >
                <span className="truncate font-medium text-beedero-black">{option.name}</span>
                <span className="shrink-0 text-xs text-subtle">
                  @{option.type === "org" ? option.slug : option.handle}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
