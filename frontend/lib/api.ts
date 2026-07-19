import "server-only";

import { getEntraConfig, tokenUrl } from "./entra";
import { clearSession, getAccessToken, getRefreshToken, setSession } from "./session";

const DEFAULT_API_TIMEOUT_MS = 15_000;
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

export class ApiNetworkError extends Error {
  cause: unknown;

  constructor(cause?: unknown) {
    super("Could not reach the Beedero API. Check your network and BACKEND_URL.");
    this.name = "ApiNetworkError";
    this.cause = cause;
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
    throw new ApiNetworkError(err);
  } finally {
    clearTimeout(timeout);
  }
}

async function parse(res: Response) {
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = {
        detail: text.trimStart().startsWith("<!")
          ? "Server returned HTML instead of JSON — is BACKEND_URL correct and the API route deployed?"
          : text.slice(0, 200),
      };
    }
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

/** §7: public profile — cacheable, no auth. */
export async function publicFetch<T = unknown>(path: string, revalidate = 300): Promise<T> {
  const res = await fetchWithTimeout(
    `${getBackendUrl()}${path}`,
    { next: { revalidate } },
    DEFAULT_API_TIMEOUT_MS
  );
  return parse(res) as T;
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
 * cookie once before giving up, so a session doesn't die mid-visit. Mirrors
 * proxy.ts's refreshEntraSession and app/api/auth/refresh/route.ts — this
 * one runs in the normal Node runtime, so it can import lib/entra.ts
 * directly (proxy.ts can't: it's edge middleware and lib/entra.ts uses
 * node:crypto). */
async function tryRefresh(): Promise<string | null> {
  const refresh = await getRefreshToken();
  const config = getEntraConfig();
  if (!refresh || !config) return null;

  const body = new URLSearchParams({
    client_id: config.webClientId,
    client_secret: config.webClientSecret,
    grant_type: "refresh_token",
    refresh_token: refresh,
    scope: `openid offline_access ${config.scope}`,
  });

  try {
    const res = await fetchWithTimeout(
      tokenUrl(config),
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
      DEFAULT_API_TIMEOUT_MS
    );
    if (!res.ok) {
      await clearSession();
      return null;
    }
    const tokens: { access_token: string; refresh_token?: string } = await res.json();
    await setSession(tokens.access_token, tokens.refresh_token ?? refresh);
    return tokens.access_token;
  } catch {
    await clearSession();
    return null;
  }
}

/** §7: any authenticated response — never in shared cache. */
export async function apiFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = await getAccessToken();
  let res = await doFetch(path, options, token);
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) throw new ApiError(401, null);
    res = await doFetch(path, options, refreshed); // retry exactly once
  }
  return parse(res) as T;
}

/** Every Server Action re-renders the page it was invoked from to build its
 * response — so a page's own data-fetching crash isn't just a bad initial
 * load, it takes down every action fired from that page (e.g. a "like"
 * fails because the chat/contacts fetch hiccuped, not because of the like
 * itself). Wrap non-essential fetches with this so a transient failure
 * degrades to `fallback` instead of crashing the whole render. A 401 still
 * propagates — that's a real "you're logged out," not a transient blip. */
export async function safeFetch<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) throw err;
    return fallback;
  }
}
