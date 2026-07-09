import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { appendHistory, loadConfig, resolveKeypair } from "../config.js";

export interface DeployInput {
  soPath: string;          // absolute path to .so
  programId: string;       // target program ID
  keypairName?: string;    // key from config.keypairs (default: "default")
  network?: string;        // "mainnet-beta" (default) | "devnet" | "testnet" | custom URL
}

export interface DeployResult {
  signature: string;
  programId: string;
  programSize: number;
  slot: number;
  fee: number;             // lamports
}

export async function deploy(input: DeployInput): Promise<DeployResult> {
  const cfg = loadConfig();
  const network = input.network ?? cfg.rpcUrl;
  const soPath = resolve(input.soPath);

  if (!existsSync(soPath)) throw new Error(`SO file not found: ${soPath}`);

  const keypair = resolveKeypair(input.keypairName ?? "default");
  const kpPath = `(from config keypairs.${input.keypairName ?? "default"})`;

  const cmd = [
    "solana program deploy",
    `"${soPath}"`,
    `--program-id ${input.programId}`,
    `--keypair /dev/stdin`,
    `--url "${network}"`,
    `--with-compute-unit-price 0`,
    `2>&1`,
  ].join(" ");

  console.log(`[deploy] ${cmd} ${kpPath}`);

  let output: string;
  try {
    output = execSync(
      `echo '${JSON.stringify(Array.from(keypair))}' | solana program deploy "${soPath}" --program-id ${input.programId} --keypair /dev/stdin --url "${network}" --with-compute-unit-price 0 2>&1`,
      { timeout: 180_000, maxBuffer: 10 * 1024 * 1024 }
    ).toString();
  } catch (e: any) {
    const errMsg = e.stderr?.toString() ?? e.stdout?.toString() ?? e.message;
    appendHistory({ timestamp: new Date().toISOString(), tool: "deploy", programId: input.programId, status: "fail", details: errMsg.substring(0, 500) });
    throw new Error(`Deploy failed: ${errMsg.substring(0, 1000)}`);
  }

  console.log(`[deploy] output:`, output);

  // Extract signature
  const sigMatch = /Signature: (\S+)/.exec(output) ?? /signature: (\S+)/i.exec(output) ?? /txid (\S+)/i.exec(output);
  const signature = sigMatch?.[1] ?? "unknown";

  // Get slot
  let slot = 0;
  try {
    const slotOut = execSync(`solana slot --url "${network}"`).toString().trim();
    slot = parseInt(slotOut, 10);
  } catch { /* ignore */ }

  // Get program size
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
    fee: 0, // solana doesn't easily expose this for deploying
  };
}
