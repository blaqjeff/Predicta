"use client";

export interface ApiError extends Error {
  status: number;
  details?: unknown;
}

/** Calls a JSON API route and unwraps the { ok, data } envelope. */
export async function api<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let body: { ok?: boolean; data?: T; error?: string; details?: unknown } = {};
  try {
    body = await res.json();
  } catch {
    // non-JSON response
  }
  if (!res.ok || body.ok === false) {
    const err = new Error(body.error || res.statusText) as ApiError;
    err.status = res.status;
    err.details = body.details;
    throw err;
  }
  return body.data as T;
}
