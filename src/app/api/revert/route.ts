import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { verifyRevertPayment } from "@/lib/solana";
import { revertFeeLamports, revertFeeUsdcBase } from "@/lib/config";
import { isPredictionLocked, isPredictionOpen } from "@/lib/predictionWindow";

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await req.json();
  const predictionId = String(body.predictionId ?? "");
  const currency = String(body.currency ?? "").toUpperCase();
  const txSignature = String(body.txSignature ?? "");

  if (currency !== "SOL" && currency !== "USDC") {
    return fail("currency must be SOL or USDC", 422);
  }
  if (!predictionId || !txSignature) {
    return fail("predictionId and txSignature are required", 422);
  }

  const prediction = await prisma.prediction.findUnique({
    where: { id: predictionId },
    include: { match: true },
  });
  if (!prediction || prediction.userId !== user.id) {
    return fail("Prediction not found", 404);
  }
  if (prediction.status === "settled") {
    return fail("This prediction is already settled", 409);
  }
  if (isPredictionLocked(prediction.match.kickoffAt)) {
    return fail("This match has kicked off; predictions are locked", 423);
  }
  if (!isPredictionOpen(prediction.match.kickoffAt)) {
    return fail("Predictions are not open yet for this match", 423);
  }

  // Reject reused transactions.
  const seen = await prisma.revertPayment.findUnique({ where: { txSignature } });
  if (seen) return fail("This transaction was already used", 409);

  const verification = await verifyRevertPayment(txSignature, currency);
  if (!verification.ok) {
    return fail(verification.reason ?? "Payment could not be verified", 402);
  }

  await prisma.$transaction([
    prisma.revertPayment.create({
      data: {
        predictionId,
        userId: user.id,
        currency,
        txSignature,
        amount: String(currency === "SOL" ? revertFeeLamports : revertFeeUsdcBase),
        verifiedAt: new Date(),
      },
    }),
    prisma.prediction.update({
      where: { id: predictionId },
      data: { editUnlocked: true },
    }),
  ]);

  return ok({ unlocked: true });
});
