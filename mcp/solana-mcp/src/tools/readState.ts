import { execSync } from "child_process";
import { loadConfig } from "../config.js";
import { PublicKey } from "@solana/web3.js";

export interface ReadStateInput {
  programId: string;
  seed?: string; // default "state"
  network?: string;
}

export interface ReadStateResult {
  pda: string;
  bump: number;
  exists: boolean;
  space: number;
  lamports: number;
  executable: boolean;
  owner: string;
  ownerName?: string;
  dataHex: string;
}

export async function readState(
  input: ReadStateInput,
): Promise<ReadStateResult> {
  const cfg = loadConfig();
  const network = input.network ?? cfg.rpcUrl;

  // Derive PDA using web3.js
  const seed = input.seed ?? "state";
  const programId = new PublicKey(input.programId);
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(seed)],
    programId,
  );
  const pdaStr = pda.toString();

  // Get account info
  let parsed: any;
  try {
    const info = execSync(
      `solana account "${pdaStr}" --url "${network}" --output json 2>&1`,
    )
      .toString()
      .trim();
    parsed = JSON.parse(info);
  } catch {
    return {
      pda: pdaStr,
      bump,
      exists: false,
      space: 0,
      lamports: 0,
      executable: false,
      owner: "11111111111111111111111111111111",
      dataHex: "",
    };
  }

  // Get owner name
  let ownerName: string | undefined;
  if (parsed.owner === "BPFLoaderUpgradeab1e1111111111111111111111")
    ownerName = "BPF Upgradeable Loader";
  else if (parsed.owner === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    ownerName = "SPL Token";
  else if (parsed.owner === "11111111111111111111111111111111")
    ownerName = "System Program";

  return {
    pda: pdaStr,
    bump,
    exists: true,
    space: parsed.space ?? 0,
    lamports: parsed.lamports ?? 0,
    executable: parsed.executable ?? false,
    owner: parsed.owner ?? "",
    ownerName,
    dataHex: (parsed.data?.[0] ?? "").substring(0, 1024) || "",
  };
}
