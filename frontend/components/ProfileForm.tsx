"use client";

import { useActionState, useId, useState } from "react";

import { updateProfileAction } from "@/app/(app)/dashboard/actions";
import { COUNTRIES } from "@/lib/countries";
import { formatAtHandle } from "@/lib/handles";
import { GEO_INVESTOR_FOCUS_LABEL, GEO_OPTIONS, SECTOR_OPTIONS, STAGE_OPTIONS } from "@/lib/org-filters";
import { useActionToast } from "@/lib/use-action-toast";

type Visibility = Record<string, string>;
type AttestationPrefs = Record<string, boolean>;
type ProfileLink = { label: string; url: string };

type Profile = {
  full_name?: string;
  headline?: string;
  bio?: string;
  manifesto?: string;
  links?: ProfileLink[];
  skills?: string[];
  country?: string;
  profile_picture?: string | null;
  handle?: string | null;
  visibility?: Visibility;
  attestation_prefs?: AttestationPrefs;
  stage_focus?: string[];
  sector_focus?: string[];
  geo_focus?: string[];
  check_min?: number | null;
  check_max?: number | null;
};

const VISIBILITY_SECTIONS = [
  { key: "bio", label: "Bio", hint: "Your about text, manifesto, and links" },
  { key: "country", label: "Country", hint: "Where you're based" },
  { key: "skills", label: "Skills", hint: "Your skills cloud" },
  { key: "posts", label: "Activity posts", hint: "Updates and milestones" },
  { key: "attestations", label: "Platform facts", hint: "Memberships and stats" },
  { key: "credentials", label: "Credentials", hint: "Your verified professional credentials" },
] as const;

const MANIFESTO_MAX = 600;

function ManifestoInput({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);

  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
      Manifesto <span className="font-normal text-subtle">(optional)</span>
      <textarea
        name="manifesto"
        rows={4}
        maxLength={MANIFESTO_MAX}
        placeholder="What you stand for — your longer-form statement."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={`${fieldClass} min-h-[6rem] resize-y`}
      />
      <span className="self-end text-xs text-subtle">
        {value.length}/{MANIFESTO_MAX}
      </span>
    </label>
  );
}

let linkRowSeq = 0;

function LinksInput({ initial }: { initial: ProfileLink[] }) {
  const [rows, setRows] = useState(() =>
    (initial.length ? initial : [{ label: "", url: "" }]).map((link) => ({
      id: linkRowSeq++,
      label: link.label,
      url: link.url,
    }))
  );

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.id} className="flex gap-2">
          <input
            name="link_label"
            defaultValue={row.label}
            placeholder="Label (e.g. Site)"
            className={`${fieldClass} w-2/5`}
          />
          <input
            name="link_url"
            defaultValue={row.url}
            placeholder="https://..."
            className={fieldClass}
          />
          <button
            type="button"
            onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
            className="shrink-0 rounded-lg border border-beedero-border px-2.5 text-xs font-semibold text-zinc-500 hover:border-beedero-black hover:text-beedero-black"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((current) => [...current, { id: linkRowSeq++, label: "", url: "" }])}
        className="self-start text-xs font-semibold text-beedero-black underline underline-offset-2"
      >
        + Add link
      </button>
    </div>
  );
}

export function SkillsInput({ initial }: { initial: string[] }) {
  const [skills, setSkills] = useState(initial);
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const value = draft.trim();
    setDraft("");
    if (!value) return;
    setSkills((current) => (current.some((s) => s.toLowerCase() === value.toLowerCase()) ? current : [...current, value]));
  }

  return (
    <div className="flex flex-col gap-2">
      {skills.map((skill) => <input key={skill} type="hidden" name="skills" value={skill} />)}
      <div className="flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1.5 rounded-full border border-beedero-border bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
          >
            {skill}
            <button
              type="button"
              onClick={() => setSkills((current) => current.filter((s) => s !== skill))}
              className="text-subtle hover:text-beedero-black"
              aria-label={`Remove ${skill}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commitDraft();
          }
        }}
        onBlur={commitDraft}
        placeholder="Type a skill and press Enter"
        className={fieldClass}
      />
    </div>
  );
}

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "verified_investors", label: "Verified only" },
  { value: "connections", label: "Connections" },
  { value: "private", label: "Private" },
] as const;

const ATTESTATION_OPTIONS = [
  { key: "show_memberships", label: "Organization memberships", hint: "Teams you belong to" },
  { key: "show_posts_count", label: "Post count", hint: "How active you are on Beedero" },
] as const;

const fieldClass =
  "w-full rounded-xl border border-beedero-border bg-white px-3 py-2.5 text-sm text-beedero-black outline-none transition-colors focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60";

function headlineIsInvestor(headline: string) {
  return headline.toLowerCase().includes("investor");
}

function ProfileAvatar({
  name,
  profilePicture,
  preview,
}: {
  name: string;
  profilePicture?: string | null;
  preview?: string | null;
}) {
  const src = preview ?? profilePicture;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="size-20 rounded-full border-2 border-beedero-border object-cover shadow-sm" />
    );
  }
  return (
    <span className="flex size-20 shrink-0 items-center justify-center rounded-full border-2 border-beedero-border bg-gradient-to-br from-beedero-yellow/30 to-zinc-100 text-2xl font-bold text-zinc-600">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function ProfileForm({
  profile,
  variant = "settings",
}: {
  profile?: Profile | null;
  variant?: "settings" | "onboarding";
}) {
  const [error, formAction, pending] = useActionState(updateProfileAction, null);
  useActionToast(error, pending, { successMessage: "Profile updated." });

  const fileInputId = useId();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [headline, setHeadline] = useState(profile?.headline ?? "");

  const visibility = profile?.visibility ?? {};
  const attestationPrefs = profile?.attestation_prefs ?? {};
  const displayName = profile?.full_name || "Your profile";
  const nameLocked = Boolean(profile?.full_name);
  const showInvestmentThesis = variant === "onboarding" && headlineIsInvestor(headline);

  function onPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoPreview(null);
      setPhotoName(null);
      return;
    }
    setPhotoName(file.name);
    setPhotoPreview(URL.createObjectURL(file));
  }

  return (
    <form action={formAction} className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      <div className="border-b border-beedero-border bg-beedero-yellow px-5 py-5 sm:px-8">
        <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">
          {variant === "onboarding" ? "Complete your profile" : "Profile settings"}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
          {variant === "onboarding"
            ? "Add enough context so Beedero can recommend people and organizations to follow."
            : "Update how you appear on Beedero, then choose what stays public."}
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-5 py-8 sm:px-8">
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <ProfileAvatar
              name={displayName}
              profilePicture={profile?.profile_picture}
              preview={photoPreview}
            />
            <div className="min-w-0 flex-1">
              {nameLocked ? (
                <>
                  <p className="text-lg font-extrabold text-zinc-900">{profile?.full_name}</p>
                  {profile?.handle && (
                    <p className="mt-0.5 text-sm font-semibold text-zinc-600">
                      {formatAtHandle(profile.handle)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-subtle">
                    Your public ID is assigned from your name and cannot be changed.
                  </p>
                </>
              ) : (
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                  Full name
                  <input name="full_name" required placeholder="Your full name" className={fieldClass} />
                </label>
              )}
              <div className="mt-3">
                <input
                  id={fileInputId}
                  type="file"
                  name="profile_picture"
                  accept="image/*"
                  className="sr-only"
                  onChange={onPhotoChange}
                />
                <label
                  htmlFor={fileInputId}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm font-semibold text-beedero-black transition-colors hover:border-beedero-black hover:bg-beedero-yellow/15"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden>
                    <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
                  </svg>
                  {photoName ? "Change photo" : "Upload photo"}
                </label>
                {photoName && <p className="mt-1.5 truncate text-xs text-zinc-500">{photoName}</p>}
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Headline
            <input
              name="headline"
              required
              placeholder="Investor, founder, operator..."
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Country
            <select name="country" required defaultValue={profile?.country ?? ""} className={fieldClass}>
              <option value="" disabled>
                Select a country
              </option>
              {COUNTRIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Bio <span className="font-normal text-subtle">(optional)</span>
            <textarea
              name="bio"
              rows={4}
              placeholder="A short intro — what you do and what you're looking for."
              defaultValue={profile?.bio ?? ""}
              className={`${fieldClass} min-h-[7rem] resize-y`}
            />
          </label>
          <ManifestoInput initial={profile?.manifesto ?? ""} />
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-zinc-700">
              Links <span className="font-normal text-subtle">(optional)</span>
            </p>
            <LinksInput initial={profile?.links ?? []} />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-zinc-700">
              Skills <span className="font-normal text-subtle">(optional)</span>
            </p>
            <SkillsInput initial={profile?.skills ?? []} />
          </div>
        </section>

        {showInvestmentThesis && (
          <section className="flex flex-col gap-4 border-t border-beedero-border/70 pt-10">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-zinc-500">
                Investment thesis
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Complete your thesis to get better weekly matches and alerts.
              </p>
            </div>
            <fieldset className="rounded-2xl border border-beedero-border p-4">
              <legend className="px-1 text-sm font-semibold text-zinc-800">Stage focus</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {STAGE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="inline-flex items-center gap-2 rounded-lg border border-beedero-border px-2.5 py-1.5 text-xs font-medium"
                  >
                    <input
                      type="checkbox"
                      name="stage_focus"
                      value={option.value}
                      defaultChecked={profile?.stage_focus?.includes(option.value)}
                      className="accent-beedero-black"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="rounded-2xl border border-beedero-border p-4">
              <legend className="px-1 text-sm font-semibold text-zinc-800">Sector focus</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SECTOR_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="inline-flex items-center gap-2 rounded-lg border border-beedero-border px-2.5 py-1.5 text-xs font-medium"
                  >
                    <input
                      type="checkbox"
                      name="sector_focus"
                      value={option.value}
                      defaultChecked={profile?.sector_focus?.includes(option.value)}
                      className="accent-beedero-black"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="rounded-2xl border border-beedero-border p-4">
              <legend className="px-1 text-sm font-semibold text-zinc-800">{GEO_INVESTOR_FOCUS_LABEL}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {GEO_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="inline-flex items-center gap-2 rounded-lg border border-beedero-border px-2.5 py-1.5 text-xs font-medium"
                  >
                    <input
                      type="checkbox"
                      name="geo_focus"
                      value={option.value}
                      defaultChecked={profile?.geo_focus?.includes(option.value)}
                      className="accent-beedero-black"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Min check (USD)
                <input
                  name="check_min"
                  type="number"
                  min={0}
                  placeholder="e.g. 25000"
                  defaultValue={profile?.check_min ?? ""}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Max check (USD)
                <input
                  name="check_max"
                  type="number"
                  min={0}
                  placeholder="e.g. 500000"
                  defaultValue={profile?.check_max ?? ""}
                  className={fieldClass}
                />
              </label>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-4 border-t border-beedero-border/70 pt-10">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-zinc-500">
              Who can see what
            </h3>
            <p className="mt-1 text-sm text-zinc-500">Control visibility for each part of your profile.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-beedero-border divide-y divide-beedero-border/70">
            {VISIBILITY_SECTIONS.map(({ key, label, hint }) => (
              <label
                key={key}
                className="flex flex-col gap-2 bg-zinc-50/30 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-800">{label}</span>
                  <span className="block text-xs text-subtle">{hint}</span>
                </span>
                <select
                  name={`visibility_${key}`}
                  defaultValue={visibility[key] ?? "public"}
                  className="w-full shrink-0 rounded-lg border border-beedero-border bg-white px-2.5 py-2 text-sm font-medium text-zinc-800 outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60 sm:w-40"
                >
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-beedero-border/70 pt-10">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-zinc-500">
              Show on your profile
            </h3>
            <p className="mt-1 text-sm text-zinc-500">Facts Beedero can display from your activity.</p>
          </div>
          <div className="flex flex-col gap-2">
            {ATTESTATION_OPTIONS.map(({ key, label, hint }) => (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-beedero-border px-4 py-3.5 transition-colors has-[:checked]:border-beedero-black/25 has-[:checked]:bg-beedero-yellow/10"
              >
                <input
                  type="checkbox"
                  name={key}
                  defaultChecked={attestationPrefs[key] !== false}
                  className="mt-0.5 size-4 shrink-0 rounded border-beedero-border accent-beedero-black"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-800">{label}</span>
                  <span className="block text-xs text-subtle">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="border-t border-beedero-border bg-zinc-50/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex w-full max-w-2xl">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-beedero-yellow px-5 py-3 text-sm font-bold text-beedero-black shadow-sm transition-colors hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50 sm:w-auto sm:min-w-[10rem]"
          >
            {pending ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>
    </form>
  );
}
