import { execSync } from "child_process";
import { existsSync, writeFileSync, unlinkSync } from "fs";
import { resolve, join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { appendHistory, loadConfig, resolveKeypair, getRpcUrl } from "../config.js";

export interface DeployInput {
  soPath: string;
  programId: string;
  keypairName?: string;
  network?: string;
}

export interface DeployResult {
  signature: string;
  programId: string;
  programSize: number;
  slot: number;
  fee: number;
}

export async function deploy(input: DeployInput): Promise<DeployResult> {
  const cfg = loadConfig();
  const network = input.network ?? getRpcUrl();
  const soPath = resolve(input.soPath);

  if (!existsSync(soPath)) throw new Error(`SO file not found: ${soPath}`);

  const keypair = resolveKeypair(input.keypairName ?? "default");

  // Write keypair to temp file (never echo to stdin — avoids process list leak)
  const kpFile = join(tmpdir(), `solana-mcp-kp-${randomUUID().substring(0, 8)}.json`);
  writeFileSync(kpFile, JSON.stringify(Array.from(keypair)), { mode: 0o600 });

  let output: string;
  try {
    output = execSync(
      `solana program deploy "${soPath}" --program-id ${input.programId} --keypair "${kpFile}" --url "${network}" --with-compute-unit-price 0 2>&1`,
      { timeout: 180_000, maxBuffer: 10 * 1024 * 1024 }
    ).toString();
  } catch (e: any) {
    try { unlinkSync(kpFile); } catch { /* already gone */ }
    const errMsg = e.stderr?.toString() ?? e.stdout?.toString() ?? e.message;
    appendHistory({ timestamp: new Date().toISOString(), tool: "deploy", programId: input.programId, status: "fail", details: errMsg.substring(0, 500) });
    throw new Error(`Deploy failed: ${errMsg.substring(0, 1000)}`);
  }

  // Clean up keypair file immediately
  try { unlinkSync(kpFile); } catch { /* gone */ }

  // Extract signature
  const sigMatch = /Signature: (\S+)/.exec(output) ?? /signature: (\S+)/i.exec(output) ?? /txid (\S+)/i.exec(output);
  const signature = sigMatch?.[1] ?? "unknown";

  // Get slot
  let slot = 0;
  try {
    const slotOut = execSync(`solana slot --url "${network}"`).toString().trim();
    slot = parseInt(slotOut, 10);
  } catch { /* ignore */ }

  const sizeBytes = execSync(`stat -c%s "${soPath}"`).toString().trim();

  appendHistory({
    timestamp: new Date().toISOString(),
    tool: "deploy",
    programId: input.programId,
    signature,
    status: "ok",
    details: `size=${sizeBytes}B slot=${slot}`,
  });

  return {
    signature,
    programId: input.programId,
    programSize: Number(sizeBytes),
    slot,
    fee: 0,
  };
}
