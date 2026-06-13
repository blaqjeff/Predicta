import { NextRequest } from "next/server";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { ok, route } from "@/lib/api";
import { emailSchema } from "@/lib/validation";
import { sendOtpEmail } from "@/lib/email";
import { hashOtp } from "@/lib/otp";

export const POST = route(async (req: NextRequest) => {
  const body = await req.json();
  const email = emailSchema.parse(body.email);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.emailOtp.create({
    data: { email, codeHash: hashOtp(email, code), expiresAt },
  });

  await sendOtpEmail(email, code);
  return ok({ sent: true });
});
