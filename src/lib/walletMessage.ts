/** Canonical message a wallet signs to prove ownership. Shared by client + server. */
export function buildWalletLoginMessage(pubkey: string, nonce: string): string {
  return [
    "Sign in to World Cup Predictions",
    "",
    "This signature proves you own this wallet. No transaction or fee.",
    `Wallet: ${pubkey}`,
    `Nonce: ${nonce}`,
  ].join("\n");
}
