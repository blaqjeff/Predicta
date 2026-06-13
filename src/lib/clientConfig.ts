/** Browser-safe config sourced from NEXT_PUBLIC_* env (inlined at build time). */
export const clientConfig = {
  cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
  rpcUrl:
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  treasuryWallet: process.env.NEXT_PUBLIC_TREASURY_WALLET ?? "",
  usdcMint:
    process.env.NEXT_PUBLIC_USDC_MINT ??
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  revertFeeSol: parseFloat(process.env.NEXT_PUBLIC_REVERT_FEE_SOL ?? "0.0035"),
  revertFeeUsdc: parseFloat(process.env.NEXT_PUBLIC_REVERT_FEE_USDC ?? "0.5"),
};

export const LAMPORTS_PER_SOL = 1_000_000_000;
export const USDC_DECIMALS = 6;
