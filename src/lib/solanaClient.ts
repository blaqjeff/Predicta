"use client";

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import bs58 from "bs58";
import {
  clientConfig,
  LAMPORTS_PER_SOL,
  USDC_DECIMALS,
} from "./clientConfig";

interface SolanaProvider {
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(
    message: Uint8Array,
    encoding?: string
  ): Promise<{ signature: Uint8Array }>;
  signAndSendTransaction(
    tx: Transaction
  ): Promise<{ signature: string }>;
}

export function getProvider(): SolanaProvider {
  const w = window as unknown as {
    solana?: SolanaProvider;
    backpack?: SolanaProvider;
  };
  const provider = w.solana ?? w.backpack;
  if (!provider) {
    throw new Error(
      "No Solana wallet found. Install Phantom or another Solana wallet."
    );
  }
  return provider;
}

export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  const res = await provider.connect();
  return res.publicKey.toString();
}

export async function signLoginMessage(message: string): Promise<string> {
  const provider = getProvider();
  const encoded = new TextEncoder().encode(message);
  const { signature } = await provider.signMessage(encoded, "utf8");
  return bs58.encode(signature);
}

function connection(): Connection {
  return new Connection(clientConfig.rpcUrl, "confirmed");
}

export async function payRevertFeeSol(): Promise<string> {
  if (!clientConfig.treasuryWallet) {
    throw new Error("Treasury wallet is not configured");
  }
  const provider = getProvider();
  const from = new PublicKey(await connectWallet());
  const conn = connection();

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: new PublicKey(clientConfig.treasuryWallet),
      lamports: Math.round(clientConfig.revertFeeSol * LAMPORTS_PER_SOL),
    })
  );
  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = from;

  const { signature } = await provider.signAndSendTransaction(tx);
  await conn.confirmTransaction(signature, "confirmed");
  return signature;
}

export async function payRevertFeeUsdc(): Promise<string> {
  if (!clientConfig.treasuryWallet) {
    throw new Error("Treasury wallet is not configured");
  }
  const provider = getProvider();
  const from = new PublicKey(await connectWallet());
  const conn = connection();
  const mint = new PublicKey(clientConfig.usdcMint);
  const treasury = new PublicKey(clientConfig.treasuryWallet);

  const fromAta = await getAssociatedTokenAddress(mint, from);
  const toAta = await getAssociatedTokenAddress(mint, treasury);

  const tx = new Transaction();

  // Create the treasury's token account if it doesn't exist yet.
  const toInfo = await conn.getAccountInfo(toAta);
  if (!toInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(from, toAta, treasury, mint)
    );
  }

  tx.add(
    createTransferInstruction(
      fromAta,
      toAta,
      from,
      Math.round(clientConfig.revertFeeUsdc * 10 ** USDC_DECIMALS)
    )
  );

  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = from;

  const { signature } = await provider.signAndSendTransaction(tx);
  await conn.confirmTransaction(signature, "confirmed");
  return signature;
}
