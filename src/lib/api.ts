import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, extra?: unknown) {
  return NextResponse.json(
    { ok: false, error: message, ...(extra ? { details: extra } : {}) },
    { status }
  );
}

/** Wraps a route handler with consistent error handling. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AuthError) return fail(err.message, err.status);
      if (err instanceof ZodError) {
        return fail("Invalid input", 422, err.flatten());
      }
      const message = err instanceof Error ? err.message : "Server error";
      console.error("[api] error:", err);
      return fail(message, 500);
    }
  };
}
