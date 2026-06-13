import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, route } from "@/lib/api";
import { setSession } from "@/lib/session";
import { verifyWalletSignature } from "@/lib/solana";
import { buildWalletLoginMessage } from "@/lib/walletMessage";
import {
  findOrCreateUserByIdentity,
  getCurrentUser,
  linkIdentity,
} from "@/lib/auth";

export const POST = route(async (req: NextRequest) => {
  const body = await req.json();
  const pubkey = String(body.pubkey ?? "");
  const signature = String(body.signature ?? "");
  const nonce = String(body.nonce ?? "");

  const record = await prisma.walletNonce.findUnique({ where: { nonce } });
  if (
    !record ||
    record.consumed ||
    record.pubkey !== pubkey ||
    record.expiresAt < new Date()
  ) {
    return fail("Invalid or expired login challenge", 401);
  }

  const message = buildWalletLoginMessage(pubkey, nonce);
  if (!verifyWalletSignature(pubkey, message, signature)) {
    return fail("Signature verification failed", 401);
  }

  await prisma.walletNonce.update({
    where: { id: record.id },
    data: { consumed: true },
  });

  // If already signed in, link the wallet and set it as the reward wallet.
  const current = await getCurrentUser();
  if (current) {
    await linkIdentity({ userId: current.id, provider: "wallet", providerId: pubkey });
    if (!current.rewardWallet) {
      await prisma.user.update({
        where: { id: current.id },
        data: { rewardWallet: pubkey },
      });
    }
    const updated = await prisma.user.findUnique({ where: { id: current.id } });
    return ok({ user: updated, linked: true });
  }

  // Wallet login: the wallet becomes the reward wallet automatically.
  const { userId } = await findOrCreateUserByIdentity({
    provider: "wallet",
    providerId: pubkey,
    rewardWallet: pubkey,
  });
  await setSession(userId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return ok({ user });
});
