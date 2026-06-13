import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { ok, fail, route } from "@/lib/api";
import { requireUser, validateUsername } from "@/lib/auth";

export const PATCH = route(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await req.json();

  const data: { username?: string; rewardWallet?: string | null } = {};

  if (typeof body.username === "string") {
    if (user.xHandle) {
      return fail("X users keep their X handle as their username", 400);
    }
    const username = validateUsername(body.username);
    const taken = await prisma.user.findFirst({
      where: { username, NOT: { id: user.id } },
    });
    if (taken) return fail("That username is taken", 409);
    data.username = username;
  }

  if (body.rewardWallet !== undefined) {
    if (body.rewardWallet === null || body.rewardWallet === "") {
      data.rewardWallet = null;
    } else {
      try {
        new PublicKey(String(body.rewardWallet));
      } catch {
        return fail("Invalid Solana wallet address", 422);
      }
      data.rewardWallet = String(body.rewardWallet);
    }
  }

  if (Object.keys(data).length === 0) return fail("Nothing to update", 400);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
  });
  return ok({
    user: {
      id: updated.id,
      username: updated.username,
      xHandle: updated.xHandle,
      email: updated.email,
      rewardWallet: updated.rewardWallet,
      isAdmin: updated.isAdmin,
    },
  });
});

export const GET = route(async () => {
  const user = await requireUser();
  const identities = await prisma.authIdentity.findMany({
    where: { userId: user.id },
    select: { provider: true, createdAt: true },
  });
  return ok({ user, identities });
});
