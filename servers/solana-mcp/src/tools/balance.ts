import { execSync } from "child_process";
import { loadConfig, getRpcUrl } from "../config.js";

export interface BalanceInput {
  address?: string;    // default: default keypair public key
  network?: string;
}

export interface TokenBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  symbol?: string;
}

export interface BalanceResult {
  address: string;
  sol: number;             // SOL balance
  lamports: number;
  tokenAccounts: TokenBalance[];  // SPL token balances
}

export async function balance(input: BalanceInput): Promise<BalanceResult> {
  const cfg = loadConfig();
  const network = input.network ?? getRpcUrl();

  // Get address from keypair if not provided
  let address = input.address;
  if (!address) {
    const { Keypair } = await import("@solana/web3.js");
    const { readFileSync } = await import("fs");
    const kpRaw = readFileSync(cfg.keypairs.default, "utf-8");
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(kpRaw)));
    address = kp.publicKey.toString();
  }

  // SOL balance
  let sol = 0;
  let lamports = 0;
  try {
    const solOut = execSync(
      `solana balance "${address}" --url "${network}" 2>&1`
    ).toString().trim();
    const match = /([\d.]+)\s*SOL/.exec(solOut);
    if (match) sol = parseFloat(match[1]);
    lamports = Math.round(sol * 1_000_000_000);
  } catch { /* ignore */ }

  // SPL token balances
  let tokenAccounts: TokenBalance[] = [];
  try {
    const splOut = execSync(
      `spl-token accounts --owner "${address}" --url "${network}" --output json 2>&1`,
      { timeout: 30_000 }
    ).toString().trim();

    const data = JSON.parse(splOut);
    const accounts = data.accounts ?? data;
    tokenAccounts = (Array.isArray(accounts) ? accounts : []).map((a: any) => ({
      mint: a.mint ?? "",
      amount: a.tokenAmount?.amount ?? a.amount ?? "0",
      decimals: a.tokenAmount?.decimals ?? a.decimals ?? 0,
      uiAmount: a.tokenAmount?.uiAmount ?? a.uiAmount ?? 0,
      symbol: a.symbol ?? a.mint?.substring(0, 6),
    }));
  } catch {
    // Fallback: text parsing
    try {
      const splOut = execSync(
        `spl-token accounts --owner "${address}" --url "${network}" 2>&1`,
        { timeout: 30_000 }
      ).toString();

      const lines = splOut.split("\n");
      for (const line of lines) {
        const m = /([A-Za-z0-9]{32,44})\s+([\d.]+)/.exec(line);
        if (m) {
          tokenAccounts.push({ mint: m[1], amount: m[2], decimals: 0, uiAmount: parseFloat(m[2]) });
        }
      }
    } catch { /* ignore */ }
  }

  return { address, sol, lamports, tokenAccounts };
}
