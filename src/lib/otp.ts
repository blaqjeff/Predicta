import { createHash } from "crypto";

export function hashOtp(email: string, code: string): string {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHash("sha256").update(`${email}:${code}:${secret}`).digest("hex");
}
