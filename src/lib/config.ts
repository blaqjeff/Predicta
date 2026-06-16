/**
 * Centralized config. NEXT_PUBLIC_* values are safe to read on the client.
 */

export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const solanaCluster =
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "mainnet-beta";

export const solanaRpcUrlPublic =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

// Server-only RPC (falls back to the public one).
export const solanaRpcUrl =
  process.env.SOLANA_RPC_URL ?? solanaRpcUrlPublic;

export const solanaClusterLabel =
  solanaCluster === "mainnet-beta" || solanaCluster === "mainnet"
    ? "Mainnet"
    : solanaCluster === "devnet"
      ? "Devnet"
      : solanaCluster;

export const treasuryWallet = process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "";

/** Native USDC on Solana mainnet. */
export const usdcMint =
  process.env.NEXT_PUBLIC_USDC_MINT ??
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const revertFeeSol = parseFloat(
  process.env.NEXT_PUBLIC_REVERT_FEE_SOL ?? "0.0068"
);

export const revertFeeUsdc = parseFloat(
  process.env.NEXT_PUBLIC_REVERT_FEE_USDC ?? "0.5"
);

export const LAMPORTS_PER_SOL = 1_000_000_000;
export const USDC_DECIMALS = 6;

/** Revert fee expressed in raw on-chain base units. */
export const revertFeeLamports = Math.round(revertFeeSol * LAMPORTS_PER_SOL);
export const revertFeeUsdcBase = Math.round(
  revertFeeUsdc * 10 ** USDC_DECIMALS
);

export const SESSION_COOKIE = "wc_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
