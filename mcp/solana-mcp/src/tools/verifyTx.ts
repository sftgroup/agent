import { execSync } from "child_process";
import { resolveKeypair, loadConfig } from "../config.js";

export interface VerifyTxInput {
  signature: string;
  network?: string;
}

export interface VerifyTxResult {
  signature: string;
  status: "confirmed" | "finalized" | "processed" | "not_found";
  slot: number;
  blockTime?: number;
  fee?: number;
  logs: string[]; // truncated to last 20 lines
  err?: string;
}

export async function verifyTx(input: VerifyTxInput): Promise<VerifyTxResult> {
  const cfg = loadConfig();
  const network = input.network ?? cfg.rpcUrl;

  // Use solana confirm
  let status: VerifyTxResult["status"] = "not_found";
  let slot = 0;
  let blockTime: number | undefined;
  let fee: number | undefined;
  let logs: string[] = [];
  let err: string | undefined;

  try {
    const confirmOut = execSync(
      `solana confirm "${input.signature}" --url "${network}" --output json 2>&1`,
      { timeout: 30_000 },
    )
      .toString()
      .trim();

    try {
      const c = JSON.parse(confirmOut);
      status = c.confirmationStatus ?? (c.slot ? "confirmed" : "not_found");
      slot = c.slot ?? 0;
      blockTime = c.blockTime;
      fee = c.fee;
      err = c.err ? JSON.stringify(c.err) : undefined;
    } catch {
      // text output
      if (
        confirmOut.includes("Confirmed") ||
        confirmOut.includes("Finalized")
      ) {
        status = "confirmed";
      } else if (confirmOut.includes("Processed")) {
        status = "processed";
      } else if (
        confirmOut.includes("Not found") ||
        confirmOut.includes("Unable to confirm")
      ) {
        status = "not_found";
      }
    }
  } catch {
    status = "not_found";
  }

  // Get transaction logs
  try {
    const txOut = execSync(
      `solana transaction "${input.signature}" --url "${network}" --output json 2>&1`,
      { timeout: 30_000 },
    )
      .toString()
      .trim();

    try {
      const t = JSON.parse(txOut);
      logs = (t.meta?.logMessages ?? []).slice(-20);
    } catch {
      const lines = txOut.split("\n");
      const logStart = lines.findIndex((l) => l.includes("Log Messages"));
      if (logStart >= 0) logs = lines.slice(logStart + 1).slice(-20);
    }
  } catch {
    /* ignore */
  }

  return {
    signature: input.signature,
    status,
    slot,
    blockTime,
    fee,
    logs,
    err,
  };
}
