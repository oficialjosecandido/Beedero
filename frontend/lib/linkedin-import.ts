import { COUNTRIES } from "./countries";

export type ImportEntryStatus =
  | "new"
  | "update"
  | "already_on_profile"
  | "missing_start"
  | "invalid_dates";

export type ImportEntry = {
  key: string;
  kind: "work" | "education";
  org_name: string;
  role: string;
  description: string;
  started_on: string | null;
  ended_on: string | null;
  status: ImportEntryStatus;
  current_description?: string;
  beedero_org: { slug: string; name: string } | null;
};

export type LinkedInImportPreview = {
  files_read: string[];
  profile: {
    full_name: { imported: string; current: string };
    headline: { imported: string; current: string };
    bio: { imported: string; current: string };
    location: { imported: string; current_country: string };
  };
  entries: ImportEntry[];
};

export type LinkedInImportApplyPayload = {
  full_name?: string;
  headline?: string;
  bio?: string;
  country?: string;
  entries?: Pick<ImportEntry, "kind" | "org_name" | "role" | "description" | "started_on" | "ended_on">[];
};

export type LinkedInImportApplyResult = {
  profile_fields_updated: string[];
  entries_created: number;
  entries_updated: number;
  entries_skipped: number;
};

const NAME_LOCALES = ["en", "pt", "es", "fr", "de", "it"];

/** "Lisbon, Portugal" / "Lisboa e Região, Portugal" / "Madrid, Espanha" ->
 * ISO code, matched against the profile form's own country list. LinkedIn
 * writes the country in the member's interface language, so we also try
 * the localized names the browser knows. */
export function countryFromLocation(location: string): string | null {
  const last = location.split(",").pop()?.trim().toLowerCase();
  if (!last) return null;
  for (const [code, name] of COUNTRIES) {
    if (name.toLowerCase() === last) return code;
  }
  for (const locale of NAME_LOCALES) {
    let names: Intl.DisplayNames;
    try {
      names = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      continue;
    }
    for (const [code] of COUNTRIES) {
      if (names.of(code)?.toLowerCase() === last) return code;
    }
  }
  return null;
}

export function countryName(code: string): string {
  return COUNTRIES.find(([c]) => c === code)?.[1] ?? code;
}
