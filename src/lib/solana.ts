import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { createHash } from "crypto";
import {
  solanaRpcUrl,
  treasuryWallet,
  usdcMint,
  revertFeeLamports,
  revertFeeUsdcBase,
} from "./config";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

let connection: Connection | null = null;
export function getConnection(): Connection {
  if (!connection) connection = new Connection(solanaRpcUrl, "confirmed");
  return connection;
}

/** Verifies an ed25519 signature of `message` by `pubkey` (all base58 / utf8). */
export function verifyWalletSignature(
  pubkey: string,
  message: string,
  signatureBase58: string
): boolean {
  try {
    const pubkeyBytes = bs58.decode(pubkey);
    const sigBytes = bs58.decode(signatureBase58);
    const msgBytes = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
  } catch {
    return false;
  }
}

export interface PaymentVerification {
  ok: boolean;
  reason?: string;
  payer?: string;
}

/**
 * Confirms an on-chain payment of the revert fee to the treasury.
 * Checks the tx succeeded and moved at least the fee amount to the treasury.
 */
export async function verifyRevertPayment(
  signature: string,
  currency: "SOL" | "USDC"
): Promise<PaymentVerification> {
  if (!treasuryWallet) {
    return { ok: false, reason: "Payments are unavailable right now. Please try again later." };
  }
  const conn = getConnection();
  const tx = await conn.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx) return { ok: false, reason: "Transaction not found or not confirmed" };
  if (tx.meta?.err) return { ok: false, reason: "Transaction failed on-chain" };

  if (currency === "SOL") {
    return verifySolToTreasury(tx);
  }
  return verifyUsdcToTreasury(tx);
}

function verifySolToTreasury(
  tx: NonNullable<Awaited<ReturnType<Connection["getParsedTransaction"]>>>
): PaymentVerification {
  const treasury = treasuryWallet;
  const instructions = tx.transaction.message.instructions;
  for (const ix of instructions) {
    if ("parsed" in ix && ix.program === "system") {
      const parsed = ix.parsed as {
        type: string;
        info: { destination: string; lamports: number; source: string };
      };
      if (
        parsed.type === "transfer" &&
        parsed.info.destination === treasury &&
        parsed.info.lamports >= revertFeeLamports
      ) {
        return { ok: true, payer: parsed.info.source };
      }
    }
  }
  return {
    ok: false,
    reason: "No SOL transfer of the required amount to the treasury found",
  };
}

function verifyUsdcToTreasury(
  tx: NonNullable<Awaited<ReturnType<Connection["getParsedTransaction"]>>>
): PaymentVerification {
  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];

  const treasuryPost = post.find(
    (b) => b.owner === treasuryWallet && b.mint === usdcMint
  );
  if (!treasuryPost) {
    return { ok: false, reason: "No USDC received by the treasury" };
  }
  const treasuryPre = pre.find(
    (b) => b.owner === treasuryWallet && b.mint === usdcMint
  );
  const preAmount = BigInt(treasuryPre?.uiTokenAmount.amount ?? "0");
  const postAmount = BigInt(treasuryPost.uiTokenAmount.amount ?? "0");
  const delta = postAmount - preAmount;

  if (delta >= BigInt(revertFeeUsdcBase)) {
    // Best-effort payer: the owner whose balance decreased.
    const payer = pre.find(
      (b) =>
        b.mint === usdcMint &&
        b.owner !== treasuryWallet &&
        BigInt(b.uiTokenAmount.amount) >
          BigInt(
            post.find((p) => p.accountIndex === b.accountIndex)?.uiTokenAmount
              .amount ?? "0"
          )
    )?.owner;
    return { ok: true, payer: payer ?? undefined };
  }
  return {
    ok: false,
    reason: "USDC amount received is less than the required fee",
  };
}

function loadOracleKeypair(): Keypair | null {
  const raw = process.env.ORACLE_SECRET_KEY?.trim();
  if (!raw) return null;
  try {
    if (raw.startsWith("[")) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    return null;
  }
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Posts a result commitment (sha256 of the result JSON) on-chain via the Memo
 * program so anyone can verify the settled result was not altered.
 * Returns the tx signature, or null if no oracle signer is configured.
 */
export async function postResultCommitment(
  matchId: string,
  resultJson: string
): Promise<string | null> {
  const signer = loadOracleKeypair();
  if (!signer) return null;

  const hash = sha256Hex(resultJson);
  const memo = JSON.stringify({ t: "wc-result", matchId, sha256: hash });

  const ix = new TransactionInstruction({
    keys: [{ pubkey: signer.publicKey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf8"),
  });

  const tx = new Transaction().add(ix);
  const conn = getConnection();
  const sig = await sendAndConfirmTransaction(conn, tx, [signer], {
    commitment: "confirmed",
  });
  return sig;
}
