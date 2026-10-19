"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, ExternalLink, Lock } from "lucide-react";

import { uploadProfilePictureAction } from "@/app/(app)/dashboard/actions";
import {
  saveAboutAction,
  saveAdvisoryAction,
  saveIdentityAction,
  saveIntentsAction,
  saveInvestmentFocusAction,
  saveShowOnProfileAction,
  saveSkillsAction,
} from "@/app/(app)/profile/section-actions";
import {
  MembershipSkillsManager,
  type PersonMembershipWithSkills,
} from "@/components/MembershipSkillsManager";
import { inputDark, labelDark, Seal } from "@/components/app-shell/ui";
import { ENGAGEMENT_OPTIONS, EXPERTISE_OPTIONS } from "@/lib/advisory-options";
import { COUNTRIES } from "@/lib/countries";
import { GEO_INVESTOR_FOCUS_LABEL, GEO_OPTIONS, SECTOR_OPTIONS, STAGE_OPTIONS } from "@/lib/org-filters";
import type { AggregatedSkillTime } from "@/lib/skill-duration";
import type { AdvisorProfile } from "@/lib/types";

import { EditableSection } from "./EditableSection";
import { LinksInput, ManifestoInput, SkillsInput, type ProfileLink } from "./fields";
import { VisibilityPill } from "./VisibilityPill";

export type EditableProfile = {
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
  is_verified?: boolean;
  visibility?: Record<string, string>;
  attestation_prefs?: Record<string, boolean>;
  stage_focus?: string[];
  sector_focus?: string[];
  geo_focus?: string[];
  check_min?: number | null;
  check_max?: number | null;
};

const MAX_SKILLS = 30; // accounts/skills.py

const str = (data: FormData, key: string) => String(data.get(key) ?? "");

function countryName(code?: string) {
  return COUNTRIES.find(([value]) => value === code)?.[1] ?? "";
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/* ---------------------------------------------------------------- identity */

function Avatar({ profile, name }: { profile: EditableProfile; name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const src = preview ?? profile.profile_picture ?? null;

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setError(null);
    const body = new FormData();
    body.set("profile_picture", file);
    startTransition(async () => {
      const result = await uploadProfilePictureAction(body);
      if ("error" in result) {
        setError(result.error);
        setPreview(null);
        URL.revokeObjectURL(url);
      }
    });
  }

  return (
    <div className="relative shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={`size-20 rounded-full object-cover ${pending ? "opacity-60" : ""}`} />
      ) : (
        <span
          aria-hidden
          className="grid size-20 place-items-center rounded-full bg-[#68738a] text-2xl font-black text-white"
        >
          {initials(name)}
        </span>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        aria-label={src ? "Change profile photo" : "Add a profile photo"}
        className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full border-2 border-app-bg bg-beedero-yellow text-beedero-black transition hover:scale-105 disabled:opacity-60"
      >
        <Camera size={15} aria-hidden />
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={onPick} />
      {error && <p className="absolute left-0 top-full mt-1 w-48 text-xs text-red-300">{error}</p>}
    </div>
  );
}

export function IdentitySection({
  profile,
  email,
  actions,
}: {
  profile: EditableProfile;
  email: string;
  /** Share / Preview buttons. */
  actions: React.ReactNode;
}) {
  const name = profile.full_name || email;
  const location = [profile.city, countryName(profile.country)].filter(Boolean).join(", ");
  const nameLocked = Boolean(profile.full_name);

  return (
    <EditableSection
      id="identity"
      eyebrow="My profile"
      title="Basics"
      hideTitle
      aside={actions}
      onSave={(data) =>
        saveIdentityAction({
          full_name: nameLocked ? undefined : str(data, "full_name"),
          headline: str(data, "headline"),
          city: str(data, "city"),
          country: str(data, "country"),
        })
      }
      view={
        <div className="flex flex-wrap items-start gap-5">
          <Avatar profile={profile} name={name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-3xl font-black tracking-[-0.05em] sm:text-4xl">{name}</p>
              {profile.is_verified && <Seal />}
            </div>
            {profile.headline ? (
              <p className="mt-1 text-base text-white/70">{profile.headline}</p>
            ) : (
              <p className="mt-1 text-sm text-white/40">Add a headline — one line on what you do.</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-white/45">
              <span>{location || "Add where you're based"}</span>
              <VisibilityPill section="country" value={profile.visibility?.country} label="Location" />
            </div>
            {profile.handle && (
              <p className="mt-2 text-xs text-white/35">beedero.com/p/{profile.handle}</p>
            )}
          </div>
        </div>
      }
      fields={
        <div className="grid gap-4 sm:grid-cols-2">
          {nameLocked ? (
            <p className="flex items-center gap-2 text-xs text-white/45 sm:col-span-2">
              <Lock size={12} aria-hidden /> {profile.full_name} — your name is fixed once set, because
              verification is tied to it.
            </p>
          ) : (
            <label className={`sm:col-span-2 ${labelDark}`}>
              Full name
              <input name="full_name" required maxLength={200} className={`mt-2 ${inputDark}`} />
            </label>
          )}
          <label className={`sm:col-span-2 ${labelDark}`}>
            Headline
            <input
              name="headline"
              required
              maxLength={200}
              defaultValue={profile.headline ?? ""}
              placeholder="Founder at Acme · Fintech for small merchants"
              className={`mt-2 ${inputDark} placeholder:text-white/35`}
            />
          </label>
          <label className={labelDark}>
            City
            <input
              name="city"
              maxLength={80}
              defaultValue={profile.city ?? ""}
              placeholder="Lisboa"
              className={`mt-2 ${inputDark} placeholder:text-white/35`}
            />
          </label>
          <label className={labelDark}>
            Country
            <select
              name="country"
              required
              defaultValue={profile.country ?? ""}
              className={`mt-2 ${inputDark} bg-app-elevated`}
            >
              <option value="" disabled>
                Select a country
              </option>
              {COUNTRIES.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------- about */

export function AboutSection({ profile }: { profile: EditableProfile }) {
  const links = profile.links ?? [];
  return (
    <EditableSection
      id="about"
      title="About"
      aside={<VisibilityPill section="bio" value={profile.visibility?.bio} label="About" />}
      isEmpty={!profile.bio && !profile.manifesto && links.length === 0}
      emptyPrompt="Add two or three lines about your work — it's the first thing people read."
      onSave={(data) =>
        saveAboutAction({
          bio: str(data, "bio"),
          manifesto: str(data, "manifesto"),
          links: data
            .getAll("link_label")
            .map((label, i) => ({ label: String(label), url: String(data.getAll("link_url")[i] ?? "") })),
        })
      }
      view={
        <div className="flex flex-col gap-4">
          {profile.bio && <p className="whitespace-pre-line text-sm leading-6 text-white/80">{profile.bio}</p>}
          {profile.manifesto && (
            <blockquote className="border-l-2 border-beedero-yellow pl-3 text-sm italic text-white/65">
              {profile.manifesto}
            </blockquote>
          )}
          {links.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {links.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 border border-white/15 px-2.5 py-1.5 text-xs font-bold text-white/75 hover:border-beedero-yellow hover:text-beedero-yellow"
                  >
                    {link.label} <ExternalLink size={11} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      }
      fields={
        <>
          <label className={labelDark}>
            Bio
            <textarea
              name="bio"
              rows={4}
              maxLength={2600}
              defaultValue={profile.bio ?? ""}
              placeholder="What you're building, what you've done, what you're looking for."
              className={`mt-2 ${inputDark} min-h-[7rem] resize-y placeholder:text-white/35`}
            />
          </label>
          <ManifestoInput initial={profile.manifesto ?? ""} />
          <LinksInput initial={links} />
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ skills */

export function SkillsSection({
  profile,
  practised,
  memberships,
}: {
  profile: EditableProfile;
  /** Aggregated from the experience records (lib/skill-duration). */
  practised: AggregatedSkillTime[];
  /** Org memberships, whose skills an org admin can confirm. */
  memberships: PersonMembershipWithSkills[];
}) {
  const chosen = profile.skills ?? [];
  const byKey = new Map(practised.map((p) => [p.skill.toLowerCase(), p]));
  const fromRecord = practised.filter((p) => !chosen.some((c) => c.toLowerCase() === p.skill.toLowerCase()));

  return (
    <EditableSection
      id="skills"
      title="Skills"
      aside={<VisibilityPill section="skills" value={profile.visibility?.skills} label="Skills" />}
      isEmpty={chosen.length === 0 && practised.length === 0 && memberships.length === 0}
      emptyPrompt="List the skills you want to be found for."
      onSave={(data) => saveSkillsAction({ skills: data.getAll("skills").map(String) })}
      view={
        <div className="flex flex-col gap-4">
          {chosen.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chosen.map((skill) => {
                const time = byKey.get(skill.toLowerCase());
                return (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-2 border border-beedero-yellow/30 bg-beedero-yellow/[0.06] px-3 py-1.5 text-xs font-bold"
                  >
                    {skill}
                    {time && (
                      <span className="border-l border-beedero-yellow/30 pl-2 text-[10px] font-black uppercase text-beedero-yellow">
                        {time.duration}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
          {fromRecord.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                From your experience
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {fromRecord.map((p) => (
                  <span key={p.skill} className="inline-flex items-center gap-2 border border-white/15 px-3 py-1.5 text-xs text-white/70">
                    {p.skill}
                    <span className="text-[10px] font-black uppercase text-white/45">{p.duration}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <MembershipSkillsManager memberships={memberships} />
        </div>
      }
      fields={
        <>
          <p className="text-xs leading-5 text-white/45">
            Up to {MAX_SKILLS}. Time next to a skill comes from the experience records where you used
            it.
          </p>
          <SkillsInput initial={chosen} max={MAX_SKILLS} />
        </>
      }
    />
  );
}

/* ------------------------------------------------------------- preferences */

export function PreferencesSection({
  profile,
  intents,
  intentOptions,
}: {
  profile: EditableProfile;
  intents: string[];
  intentOptions: { value: string; label: string }[];
}) {
  const prefs = { show_memberships: true, show_posts_count: true, ...(profile.attestation_prefs ?? {}) };
  const chosen = intentOptions.filter((o) => intents.includes(o.value));
  return (
    <EditableSection
      id="preferences"
      title="Preferences"
      aside={
        <span className="flex h-9 items-center gap-1.5 border border-white/15 px-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-white/45">
          <Lock size={12} aria-hidden /> Only you
        </span>
      }
      onSave={async (data) => {
        const first = await saveIntentsAction(data.getAll("intents").map(String));
        if ("error" in first) return first;
        return saveShowOnProfileAction({
          show_memberships: data.get("show_memberships") === "on",
          show_posts_count: data.get("show_posts_count") === "on",
        });
      }}
      view={
        <dl className="grid items-center gap-3 text-sm sm:grid-cols-[180px_1fr]">
          <dt className="text-white/45">Your posts</dt>
          <dd>
            <VisibilityPill section="posts" value={profile.visibility?.posts} label="Your posts" />
          </dd>
          <dt className="text-white/45">Platform facts</dt>
          <dd>
            <VisibilityPill
              section="attestations"
              value={profile.visibility?.attestations}
              label="Platform facts"
            />
          </dd>
          <dt className="text-white/45">Here for</dt>
          <dd>{chosen.length ? chosen.map((o) => o.label).join(" · ") : "Nothing picked yet"}</dd>
          <dt className="text-white/45">Show on my profile</dt>
          <dd>
            {[prefs.show_memberships && "Organisation memberships", prefs.show_posts_count && "Post count"]
              .filter(Boolean)
              .join(" · ") || "Nothing extra"}
          </dd>
        </dl>
      }
      fields={
        <>
          <fieldset>
            <legend className={labelDark}>What brings you here</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {intentOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 border border-white/15 px-3 py-2 text-xs has-[:checked]:border-beedero-yellow has-[:checked]:text-beedero-yellow"
                >
                  <input
                    type="checkbox"
                    name="intents"
                    value={option.value}
                    defaultChecked={intents.includes(option.value)}
                    className="accent-beedero-yellow"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className={labelDark}>Show on my profile</legend>
            <label className="mt-2 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="show_memberships"
                defaultChecked={prefs.show_memberships}
                className="size-4 accent-beedero-yellow"
              />
              Organisation memberships
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="show_posts_count"
                defaultChecked={prefs.show_posts_count}
                className="size-4 accent-beedero-yellow"
              />
              Post count
            </label>
          </fieldset>
        </>
      }
    />
  );
}

/* ------------------------------------------------------------ chip helpers */

type Option = { readonly value: string; readonly label: string };

function ChipFieldset({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: readonly Option[];
  selected: string[];
}) {
  return (
    <fieldset>
      <legend className={labelDark}>{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white/70 has-[:checked]:border-beedero-yellow has-[:checked]:text-beedero-yellow"
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selected.includes(option.value)}
              className="accent-beedero-yellow"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function labelsOf(options: readonly Option[], values: string[] = []) {
  return options.filter((o) => values.includes(o.value)).map((o) => o.label);
}

function FactRow({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <>
      <dt className="text-white/45">{label}</dt>
      <dd>{values.join(" · ")}</dd>
    </>
  );
}

const euros = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/* ------------------------------------------------------- investment focus */

/** Shown when the person says they invest (onboarding intent) or already has a thesis. */
export function InvestmentFocusSection({ profile }: { profile: EditableProfile }) {
  const stages = profile.stage_focus ?? [];
  const sectors = profile.sector_focus ?? [];
  const geos = profile.geo_focus ?? [];
  const isEmpty = !stages.length && !sectors.length && !geos.length && !profile.check_min && !profile.check_max;
  const ticket = [profile.check_min, profile.check_max].filter((v): v is number => typeof v === "number");

  return (
    <EditableSection
      id="investing"
      title="Investment focus"
      isEmpty={isEmpty}
      emptyPrompt="Set your stages, sectors and ticket — founders and match alerts use it."
      onSave={(data) => {
        const num = (key: string) => {
          const raw = str(data, key).trim();
          return raw ? Number(raw) : null;
        };
        return saveInvestmentFocusAction({
          stage_focus: data.getAll("stage_focus").map(String),
          sector_focus: data.getAll("sector_focus").map(String),
          geo_focus: data.getAll("geo_focus").map(String),
          check_min: num("check_min"),
          check_max: num("check_max"),
        });
      }}
      view={
        <dl className="grid gap-3 text-sm sm:grid-cols-[180px_1fr]">
          <FactRow label="Stages" values={labelsOf(STAGE_OPTIONS, stages)} />
          <FactRow label="Sectors" values={labelsOf(SECTOR_OPTIONS, sectors)} />
          <FactRow label={GEO_INVESTOR_FOCUS_LABEL} values={labelsOf(GEO_OPTIONS, geos)} />
          <FactRow label="Ticket" values={ticket.length ? [ticket.map((v) => euros.format(v)).join(" – ")] : []} />
        </dl>
      }
      fields={
        <>
          <ChipFieldset legend="Stages" name="stage_focus" options={STAGE_OPTIONS} selected={stages} />
          <ChipFieldset legend="Sectors" name="sector_focus" options={SECTOR_OPTIONS} selected={sectors} />
          <ChipFieldset legend={GEO_INVESTOR_FOCUS_LABEL} name="geo_focus" options={GEO_OPTIONS} selected={geos} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelDark}>
              Minimum ticket (€)
              <input
                name="check_min"
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                defaultValue={profile.check_min ?? ""}
                placeholder="25000"
                className={`mt-2 ${inputDark} placeholder:text-white/35`}
              />
            </label>
            <label className={labelDark}>
              Maximum ticket (€)
              <input
                name="check_max"
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                defaultValue={profile.check_max ?? ""}
                placeholder="250000"
                className={`mt-2 ${inputDark} placeholder:text-white/35`}
              />
            </label>
          </div>
        </>
      }
    />
  );
}

/* --------------------------------------------------------------- advisory */

export function AdvisorySection({ advisor }: { advisor: AdvisorProfile | null }) {
  const a: AdvisorProfile = advisor ?? {
    is_available: false,
    expertise: [],
    stages: [],
    sectors: [],
    engagement_types: [],
  };
  return (
    <EditableSection
      id="advisory"
      title="Open to advisory work"
      aside={
        <span
          className={`flex h-9 items-center border px-2.5 text-[10px] font-black uppercase tracking-[0.1em] ${
            a.is_available ? "border-emerald-400/40 text-emerald-400" : "border-white/15 text-white/45"
          }`}
        >
          {a.is_available ? "Open" : "Not now"}
        </span>
      }
      onSave={(data) =>
        saveAdvisoryAction({
          is_available: data.get("is_available") === "on",
          engagement_types: data.getAll("engagement_types").map(String),
          expertise: data.getAll("expertise").map(String),
          stages: data.getAll("stages").map(String),
          sectors: data.getAll("sectors").map(String),
        })
      }
      view={
        a.is_available ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-[180px_1fr]">
            <FactRow label="As" values={labelsOf(ENGAGEMENT_OPTIONS, a.engagement_types)} />
            <FactRow label="Expertise" values={labelsOf(EXPERTISE_OPTIONS, a.expertise)} />
            <FactRow label="Stages" values={labelsOf(STAGE_OPTIONS, a.stages)} />
            <FactRow label="Sectors" values={labelsOf(SECTOR_OPTIONS, a.sectors)} />
          </dl>
        ) : (
          <p className="text-sm text-white/45">
            Hidden from your profile. Turn it on to show startups you&apos;re open to advisory, board or
            fractional roles.
          </p>
        )
      }
      fields={
        <>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="is_available"
              defaultChecked={a.is_available}
              className="mt-0.5 size-4 accent-beedero-yellow"
            />
            <span>
              <b className="block">Show on my profile that I&apos;m open to this</b>
              <span className="text-xs text-white/45">Startups can find you in Discover.</span>
            </span>
          </label>
          <ChipFieldset legend="As" name="engagement_types" options={ENGAGEMENT_OPTIONS} selected={a.engagement_types} />
          <ChipFieldset legend="Expertise" name="expertise" options={EXPERTISE_OPTIONS} selected={a.expertise} />
          <ChipFieldset legend="Stages" name="stages" options={STAGE_OPTIONS} selected={a.stages} />
          <ChipFieldset legend="Sectors" name="sectors" options={SECTOR_OPTIONS} selected={a.sectors} />
        </>
      }
    />
  );
}
