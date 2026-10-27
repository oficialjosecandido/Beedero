"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  applyLinkedInImportAction,
  previewLinkedInImportAction,
} from "@/app/(app)/dashboard/linkedin-import-actions";
import { btnGhost, btnPrimary } from "@/components/app-shell/ui";
import { COUNTRIES } from "@/lib/countries";
import { ArchiveError, keepOnlyWantedFiles } from "@/lib/linkedin-archive";
import {
  countryFromLocation,
  countryName,
  type ImportEntry,
  type LinkedInImportApplyPayload,
  type LinkedInImportPreview,
} from "@/lib/linkedin-import";

const LINKEDIN_DATA_URL = "https://www.linkedin.com/mypreferences/d/download-my-data";

/**
 * "Import from LinkedIn", from the person's own data export (doc
 * beedero-importacao-linkedin.md). Two tones because it lives in two places:
 * the dark `/(app)` profile page and the light `/onboarding` flow.
 */
type Tone = "dark" | "light";

const TONES: Record<
  Tone,
  {
    shell: string;
    eyebrow: string;
    title: string;
    body: string;
    note: string;
    link: string;
    section: string;
    row: (state: "on" | "off" | "disabled") => string;
    rowTitle: string;
    rowMuted: string;
    select: string;
    primary: string;
    ghost: string;
    error: string;
    file: string;
  }
> = {
  dark: {
    shell: "border border-white/10 bg-white/[0.025] p-5 sm:p-6",
    eyebrow: "text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow",
    title: "mt-2 text-xl font-black tracking-[-0.02em]",
    body: "mt-1 text-xs leading-5 text-white/55",
    note: "border-l-2 border-beedero-yellow pl-3 text-xs leading-5 text-white/55",
    link: "font-bold text-beedero-yellow underline underline-offset-2",
    section: "text-[10px] font-black uppercase tracking-[0.14em] text-white/40",
    row: (state) =>
      `flex items-start gap-3 border px-3 py-2.5 text-sm transition ${
        state === "disabled"
          ? "cursor-not-allowed border-white/[0.06] text-white/30"
          : state === "on"
            ? "cursor-pointer border-beedero-yellow/50 bg-beedero-yellow/[0.06]"
            : "cursor-pointer border-white/10 hover:border-white/25"
      }`,
    rowTitle: "block font-bold text-white",
    rowMuted: "block text-xs text-white/50",
    select: "mt-1.5 w-full border border-white/15 bg-app-elevated px-2 py-1.5 text-sm text-white",
    primary: btnPrimary,
    ghost: btnGhost,
    error: "text-sm text-red-300",
    file: "block w-full text-xs text-white/60 file:mr-3 file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-white/15",
  },
  light: {
    shell: "rounded-xl border-2 border-beedero-border bg-beedero-white p-5",
    eyebrow: "text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500",
    title: "mt-1.5 text-lg font-extrabold tracking-tight text-beedero-black",
    body: "mt-1 text-sm leading-6 text-zinc-600",
    note: "text-xs leading-5 text-zinc-500",
    link: "font-semibold text-beedero-black underline underline-offset-2",
    section: "text-sm font-semibold text-beedero-black",
    row: (state) =>
      `flex items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-sm transition ${
        state === "disabled"
          ? "cursor-not-allowed border-beedero-border/60 bg-zinc-50 text-zinc-400"
          : state === "on"
            ? "cursor-pointer border-beedero-black/40 bg-beedero-yellow/10"
            : "cursor-pointer border-beedero-border hover:border-beedero-black/30"
      }`,
    rowTitle: "block font-bold text-beedero-black",
    rowMuted: "block text-xs text-zinc-500",
    select:
      "mt-1.5 w-full rounded-lg border-2 border-beedero-border bg-white px-2 py-1.5 text-sm text-beedero-black",
    primary:
      "rounded-xl bg-beedero-black px-5 py-2.5 text-sm font-bold text-beedero-yellow transition hover:bg-beedero-yellow hover:text-beedero-black disabled:opacity-60",
    ghost:
      "text-sm font-semibold text-zinc-500 underline underline-offset-2 hover:text-beedero-black",
    error: "text-sm font-medium text-danger-strong",
    file: "block w-full text-sm text-zinc-700 file:mr-3 file:rounded-xl file:border-0 file:bg-zinc-100 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-beedero-black hover:file:bg-beedero-yellow/30",
  },
};

type ProfileKey = "full_name" | "headline" | "bio" | "country";

type Review = {
  preview: LinkedInImportPreview;
  country: string | null;
  profile: Record<ProfileKey, boolean>;
  entries: Set<string>;
};

/**
 * LinkedIn splits the export across one file per section, and the fast
 * "Profile" download often carries profile.csv alone. Without this note the
 * review screen just has no Experience on it, which reads like we can't
 * import experience at all. Skills are never imported — add them by hand.
 */
const EXPECTED_FILES = [
  { file: "positions.csv", label: "Experience" },
  { file: "education.csv", label: "Education" },
];

function MissingFilesNote({ tone, filesRead }: { tone: Tone; filesRead: string[] }) {
  const read = new Set(filesRead.map((name) => name.toLowerCase()));
  const missing = EXPECTED_FILES.filter((expected) => !read.has(expected.file));
  if (missing.length === 0) return null;
  return (
    <p className={TONES[tone].note}>
      <b>{missing.map((entry) => entry.label).join(", ")}</b>{" "}
      {missing.length === 1 ? "isn't" : "aren't"} in what you uploaded — it only had{" "}
      {filesRead.join(", ")}. LinkedIn keeps those in <b>Download larger data archive</b>, which it
      emails you separately. Import that archive here when it arrives, or add them by hand below.
    </p>
  );
}

const STATUS_NOTE: Record<Exclude<ImportEntry["status"], "new">, string> = {
  update: "Already on your profile — will refresh role, description and end date",
  already_on_profile: "Already confirmed on your profile — left as is",
  missing_start: "No start date on LinkedIn — add this one by hand",
  invalid_dates: "These dates can't be used here — add this one by hand",
};

function formatMonth(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : "";
}

function formatPeriod(entry: ImportEntry) {
  if (!entry.started_on) return entry.ended_on ? `Until ${formatMonth(entry.ended_on)}` : "No dates";
  return `${formatMonth(entry.started_on)} – ${entry.ended_on ? formatMonth(entry.ended_on) : "Present"}`;
}

function initialReview(preview: LinkedInImportPreview): Review {
  const { profile, entries } = preview;
  const country = countryFromLocation(profile.location.imported);
  return {
    preview,
    country,
    // Fill what's empty by default; replacing something the person wrote is opt-in.
    profile: {
      full_name: Boolean(profile.full_name.imported && !profile.full_name.current),
      headline: Boolean(profile.headline.imported && !profile.headline.current),
      bio: Boolean(profile.bio.imported && !profile.bio.current),
      country: Boolean(country && !profile.location.current_country),
    },
    // New rows and updates of self-declared ones — confirmed org rows stay off.
    entries: new Set(entries.filter((e) => e.status === "new" || e.status === "update").map((e) => e.key)),
  };
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function Row({
  tone,
  checked,
  disabled,
  onChange,
  children,
}: {
  tone: Tone;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <label className={t.row(disabled ? "disabled" : checked ? "on" : "off")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 shrink-0 accent-beedero-yellow"
      />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

function ProfileRow({
  tone,
  label,
  imported,
  current,
  checked,
  onChange,
}: {
  tone: Tone;
  label: string;
  imported: string;
  current: string;
  checked: boolean;
  onChange: () => void;
}) {
  const t = TONES[tone];
  return (
    <Row tone={tone} checked={checked} onChange={onChange}>
      <span className={`${t.rowMuted} font-bold uppercase tracking-wide`}>{label}</span>
      <span className={`${t.rowTitle} mt-0.5 line-clamp-4 whitespace-pre-line break-words font-normal`}>
        {imported}
      </span>
      {current && (
        <span className={`${t.rowMuted} mt-1`}>
          {checked ? "Replaces" : "Keeps"} your current: <i>{current.slice(0, 120)}</i>
        </span>
      )}
    </Row>
  );
}

/**
 * Country is the one imported field the person edits here instead of just
 * accepting. LinkedIn gives a free-text location ("Lisboa e Região,
 * Portugal"), so what we show is a guess off the last comma (see
 * lib/linkedin-import.ts) — and where somebody lives is theirs to say, not
 * LinkedIn's. The tick decides whether it gets saved; the dropdown decides
 * what. Picking a country ticks the row, since picking one means wanting it.
 */
function CountryRow({
  tone,
  value,
  guessedFrom,
  current,
  checked,
  onToggle,
  onPick,
}: {
  tone: Tone;
  value: string;
  guessedFrom: string;
  current: string;
  checked: boolean;
  onToggle: () => void;
  onPick: (code: string) => void;
}) {
  const t = TONES[tone];
  return (
    <div className={t.row(checked ? "on" : "off")}>
      <input
        id="linkedin-country"
        type="checkbox"
        checked={checked}
        disabled={!value}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 shrink-0 accent-beedero-yellow"
      />
      <span className="min-w-0 flex-1">
        <label
          htmlFor="linkedin-country"
          className={`${t.rowMuted} font-bold uppercase tracking-wide`}
        >
          Country
        </label>
        <select
          aria-label="Country"
          value={value}
          onChange={(event) => onPick(event.target.value)}
          className={t.select}
        >
          <option value="">Select a country</option>
          {COUNTRIES.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <span className={`${t.rowMuted} mt-1`}>
          {guessedFrom ? (
            <>
              LinkedIn says <i>{guessedFrom}</i>.{" "}
            </>
          ) : (
            "LinkedIn didn't say where you are. "
          )}
          {current
            ? `${checked ? "Replaces" : "Keeps"} your current: ${countryName(current)}`
            : "Your profile has no country yet."}
        </span>
      </span>
    </div>
  );
}

function EntryList({
  tone,
  title,
  entries,
  selected,
  onToggle,
}: {
  tone: Tone;
  title: string;
  entries: ImportEntry[];
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  if (entries.length === 0) return null;
  const t = TONES[tone];
  return (
    <section className="flex flex-col gap-2">
      <h3 className={t.section}>{title}</h3>
      {entries.map((entry) => {
        const selectable = entry.status === "new" || entry.status === "update";
        return (
          <Row
            key={entry.key}
            tone={tone}
            checked={selected.has(entry.key)}
            disabled={!selectable}
            onChange={() => onToggle(entry.key)}
          >
            <span className={t.rowTitle}>{entry.org_name}</span>
            {entry.role && <span className={t.rowMuted}>{entry.role}</span>}
            <span className={t.rowMuted}>{formatPeriod(entry)}</span>
            {entry.description && (
              <span className={`${t.rowMuted} mt-1 line-clamp-2`}>{entry.description}</span>
            )}
            {entry.status !== "new" && (
              <span className={`${t.rowMuted} mt-1 font-bold`}>
                {STATUS_NOTE[entry.status as keyof typeof STATUS_NOTE]}
              </span>
            )}
            {selectable && entry.beedero_org && entry.status === "new" && (
              <span className={`${t.rowMuted} mt-1`}>
                {entry.beedero_org.name} is on Beedero — after importing, you can ask them to confirm
                this role so it shows as verified.
              </span>
            )}
          </Row>
        );
      })}
    </section>
  );
}

export function LinkedInImport({
  tone = "dark",
  startOpen = false,
  onImported,
}: {
  tone?: Tone;
  startOpen?: boolean;
  /** Runs in the same transition as the refresh — e.g. to move on to the next onboarding step. */
  onImported?: () => void;
}) {
  const t = TONES[tone];
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setOpen(startOpen);
    setReview(null);
    setError(null);
  }

  function readFile(formData: FormData) {
    setError(null);
    startTransition(async () => {
      // The ZIP is opened here, in the browser, and only the four CSVs we
      // read are uploaded — the messages and connections in it never leave
      // this computer. See lib/linkedin-archive.ts.
      const selected = formData
        .getAll("files")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);
      let body: FormData;
      try {
        body = new FormData();
        for (const file of await keepOnlyWantedFiles(selected)) body.append("files", file, file.name);
      } catch (err) {
        setError(
          err instanceof ArchiveError
            ? err.message
            : "We couldn't read that file. Please try again."
        );
        return;
      }

      const response = await previewLinkedInImportAction(body);
      if ("error" in response) {
        setError(response.error);
        return;
      }
      setReview(initialReview(response.preview));
    });
  }

  function apply() {
    if (!review) return;
    const { preview, profile } = review;
    const payload: LinkedInImportApplyPayload = {
      entries: preview.entries
        .filter((e) => review.entries.has(e.key))
        .map(({ kind, org_name, role, description, started_on, ended_on }) => ({
          kind,
          org_name,
          role,
          description,
          started_on,
          ended_on,
        })),
    };
    if (profile.full_name) payload.full_name = preview.profile.full_name.imported;
    if (profile.headline) payload.headline = preview.profile.headline.imported;
    if (profile.bio) payload.bio = preview.profile.bio.imported;
    if (profile.country && review.country) payload.country = review.country;

    startTransition(async () => {
      const response = await applyLinkedInImportAction(payload);
      if ("error" in response) {
        setError(response.error);
        return;
      }
      const { result } = response;
      const parts = [
        result.entries_created &&
          `${result.entries_created} new record${result.entries_created === 1 ? "" : "s"}`,
        result.entries_updated &&
          `${result.entries_updated} updated`,
        result.profile_fields_updated.length && "your profile details",
      ].filter(Boolean);
      toast.success(parts.length ? `Imported ${parts.join(", ")}.` : "Nothing new to import.");
      reset();
      startTransition(() => {
        router.refresh();
        onImported?.();
      });
    });
  }

  if (!open) {
    return (
      <div className={`${t.shell} flex flex-wrap items-center justify-between gap-4`}>
        <div className="min-w-0 flex-1">
          <p className={t.eyebrow}>Import</p>
          <h2 className={t.title}>From LinkedIn</h2>
          <p className={t.body}>
            Bring your experience and education from your own LinkedIn data. You review everything
            before it&apos;s saved. Skills stay manual on your profile.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className={t.primary}>
          Import
        </button>
      </div>
    );
  }

  if (!review) {
    return (
      <div className={`${t.shell} flex flex-col gap-5`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={t.eyebrow}>Import</p>
            <h2 className={t.title}>From LinkedIn</h2>
          </div>
          {!startOpen && (
            <button type="button" onClick={reset} className={t.ghost}>
              Cancel
            </button>
          )}
        </div>

        <ol className={`${t.body} flex list-decimal flex-col gap-2 pl-5`}>
          <li>
            On a computer, open{" "}
            <a href={LINKEDIN_DATA_URL} target="_blank" rel="noopener noreferrer" className={t.link}>
              LinkedIn → Get a copy of your data
            </a>{" "}
            (Settings &amp; Privacy → Data privacy).
          </li>
          <li>
            Choose <b>“Download larger data archive”</b> and request it. That one carries your
            positions and education; LinkedIn emails it separately and it can take a few hours. The
            quick <b>Profile</b> tick-box usually brings only your headline and About.
          </li>
          <li>
            Choose the ZIP below, as it came. Your browser opens it here and uploads only{" "}
            <b>Profile.csv</b>, <b>Positions.csv</b> and <b>Education.csv</b> — picking those three
            unzipped works just as well. Skills are not imported; add them on your profile.
          </li>
        </ol>

        <form action={readFile} className="flex flex-col gap-3">
          <input
            type="file"
            name="files"
            accept=".zip,.csv,application/zip,text/csv"
            multiple
            required
            className={t.file}
          />
          <button type="submit" disabled={isPending} className={`${t.primary} w-fit`}>
            {isPending ? "Reading…" : "Read file"}
          </button>
          {error && (
            <p role="alert" className={t.error}>
              {error}
            </p>
          )}
        </form>

        <p className={t.note}>
          The archive also holds your messages, connections, invitations and skills. Your browser
          opens it on this computer and uploads only the three files above — the rest is never sent,
          so Beedero can&apos;t read it even if it wanted to. What does arrive is read in memory,
          never written to our disks, and discarded the moment we finish with it.
        </p>
      </div>
    );
  }

  const { preview } = review;
  const work = preview.entries.filter((e) => e.kind === "work");
  const education = preview.entries.filter((e) => e.kind === "education");
  const p = preview.profile;
  const showName = Boolean(p.full_name.imported && !p.full_name.current);
  // Shown when there is something to decide: no country on the profile yet, or
  // a guess that disagrees with the one already there.
  const showCountry =
    !p.location.current_country ||
    Boolean(review.country && review.country !== p.location.current_country);
  const selectedCount =
    review.entries.size +
    Object.entries(review.profile).filter(([key, on]) => on && (key !== "country" || showCountry))
      .length;

  const setProfile = (key: ProfileKey) =>
    setReview({ ...review, profile: { ...review.profile, [key]: !review.profile[key] } });

  const pickCountry = (code: string) =>
    setReview({
      ...review,
      country: code || null,
      profile: { ...review.profile, country: Boolean(code) },
    });

  return (
    <div className={`${t.shell} flex flex-col gap-6`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={t.eyebrow}>Import · review</p>
          <h2 className={t.title}>Your LinkedIn data</h2>
          <p className={t.body}>
            Nothing is saved until you confirm. Everything imported is self-declared until an
            organisation confirms it.
          </p>
        </div>
        <button type="button" onClick={reset} className={t.ghost}>
          Cancel
        </button>
      </div>

      <MissingFilesNote tone={tone} filesRead={preview.files_read} />

      {/*
        The upload is already gone by the time this screen renders — it lived
        in memory for one request. Saying so here, where the person can see
        their own data on screen and reasonably wonder where the file went, is
        what makes the promise on the upload screen worth anything.
      */}
      <p className={t.note}>
        Only {preview.files_read.join(", ")} left your computer, and they have already been
        discarded — read in memory, never written to our disks, no copy kept. What you see here came
        from them; only the items you tick get saved.
      </p>

      {(showName || p.headline.imported || p.bio.imported || showCountry) && (
        <section className="flex flex-col gap-2">
          <h3 className={t.section}>Profile</h3>
          {showName && (
            <ProfileRow
              tone={tone}
              label="Name"
              imported={p.full_name.imported}
              current=""
              checked={review.profile.full_name}
              onChange={() => setProfile("full_name")}
            />
          )}
          {p.headline.imported && (
            <ProfileRow
              tone={tone}
              label="Headline"
              imported={p.headline.imported}
              current={p.headline.current}
              checked={review.profile.headline}
              onChange={() => setProfile("headline")}
            />
          )}
          {p.bio.imported && (
            <ProfileRow
              tone={tone}
              label="About"
              imported={p.bio.imported}
              current={p.bio.current}
              checked={review.profile.bio}
              onChange={() => setProfile("bio")}
            />
          )}
          {showCountry && (
            <CountryRow
              tone={tone}
              value={review.country ?? ""}
              guessedFrom={p.location.imported}
              current={p.location.current_country}
              checked={review.profile.country}
              onToggle={() => setProfile("country")}
              onPick={pickCountry}
            />
          )}
        </section>
      )}

      <EntryList
        tone={tone}
        title="Experience"
        entries={work}
        selected={review.entries}
        onToggle={(key) => setReview({ ...review, entries: toggle(review.entries, key) })}
      />
      <EntryList
        tone={tone}
        title="Education"
        entries={education}
        selected={review.entries}
        onToggle={(key) => setReview({ ...review, entries: toggle(review.entries, key) })}
      />

      {error && (
        <p role="alert" className={t.error}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={apply}
          disabled={isPending || selectedCount === 0}
          className={t.primary}
        >
          {isPending ? "Importing…" : `Import ${selectedCount} item${selectedCount === 1 ? "" : "s"}`}
        </button>
        <button type="button" onClick={reset} className={t.ghost}>
          Cancel
        </button>
      </div>
    </div>
  );
}
