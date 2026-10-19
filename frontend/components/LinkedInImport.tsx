"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  applyLinkedInImportAction,
  previewLinkedInImportAction,
} from "@/app/(app)/dashboard/linkedin-import-actions";
import { btnGhost, btnPrimary } from "@/components/app-shell/ui";
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
    chip: (on: boolean) => string;
    primary: string;
    ghost: string;
    error: string;
    file: string;
  }
> = {
  dark: {
    shell: "border border-white/10 bg-white/[0.025] p-5 sm:p-6",
    eyebrow: "text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow",
    title: "mt-2 text-xl font-black tracking-[-0.03em]",
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
    chip: (on) =>
      `border px-2.5 py-1 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${
        on
          ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
          : "border-white/15 text-white/60 hover:border-white/30 hover:text-white"
      }`,
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
    chip: (on) =>
      `rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        on
          ? "border-beedero-black bg-beedero-black text-beedero-yellow"
          : "border-beedero-border bg-white text-zinc-700 hover:border-beedero-black"
      }`,
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
  skills: Set<string>;
};

/**
 * LinkedIn splits the export across one file per section, and the fast
 * "Profile" download often carries profile.csv alone. Without this note the
 * review screen just has no Experience on it, which reads like we can't
 * import experience at all.
 */
const EXPECTED_FILES = [
  { file: "positions.csv", label: "Experience" },
  { file: "education.csv", label: "Education" },
  { file: "skills.csv", label: "Skills" },
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
  already_on_profile: "Already on your profile",
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
  const { profile, skills, entries } = preview;
  const country = countryFromLocation(profile.location.imported);
  const room = Math.max(0, skills.max - skills.current.length);
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
    entries: new Set(entries.filter((e) => e.status === "new").map((e) => e.key)),
    skills: new Set(skills.imported.slice(0, room)),
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
        const blocked = entry.status !== "new";
        return (
          <Row
            key={entry.key}
            tone={tone}
            checked={selected.has(entry.key)}
            disabled={blocked}
            onChange={() => onToggle(entry.key)}
          >
            <span className={t.rowTitle}>{entry.org_name}</span>
            {entry.role && <span className={t.rowMuted}>{entry.role}</span>}
            <span className={t.rowMuted}>{formatPeriod(entry)}</span>
            {blocked && (
              <span className={`${t.rowMuted} mt-1 font-bold`}>
                {STATUS_NOTE[entry.status as keyof typeof STATUS_NOTE]}
              </span>
            )}
            {!blocked && entry.beedero_org && (
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
      const response = await previewLinkedInImportAction(formData);
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
        .map(({ kind, org_name, role, started_on, ended_on }) => ({
          kind,
          org_name,
          role,
          started_on,
          ended_on,
        })),
      skills: preview.skills.imported.filter((s) => review.skills.has(s)),
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
          `${result.entries_created} record${result.entries_created === 1 ? "" : "s"}`,
        result.skills_added && `${result.skills_added} skill${result.skills_added === 1 ? "" : "s"}`,
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
            Bring your experience, education and skills from your own LinkedIn data. You review
            everything before it&apos;s saved.
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
            positions, education and skills; LinkedIn emails it separately and it can take a few
            hours. The quick <b>Profile</b> tick-box usually brings only your headline and About.
          </li>
          <li>
            Unzip it and choose <b>Profile.csv</b>, <b>Positions.csv</b>, <b>Education.csv</b> and{" "}
            <b>Skills.csv</b> below — those four are all we read. A small ZIP works too.
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
          We only read your profile, positions, education and skills — your connections and messages
          are never opened. The file is read in memory, never written to our disks, and discarded the
          moment we finish reading it. We keep no copy.
        </p>
      </div>
    );
  }

  const { preview } = review;
  const work = preview.entries.filter((e) => e.kind === "work");
  const education = preview.entries.filter((e) => e.kind === "education");
  const room = Math.max(0, preview.skills.max - preview.skills.current.length);
  const p = preview.profile;
  const showName = Boolean(p.full_name.imported && !p.full_name.current);
  const showCountry = Boolean(review.country && review.country !== p.location.current_country);
  const selectedCount =
    review.entries.size +
    review.skills.size +
    Object.entries(review.profile).filter(([key, on]) => on && (key !== "country" || showCountry)).length;

  const setProfile = (key: ProfileKey) =>
    setReview({ ...review, profile: { ...review.profile, [key]: !review.profile[key] } });

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
        Your file has already been discarded — it was read in memory, never written to our disks, and
        no copy was kept. What you see here came from it; only the items you tick get saved.
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
          {showCountry && review.country && (
            <ProfileRow
              tone={tone}
              label="Country"
              imported={countryName(review.country)}
              current={p.location.current_country ? countryName(p.location.current_country) : ""}
              checked={review.profile.country}
              onChange={() => setProfile("country")}
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

      {preview.skills.imported.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className={t.section}>Skills</h3>
            <span className={t.rowMuted}>
              {review.skills.size} of {room} free slot{room === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {preview.skills.imported.map((skill) => {
              const on = review.skills.has(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && review.skills.size >= room}
                  onClick={() => setReview({ ...review, skills: toggle(review.skills, skill) })}
                  className={t.chip(on)}
                >
                  {skill}
                </button>
              );
            })}
          </div>
          {room === 0 && (
            <p className={t.rowMuted}>Your profile already has the maximum of {preview.skills.max} skills.</p>
          )}
        </section>
      )}

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
