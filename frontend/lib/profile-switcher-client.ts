export type ProfileSwitcherMe = {
  email: string;
  investor_profile: {
    full_name?: string;
    headline?: string;
    profile_picture?: string | null;
    handle?: string | null;
  } | null;
};

export type ProfileSwitcherOrg = {
  slug: string;
  name: string;
  role: string;
  logo?: string | null;
};

export type ProfileSwitcherData = {
  me: ProfileSwitcherMe;
  orgs: ProfileSwitcherOrg[];
};

let cached: ProfileSwitcherData | null = null;
let inflight: Promise<ProfileSwitcherData | null> | null = null;

export function clearProfileSwitcherCache() {
  cached = null;
}

export async function fetchProfileSwitcher(options?: { force?: boolean }): Promise<ProfileSwitcherData | null> {
  if (!options?.force && cached) return cached;
  if (!options?.force && inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/profile-switcher", { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as ProfileSwitcherData;
      cached = data;
      return data;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
