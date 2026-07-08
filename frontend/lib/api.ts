import "server-only";

import { clearSession, getAccessToken, getRefreshToken, setSession } from "./session";

const DEFAULT_API_TIMEOUT_MS = 15_000;
const AUTH_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 30_000;

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function getBackendUrl() {
  const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");
  if (backendUrl) {
    let url: URL;
    try {
      url = new URL(backendUrl);
    } catch {
      throw new BackendConfigError("BACKEND_URL must be an absolute URL.");
    }
    if (
      isProductionRuntime() &&
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    ) {
      throw new BackendConfigError("BACKEND_URL cannot point to localhost in production.");
    }
    return backendUrl;
  }

  if (!isProductionRuntime()) return "http://localhost:8000/api";

  throw new BackendConfigError(
    "BACKEND_URL must be set in production, e.g. https://beedero-api.azurewebsites.net/api."
  );
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

export class ApiTimeoutError extends Error {
  constructor() {
    super("API request timed out");
  }
}

export class BackendConfigError extends Error {}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiTimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function parse(res: Response) {
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

/** §7: public profile — cacheable, no auth. */
export async function publicFetch(path: string, revalidate = 300) {
  const res = await fetchWithTimeout(
    `${getBackendUrl()}${path}`,
    { next: { revalidate } },
    DEFAULT_API_TIMEOUT_MS
  );
  return parse(res);
}

function doFetch(path: string, options: { method?: string; body?: unknown }, token?: string) {
  const isFormData = options.body instanceof FormData;
  return fetchWithTimeout(
    `${getBackendUrl()}${path}`,
    {
      method: options.method ?? "GET",
      headers: {
        // For FormData, let fetch set Content-Type itself (needs the multipart boundary).
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: isFormData
        ? (options.body as FormData)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
      cache: "no-store",
    },
    isFormData ? UPLOAD_TIMEOUT_MS : DEFAULT_API_TIMEOUT_MS
  );
}

/** P0.5: the access token is short-lived (30min) — on a 401, try the refresh
 * cookie once before giving up, so a session doesn't die mid-visit. */
async function tryRefresh(): Promise<string | null> {
  const refresh = await getRefreshToken();
  if (!refresh) return null;
  try {
    const tokens: { access: string; refresh?: string } = await anonFetch("/auth/token/refresh/", {
      refresh,
    });
    await setSession(tokens.access, tokens.refresh ?? refresh);
    return tokens.access;
  } catch {
    await clearSession();
    return null;
  }
}

/** §7: any authenticated response — never in shared cache. */
export async function apiFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  const token = await getAccessToken();
  let res = await doFetch(path, options, token);
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) throw new ApiError(401, null);
    res = await doFetch(path, options, refreshed); // retry exactly once
  }
  return parse(res);
}

/** Auth endpoints don't carry a Bearer token (login/register). */
export async function anonFetch(path: string, body: unknown) {
  const res = await fetchWithTimeout(
    `${getBackendUrl()}${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
    AUTH_TIMEOUT_MS
  );
  return parse(res);
}
