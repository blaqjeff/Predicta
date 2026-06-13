import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, route } from "@/lib/api";
import { emailSchema } from "@/lib/validation";
import { setSession } from "@/lib/session";
import { hashOtp } from "@/lib/otp";
import {
  findOrCreateUserByIdentity,
  getCurrentUser,
  linkIdentity,
} from "@/lib/auth";

export const POST = route(async (req: NextRequest) => {
  const body = await req.json();
  const email = emailSchema.parse(body.email);
  const code = String(body.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) return fail("Enter the 6-digit code", 422);

  const codeHash = hashOtp(email, code);
  const otp = await prisma.emailOtp.findFirst({
    where: { email, codeHash, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return fail("Invalid or expired code", 401);

  await prisma.emailOtp.update({
    where: { id: otp.id },
    data: { consumed: true },
  });

  // If already signed in, link this email to the existing account.
  const current = await getCurrentUser();
  if (current) {
    await linkIdentity({ userId: current.id, provider: "email", providerId: email });
    if (!current.email) {
      await prisma.user.update({
        where: { id: current.id },
        data: { email },
      });
    }
    return ok({ user: current, linked: true });
  }

  const { userId } = await findOrCreateUserByIdentity({
    provider: "email",
    providerId: email,
    email,
  });
  await setSession(userId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return ok({ user });
});
