import "server-only";

import { cookies } from "next/headers";

const ACCESS_COOKIE = "beedero_access";
const REFRESH_COOKIE = "beedero_refresh";
const ID_TOKEN_COOKIE = "beedero_id_token";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// apiFetch()'s 401-retry path calls setSession()/clearSession() from plain
// Server Component renders (page.tsx), not just from Server Actions/Route
// Handlers. Next.js only allows cookie mutation in the latter two contexts
// and throws synchronously otherwise ("Cookies can only be modified in a
// Server Action or Route Handler") — swallow just that error so an in-render
// refresh still returns a usable token for the current request, even though
// it can't persist the new cookie until the next allowed context runs.
function isReadonlyCookiesError(err: unknown) {
  return err instanceof Error && err.message.includes("can only be modified in a Server Action");
}

export async function setSession(access: string, refresh: string, idToken?: string) {
  const store = await cookies();
  try {
    store.set(ACCESS_COOKIE, access, { ...cookieOptions, maxAge: 60 * 30 });
    store.set(REFRESH_COOKIE, refresh, { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 });
    if (idToken) {
      store.set(ID_TOKEN_COOKIE, idToken, { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 });
    }
  } catch (err) {
    if (!isReadonlyCookiesError(err)) throw err;
  }
}

export async function clearSession() {
  const store = await cookies();
  try {
    store.delete(ACCESS_COOKIE);
    store.delete(REFRESH_COOKIE);
    store.delete(ID_TOKEN_COOKIE);
  } catch (err) {
    if (!isReadonlyCookiesError(err)) throw err;
  }
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value;
}

export async function getIdToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ID_TOKEN_COOKIE)?.value;
}

export async function isAuthenticated(): Promise<boolean> {
  return Boolean(await getAccessToken());
}
