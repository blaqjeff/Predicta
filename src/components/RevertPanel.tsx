"use client";

import { useState } from "react";
import { api } from "@/lib/fetcher";
import { clientConfig } from "@/lib/clientConfig";
import { payRevertFeeSol, payRevertFeeUsdc } from "@/lib/solanaClient";

export function RevertPanel({
  predictionId,
  onClose,
  onUnlocked,
}: {
  predictionId: string;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const [busy, setBusy] = useState<"SOL" | "USDC" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function pay(currency: "SOL" | "USDC") {
    setError(null);
    setBusy(currency);
    try {
      setStatus("Confirm the payment in your wallet...");
      const txSignature =
        currency === "SOL" ? await payRevertFeeSol() : await payRevertFeeUsdc();
      setStatus("Verifying payment onchain...");
      await api("/api/revert", {
        method: "POST",
        body: JSON.stringify({ predictionId, currency, txSignature }),
      });
      setStatus("Unlocked! Saving your new pick...");
      onUnlocked();
    } catch (e) {
      setError((e as Error).message);
      setStatus(null);
    } finally {
      setBusy(null);
    }
  }

  const treasuryMissing = !clientConfig.treasuryWallet;

  return (
    <div className="mt-3 rounded-lg border border-[var(--accent-2)]/40 bg-[var(--accent-2)]/10 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Change this prediction</span>
        <button
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
      <p className="mb-3 text-xs text-[var(--muted)]">
        You already predicted this category. Pay a one-time revert fee to unlock a
        change. After the payment is verified onchain, your new pick is saved.
      </p>
      {treasuryMissing && (
        <p className="mb-2 text-xs text-amber-400">
          Revert payments are unavailable right now. Try again later.
        </p>
      )}
      <div className="flex gap-2">
        <button
          className="btn-accent2 px-3 py-1.5"
          disabled={Boolean(busy) || treasuryMissing}
          onClick={() => pay("SOL")}
        >
          {busy === "SOL" ? "..." : `Pay ${clientConfig.revertFeeSol} SOL`}
        </button>
        <button
          className="btn-ghost px-3 py-1.5"
          disabled={Boolean(busy) || treasuryMissing}
          onClick={() => pay("USDC")}
        >
          {busy === "USDC" ? "..." : `Pay ${clientConfig.revertFeeUsdc} USDC`}
        </button>
      </div>
      {status && <p className="mt-2 text-xs text-[var(--muted)]">{status}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
