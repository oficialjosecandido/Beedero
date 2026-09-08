"use client";

import { useEffect, useState } from "react";

import { searchOrgsAction } from "@/app/(app)/dashboard/affiliation-actions";
import type { OrgSummary } from "@/lib/types";

const fieldClass =
  "w-full rounded-xl border border-beedero-border bg-white px-3 py-2.5 text-sm text-beedero-black outline-none transition-colors focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60";

/** Debounced org-name combobox. Selection only happens when a suggestion is
 * explicitly clicked — typing freely never auto-links to an org, so plain
 * off-platform text still falls through to the free-text experience path. */
export function OrgAutocomplete({
  name,
  defaultValue,
  onSelect,
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  onSelect: (org: OrgSummary | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(defaultValue ?? "");
  const [results, setResults] = useState<OrgSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const trimmed = query.trim();
  const showingSelected = selectedName !== null && query === selectedName;

  useEffect(() => {
    if (!trimmed || showingSelected) return;
    const timeout = setTimeout(() => {
      searchOrgsAction(trimmed).then(({ items }) => setResults(items));
    }, 250);
    return () => clearTimeout(timeout);
  }, [trimmed, showingSelected]);

  const visibleResults = trimmed && !showingSelected ? results : [];

  function handleChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (selectedName !== null && value !== selectedName) {
      setSelectedName(null);
      onSelect(null);
    }
  }

  function handlePick(org: OrgSummary) {
    setSelectedName(org.name);
    setQuery(org.name);
    setOpen(false);
    setResults([]);
    onSelect(org);
  }

  return (
    <div className="relative">
      <input
        name={name}
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        required
        className={fieldClass}
      />
      {open && visibleResults.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-beedero-border bg-white shadow-lg">
          {visibleResults.map((org) => (
            <li key={org.slug}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handlePick(org)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-beedero-yellow/15"
              >
                <span className="font-medium text-zinc-900">{org.name}</span>
                {org.one_liner && (
                  <span className="truncate text-xs text-zinc-500">{org.one_liner}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
