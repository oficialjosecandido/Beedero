"use client";

import { useState } from "react";

import { inputDark, labelDark } from "@/components/app-shell/ui";

/**
 * The three multi-value inputs the profile sections share. Moved here from
 * ProfileForm (which goes away) so ExperienceManager and the sections import
 * them from one place.
 */

export type ProfileLink = { label: string; url: string };

export const MANIFESTO_MAX = 600;
export const MAX_LINKS = 10; // accounts/serializers.py MAX_LINKS

export function ManifestoInput({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <label className={labelDark}>
      Manifesto <span className="normal-case tracking-normal text-white/25">(optional)</span>
      <textarea
        name="manifesto"
        rows={3}
        maxLength={MANIFESTO_MAX}
        placeholder="What you stand for, in a sentence or two."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={`mt-2 ${inputDark} min-h-[5rem] resize-y placeholder:text-white/35`}
      />
      <span className="mt-1 block text-right text-[10px] text-white/35">
        {value.length}/{MANIFESTO_MAX}
      </span>
    </label>
  );
}

let linkRowSeq = 0;

export function LinksInput({ initial }: { initial: ProfileLink[] }) {
  const [rows, setRows] = useState(() =>
    (initial.length ? initial : [{ label: "", url: "" }]).map((link) => ({ id: linkRowSeq++, ...link }))
  );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={labelDark}>
        Links <span className="normal-case tracking-normal text-white/25">(optional)</span>
      </legend>
      {rows.map((row, index) => (
        <div key={row.id} className="mt-2 grid grid-cols-[2fr_3fr_auto] gap-2">
          <input
            name="link_label"
            defaultValue={row.label}
            aria-label={`Link ${index + 1} label`}
            placeholder="Site"
            className={`${inputDark} placeholder:text-white/35`}
          />
          <input
            name="link_url"
            type="url"
            inputMode="url"
            defaultValue={row.url}
            aria-label={`Link ${index + 1} address`}
            placeholder="https://"
            className={`${inputDark} placeholder:text-white/35`}
          />
          <button
            type="button"
            onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
            aria-label={`Remove link ${index + 1}`}
            className="min-w-11 border border-white/15 px-2.5 text-xs font-semibold text-white/45 hover:border-beedero-yellow hover:text-beedero-yellow"
          >
            ×
          </button>
        </div>
      ))}
      {rows.length < MAX_LINKS && (
        <button
          type="button"
          onClick={() => setRows((current) => [...current, { id: linkRowSeq++, label: "", url: "" }])}
          className="mt-1 self-start text-xs font-bold text-beedero-yellow hover:underline"
        >
          + Add link
        </button>
      )}
    </fieldset>
  );
}

export function SkillsInput({ initial, max }: { initial: string[]; max?: number }) {
  const [skills, setSkills] = useState(initial);
  const [draft, setDraft] = useState("");
  const full = max !== undefined && skills.length >= max;

  function commitDraft() {
    const value = draft.trim();
    setDraft("");
    if (!value || full) return;
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
            className="inline-flex items-center gap-1.5 border border-white/15 px-2.5 py-1 text-xs font-medium text-white/70"
          >
            {skill}
            <button
              type="button"
              onClick={() => setSkills((current) => current.filter((s) => s !== skill))}
              className="text-white/40 hover:text-white"
              aria-label={`Remove ${skill}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        disabled={full}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commitDraft();
          }
        }}
        onBlur={commitDraft}
        aria-label="Add a skill"
        placeholder={full ? `That's the maximum of ${max}.` : "Type a skill and press Enter"}
        className={`${inputDark} placeholder:text-white/35`}
      />
    </div>
  );
}
