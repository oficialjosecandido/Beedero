import "server-only";

import { cookies } from "next/headers";

const ACCESS_COOKIE = "beedero_access";
const REFRESH_COOKIE = "beedero_refresh";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function setSession(access: string, refresh: string) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, access, { ...cookieOptions, maxAge: 60 * 30 });
  store.set(REFRESH_COOKIE, refresh, { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value;
}

export async function isAuthenticated(): Promise<boolean> {
  return Boolean(await getAccessToken());
}
