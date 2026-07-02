import "server-only";

import { getAccessToken } from "./session";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
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
  const res = await fetch(`${BACKEND_URL}${path}`, {
    next: { revalidate },
  });
  return parse(res);
}

/** §7: any authenticated response — never in shared cache. */
export async function apiFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  const token = await getAccessToken();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  return parse(res);
}

/** Auth endpoints don't carry a Bearer token (login/register). */
export async function anonFetch(path: string, body: unknown) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return parse(res);
}
