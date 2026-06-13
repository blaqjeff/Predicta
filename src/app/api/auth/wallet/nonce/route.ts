import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { ok, fail, route } from "@/lib/api";
import { buildWalletLoginMessage } from "@/lib/walletMessage";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const pubkey = req.nextUrl.searchParams.get("pubkey") ?? "";
  try {
    // Throws if not a valid base58 Solana address.
    new PublicKey(pubkey);
  } catch {
    return fail("Invalid wallet address", 422);
  }

  const nonce = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.walletNonce.create({ data: { pubkey, nonce, expiresAt } });

  return ok({ nonce, message: buildWalletLoginMessage(pubkey, nonce) });
});
