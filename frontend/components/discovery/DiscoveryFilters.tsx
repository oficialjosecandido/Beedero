"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Search, X } from "lucide-react";

import { GEO_OPTIONS, SECTOR_OPTIONS, STAGE_OPTIONS } from "@/lib/org-filters";

type Tab = "people" | "organizations";

const KIND_OPTIONS = [
  { value: "people", label: "People" },
  { value: "organizations", label: "Organisations" },
] as const;

const PEOPLE_LOCATION_OPTIONS = [
  { value: "", label: "Anywhere" },
  { value: "lisbon", label: "Lisbon" },
  { value: "porto", label: "Porto" },
  { value: "braga", label: "Braga" },
] as const;

const ORG_LOCATION_OPTIONS = [
  { value: "", label: "Anywhere" },
  ...GEO_OPTIONS.map(({ value, label }) => ({ value, label })),
];

const STAGE_FILTER_OPTIONS = [
  { value: "", label: "All stages" },
  ...STAGE_OPTIONS.map(({ value, label }) => ({ value, label })),
];

const SECTOR_FILTER_OPTIONS = [
  { value: "", label: "All sectors" },
  ...SECTOR_OPTIONS.map(({ value, label }) => ({ value, label })),
];

function FilterDropdown({
  id,
  label,
  value,
  options,
  openId,
  setOpenId,
  onSelect,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  onSelect: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const open = openId === id;
  const selected = options.find((option) => option.value === value)?.label ?? options[0]?.label;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpenId(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenId(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpenId]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpenId(open ? null : id)}
        aria-expanded={open}
        className={`w-full border bg-white/[0.02] px-3 pb-2 pt-1.5 text-left transition ${
          open ? "border-beedero-yellow" : "border-white/15 hover:border-white/30"
        }`}
      >
        <span className="block text-[9px] font-black uppercase tracking-[0.13em] text-white/35">
          {label}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-3 text-sm font-bold text-white">
          <span className="truncate">{selected}</span>
          <span className="text-beedero-yellow" aria-hidden>
            ⌄
          </span>
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto border border-beedero-yellow/60 bg-app-elevated p-1 shadow-2xl">
          {options.map((option) => (
            <button
              key={option.value || "any"}
              type="button"
              onClick={() => {
                setOpenId(null);
                onSelect(option.value);
              }}
              className={`block w-full px-3 py-2.5 text-left text-sm transition ${
                value === option.value
                  ? "bg-beedero-yellow font-black text-beedero-black"
                  : "text-white/70 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Directory filters live in the URL so the server page stays the source of
 * truth. Dropdowns only rewrite query params — same pattern as JobFilters.
 */
export function DiscoveryFilters({
  resultCount,
  hasMore,
}: {
  resultCount: number;
  hasMore: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const tab: Tab = searchParams.get("tab") === "organizations" ? "organizations" : "people";
  const stage = searchParams.get("stage") ?? "";
  const sector = searchParams.get("sector") ?? "";
  const geo = searchParams.get("geo") ?? "";
  const city = searchParams.get("city") ?? "";
  const fundraising = searchParams.get("fundraising") === "true";
  const minCredibility = searchParams.get("min_credibility") ?? "";
  const q = searchParams.get("q") ?? "";

  const locationValue = tab === "people" ? city : geo;
  const kindLabel = tab === "people" ? "people" : "organisations";
  const countLabel = hasMore ? `${resultCount}+` : String(resultCount);

  function push(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.push(query ? `/discovery?${query}` : "/discovery");
  }

  function setTab(nextTab: Tab) {
    const next: Record<string, string> = { tab: nextTab === "people" ? "" : "organizations" };
    // Location meaning differs per tab — clear the other key.
    if (nextTab === "people") next.geo = "";
    else next.city = "";
    push(next);
  }

  return (
    <>
      {/* Uncontrolled and submitted on Enter, like JobFilters: a push per
          keystroke would re-run the server page — and the API call behind it —
          for every character. Keyed on `q` so back/forward re-seeds the box. */}
      <form
        key={q}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          push({ q: String(data.get("q") ?? "").trim() });
        }}
        className="mb-3"
      >
        <label className="flex max-w-2xl items-center gap-3 border border-white/15 bg-white/[0.02] px-4 py-3 text-white/40 focus-within:border-beedero-yellow">
          <Search size={17} strokeWidth={1.8} aria-hidden />
          <input
            name="q"
            defaultValue={q}
            // Each tab matches different columns (backend: orgs/discovery.py),
            // so the placeholder promises only what that tab actually searches.
            placeholder={
              tab === "people"
                ? "Search people by name, handle or headline"
                : "Search organisations by name or one-liner"
            }
            aria-label={tab === "people" ? "Search people" : "Search organisations"}
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />
          {q && (
            <button
              type="button"
              onClick={() => push({ q: "" })}
              aria-label="Clear search"
              className="shrink-0 text-white/40 transition hover:text-white"
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          )}
        </label>
      </form>

      <div className="mb-7 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <FilterDropdown
          id="kind"
          label="Looking for"
          value={tab}
          options={KIND_OPTIONS}
          openId={openId}
          setOpenId={setOpenId}
          onSelect={(value) => setTab(value as Tab)}
        />
        <FilterDropdown
          id="location"
          label="Location"
          value={locationValue}
          options={tab === "people" ? PEOPLE_LOCATION_OPTIONS : ORG_LOCATION_OPTIONS}
          openId={openId}
          setOpenId={setOpenId}
          onSelect={(value) =>
            push(tab === "people" ? { city: value } : { geo: value })
          }
        />
        <FilterDropdown
          id="stage"
          label="Stage"
          value={stage}
          options={STAGE_FILTER_OPTIONS}
          openId={openId}
          setOpenId={setOpenId}
          onSelect={(value) => push({ stage: value })}
        />
        <FilterDropdown
          id="sector"
          label="Sector"
          value={sector}
          options={SECTOR_FILTER_OPTIONS}
          openId={openId}
          setOpenId={setOpenId}
          onSelect={(value) => push({ sector: value })}
        />
        <button
          type="button"
          onClick={() => setMoreOpen((current) => !current)}
          aria-expanded={moreOpen}
          className={`border px-4 py-3 text-sm font-bold transition ${
            moreOpen
              ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
              : "border-white/15 text-white/60 hover:border-white/30 hover:text-white"
          }`}
        >
          + More filters
        </button>
      </div>

      {moreOpen && (
        <div className="mb-6 flex flex-wrap items-center gap-3 border border-white/10 bg-white/[0.02] p-4">
          <p className="mr-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
            More filters
          </p>
          <button
            type="button"
            onClick={() => push({ fundraising: fundraising ? "" : "true" })}
            aria-pressed={fundraising}
            className={`border px-3 py-2 text-xs font-bold transition ${
              fundraising
                ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
                : "border-white/15 text-white/60"
            }`}
          >
            Fundraising {fundraising && "✓"}
          </button>
          {(["", "1", "2", "3", "4"] as const).map((level) => {
            const label = level === "" ? "Any credibility" : `Level ${level}+`;
            const active = minCredibility === level || (level === "" && !minCredibility);
            return (
              <button
                key={level || "any"}
                type="button"
                onClick={() => push({ min_credibility: level })}
                aria-pressed={active}
                className={`border px-3 py-2 text-xs font-bold transition ${
                  active
                    ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
                    : "border-white/15 text-white/60"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <p className="mb-4 text-sm text-white/45" aria-live="polite">
        <b className="text-white/75">{countLabel}</b> {kindLabel} match your search
      </p>
    </>
  );
}
