"use client";

import { useActionState, useId, useState } from "react";

import { updateProfileAction } from "@/app/(app)/dashboard/actions";
import { btnPrimary, inputDark, labelDark } from "@/components/app-shell/ui";
import { COUNTRIES } from "@/lib/countries";
import { formatAtHandle } from "@/lib/handles";
import { GEO_INVESTOR_FOCUS_LABEL, GEO_OPTIONS, SECTOR_OPTIONS, STAGE_OPTIONS } from "@/lib/org-filters";
import { VISIBILITY_OPTIONS, VISIBILITY_SECTIONS } from "@/lib/profile-visibility";
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
  city?: string;
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

const MANIFESTO_MAX = 600;

function ManifestoInput({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);

  return (
    <label className={labelDark}>
      Manifesto <span className="normal-case tracking-normal text-white/25">(optional)</span>
      <textarea
        name="manifesto"
        rows={4}
        maxLength={MANIFESTO_MAX}
        placeholder="What you stand for — your longer-form statement."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={`mt-2 ${inputDark} min-h-[6rem] resize-y placeholder:text-white/35`}
      />
      <span className="mt-1 block self-end text-right text-[10px] text-white/35">
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
            className={`${inputDark} w-2/5 placeholder:text-white/35`}
          />
          <input
            name="link_url"
            defaultValue={row.url}
            placeholder="https://..."
            className={`${inputDark} placeholder:text-white/35`}
          />
          <button
            type="button"
            onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
            className="shrink-0 border border-white/15 px-2.5 text-xs font-semibold text-white/45 hover:border-beedero-yellow hover:text-beedero-yellow"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((current) => [...current, { id: linkRowSeq++, label: "", url: "" }])}
        className="self-start text-xs font-bold text-beedero-yellow hover:underline"
      >
        + Add link
      </button>
    </div>
  );
}

export function SkillsInput({ initial, dark = true }: { initial: string[]; dark?: boolean }) {
  const [skills, setSkills] = useState(initial);
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const value = draft.trim();
    setDraft("");
    if (!value) return;
    setSkills((current) =>
      current.some((s) => s.toLowerCase() === value.toLowerCase()) ? current : [...current, value]
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {skills.map((skill) => (
        <input key={skill} type="hidden" name="skills" value={skill} />
      ))}
      <div className="flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <span
            key={skill}
            className={
              dark
                ? "inline-flex items-center gap-1.5 border border-white/15 px-2.5 py-1 text-xs font-medium text-white/60"
                : "inline-flex items-center gap-1.5 rounded-full border border-beedero-border bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
            }
          >
            {skill}
            <button
              type="button"
              onClick={() => setSkills((current) => current.filter((s) => s !== skill))}
              className={dark ? "text-white/40 hover:text-white" : "text-subtle hover:text-beedero-black"}
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
        className={dark ? `${inputDark} placeholder:text-white/35` : "w-full rounded-xl border border-beedero-border bg-white px-3 py-2.5 text-sm text-beedero-black outline-none"}
      />
    </div>
  );
}

const ATTESTATION_OPTIONS = [
  { key: "show_memberships", label: "Organization memberships", hint: "Teams you belong to" },
  { key: "show_posts_count", label: "Post count", hint: "How active you are on Beedero" },
] as const;

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
      <img src={src} alt="" className="size-20 rounded-full object-cover" />
    );
  }
  return (
    <span className="grid size-20 shrink-0 place-items-center rounded-full bg-[#68738a] text-2xl font-black text-white">
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
    <form action={formAction} className="border border-white/10 bg-white/[0.025]">
      <div className="border-b border-white/10 px-5 py-5 sm:px-7">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow">
          {variant === "onboarding" ? "Get started" : "Identity"}
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.045em]">
          {variant === "onboarding" ? "Complete your profile." : "Profile settings."}
        </h2>
        <p className="mt-2 max-w-xl text-xs leading-5 text-white/45">
          {variant === "onboarding"
            ? "Add enough context so Beedero can recommend people and organisations to follow."
            : "Update how you appear on Beedero, then choose what stays public."}
        </p>
      </div>

      <div className="flex flex-col gap-8 px-5 py-6 sm:px-7">
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
                  <input type="hidden" name="name_locked" value="1" />
                  <p className="text-lg font-black tracking-[-0.03em]">{profile?.full_name}</p>
                  {profile?.handle && (
                    <p className="mt-0.5 text-sm font-semibold text-white/55">
                      {formatAtHandle(profile.handle)}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-white/35">
                    Your public ID is assigned from your name and cannot be changed.
                  </p>
                </>
              ) : (
                <label className={labelDark}>
                  Full name
                  <input
                    name="full_name"
                    required
                    placeholder="Your full name"
                    defaultValue={profile?.full_name ?? ""}
                    className={`mt-2 ${inputDark} placeholder:text-white/35`}
                  />
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
                  className="inline-flex cursor-pointer items-center gap-2 border border-white/15 px-3 py-2 text-xs font-bold text-white/70 transition hover:border-beedero-yellow hover:text-beedero-yellow"
                >
                  {photoName ? "Change photo" : "Upload photo"}
                </label>
                {photoName && <p className="mt-1.5 truncate text-[10px] text-white/40">{photoName}</p>}
              </div>
            </div>
          </div>

          <label className={labelDark}>
            Headline
            <input
              name="headline"
              required
              placeholder="Investor, founder, operator..."
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              className={`mt-2 ${inputDark} placeholder:text-white/35`}
            />
          </label>
          <label className={labelDark}>
            Country
            <select
              name="country"
              required
              defaultValue={profile?.country ?? ""}
              className={`mt-2 ${inputDark}`}
            >
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
          <label className={labelDark}>
            City <span className="normal-case tracking-normal text-white/25">(optional)</span>
            <input
              name="city"
              maxLength={80}
              placeholder="Lisbon"
              defaultValue={profile?.city ?? ""}
              className={`mt-2 ${inputDark} placeholder:text-white/35`}
            />
            <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-white/35">
              Free text, and yours to set — we never guess it from your connection.
            </span>
          </label>
          <label className={labelDark}>
            Bio <span className="normal-case tracking-normal text-white/25">(optional)</span>
            <textarea
              name="bio"
              rows={4}
              placeholder="A short intro — what you do and what you're looking for."
              defaultValue={profile?.bio ?? ""}
              className={`mt-2 ${inputDark} min-h-[7rem] resize-y placeholder:text-white/35`}
            />
          </label>
          <ManifestoInput initial={profile?.manifesto ?? ""} />
          <div>
            <p className={labelDark}>
              Links <span className="normal-case tracking-normal text-white/25">(optional)</span>
            </p>
            <div className="mt-2">
              <LinksInput initial={profile?.links ?? []} />
            </div>
          </div>
          <div>
            <p className={labelDark}>
              Skills <span className="normal-case tracking-normal text-white/25">(optional)</span>
            </p>
            <div className="mt-2">
              <SkillsInput initial={profile?.skills ?? []} dark />
            </div>
          </div>
        </section>

        {showInvestmentThesis && (
          <section className="flex flex-col gap-4 border-t border-white/10 pt-8">
            <div>
              <p className={labelDark}>Investment thesis</p>
              <p className="mt-1 text-xs text-white/45">
                Complete your thesis to get better weekly matches and alerts.
              </p>
            </div>
            <fieldset className="border border-white/10 p-4">
              <legend className="px-1 text-xs font-bold text-white/70">Stage focus</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {STAGE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="inline-flex items-center gap-2 border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white/70"
                  >
                    <input
                      type="checkbox"
                      name="stage_focus"
                      value={option.value}
                      defaultChecked={profile?.stage_focus?.includes(option.value)}
                      className="accent-beedero-yellow"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="border border-white/10 p-4">
              <legend className="px-1 text-xs font-bold text-white/70">Sector focus</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SECTOR_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="inline-flex items-center gap-2 border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white/70"
                  >
                    <input
                      type="checkbox"
                      name="sector_focus"
                      value={option.value}
                      defaultChecked={profile?.sector_focus?.includes(option.value)}
                      className="accent-beedero-yellow"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="border border-white/10 p-4">
              <legend className="px-1 text-xs font-bold text-white/70">{GEO_INVESTOR_FOCUS_LABEL}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {GEO_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="inline-flex items-center gap-2 border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white/70"
                  >
                    <input
                      type="checkbox"
                      name="geo_focus"
                      value={option.value}
                      defaultChecked={profile?.geo_focus?.includes(option.value)}
                      className="accent-beedero-yellow"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelDark}>
                Min check (USD)
                <input
                  name="check_min"
                  type="number"
                  min={0}
                  placeholder="e.g. 25000"
                  defaultValue={profile?.check_min ?? ""}
                  className={`mt-2 ${inputDark} placeholder:text-white/35`}
                />
              </label>
              <label className={labelDark}>
                Max check (USD)
                <input
                  name="check_max"
                  type="number"
                  min={0}
                  placeholder="e.g. 500000"
                  defaultValue={profile?.check_max ?? ""}
                  className={`mt-2 ${inputDark} placeholder:text-white/35`}
                />
              </label>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-4 border-t border-white/10 pt-8">
          <div>
            <p className={labelDark}>Who can see what</p>
            <p className="mt-1 text-xs text-white/45">Control visibility for each part of your profile.</p>
          </div>
          <div className="divide-y divide-white/10 border border-white/10">
            {VISIBILITY_SECTIONS.map(({ key, label, hint }) => (
              <label
                key={key}
                className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">{label}</span>
                  <span className="block text-[10px] text-white/40">{hint}</span>
                </span>
                <select
                  name={`visibility_${key}`}
                  defaultValue={visibility[key] ?? "public"}
                  className={`w-full shrink-0 sm:w-40 ${inputDark}`}
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

        <section className="flex flex-col gap-4 border-t border-white/10 pt-8">
          <div>
            <p className={labelDark}>Show on your profile</p>
            <p className="mt-1 text-xs text-white/45">Facts Beedero can display from your activity.</p>
          </div>
          <div className="flex flex-col gap-2">
            {ATTESTATION_OPTIONS.map(({ key, label, hint }) => (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-3 border border-white/10 px-4 py-3.5 transition has-[:checked]:border-beedero-yellow/40 has-[:checked]:bg-beedero-yellow/5"
              >
                <input
                  type="checkbox"
                  name={key}
                  defaultChecked={attestationPrefs[key] !== false}
                  className="mt-0.5 size-4 shrink-0 accent-beedero-yellow"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">{label}</span>
                  <span className="block text-[10px] text-white/40">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="flex justify-end border-t border-white/10 px-5 py-4 sm:px-7">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
