// Anchor 合约 TypeScript 客户端模板
// 复制到 tests/ 下使用，或作为独立部署/交互脚本

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair, PublicKey, Connection,
  SYSVAR_RENT_PUBKEY, SYSVAR_CLOCK_PUBKEY,
  SystemProgram, Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

// ═══════════════════════════════════════════
// Configuration — adjust per project
// ═══════════════════════════════════════════

const PROGRAM_ID = new PublicKey("REPLACE_WITH_PROGRAM_ID");
const RPC_URL = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const STATE_SEED = Buffer.from("state");
const TREASURY_SEED = Buffer.from("treasury");
const MINT_SEED = Buffer.from("mint");

// ═══════════════════════════════════════════
// PDA Helpers
// ═══════════════════════════════════════════

function findStatePda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([STATE_SEED], PROGRAM_ID);
}

function findTreasuryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([TREASURY_SEED], PROGRAM_ID);
}

function findMintPda(tokenId: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(tokenId));
  return PublicKey.findProgramAddressSync([MINT_SEED, buf], PROGRAM_ID);
}

// ═══════════════════════════════════════════
// Connection & Signer
// ═══════════════════════════════════════════

async function getSigner(keypairPath?: string): Promise<Keypair> {
  if (keypairPath) {
    const raw = require("fs").readFileSync(keypairPath, "utf-8");
    const secretKey = new Uint8Array(JSON.parse(raw));
    return Keypair.fromSecretKey(secretKey);
  }
  // Fallback: use default Solana CLI keypair
  const home = require("os").homedir();
  const raw = require("fs").readFileSync(`${home}/.config/solana/id.json`, "utf-8");
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
}

// ═══════════════════════════════════════════
// Initialize State
// ═══════════════════════════════════════════

async function initialize(
  connection: Connection,
  payer: Keypair,
  params: {
    paymentMint: PublicKey;
    mintPrice: number; // in base units (e.g. 0.01 USDC = 10000)
    maxSupply: number;
    beneficiary: PublicKey;
  }
) {
  const [statePda] = findStatePda();

  console.log("Initializing...");
  console.log(`  Payer: ${payer.publicKey.toString()}`);
  console.log(`  State PDA: ${statePda.toString()}`);
  console.log(`  Payment Mint: ${params.paymentMint.toString()}`);
  console.log(`  Mint Price: ${params.mintPrice}`);
  console.log(`  Max Supply: ${params.maxSupply}`);
  console.log(`  Beneficiary: ${params.beneficiary.toString()}`);

  // If using Anchor-generated IDL:
  // const tx = await program.methods
  //   .initialize(params.paymentMint, new anchor.BN(params.mintPrice), new anchor.BN(params.maxSupply), params.beneficiary)
  //   .accounts({ state: statePda, authority: payer.publicKey })
  //   .rpc();

  // Manual tx for native programs:
  const ix = new anchor.web3.TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: statePda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: Buffer.alloc(0), // Fill with Borsh-encoded Initialize instruction
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], { commitment: "confirmed" });
  console.log(`  Signature: ${sig}`);
  return sig;
}

// ═══════════════════════════════════════════
// Mint NFT
// ═══════════════════════════════════════════

async function mint(
  connection: Connection,
  payer: Keypair,
  state: any // ProgramState fetched from chain
) {
  const [statePda] = findStatePda();
  const [treasuryPda] = findTreasuryPda();
  const tokenId = Number(state.totalMinted); // 0-based before mint
  const [mintPda] = findMintPda(tokenId);

  // Derive ATAs
  const payerTokenAta = await getAssociatedTokenAddress(state.paymentMint, payer.publicKey);
  const treasuryTokenAta = await getAssociatedTokenAddress(state.paymentMint, treasuryPda, true);
  const beneficiaryTokenAta = await getAssociatedTokenAddress(state.paymentMint, state.beneficiary);
  const nftAta = await getAssociatedTokenAddress(mintPda, payer.publicKey);

  // Ensure beneficiary ATA exists
  await getOrCreateAssociatedTokenAccount(connection, payer, state.paymentMint, state.beneficiary);

  const accounts = [
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: treasuryPda, isSigner: false, isWritable: false },
    { pubkey: state.paymentMint, isSigner: false, isWritable: false },
    { pubkey: payerTokenAta, isSigner: false, isWritable: true },
    { pubkey: treasuryTokenAta, isSigner: false, isWritable: true },
    { pubkey: beneficiaryTokenAta, isSigner: false, isWritable: true },
    { pubkey: mintPda, isSigner: false, isWritable: true },
    { pubkey: nftAta, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: state.beneficiary, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
  ];

  const mintData = Buffer.from([1]); // Mint = variant index 1

  const tx = new Transaction().add(
    new anchor.web3.TransactionInstruction({
      programId: PROGRAM_ID,
      keys: accounts,
      data: mintData,
    })
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
    skipPreflight: false,
  });

  console.log(`Mint #${tokenId + 1}: ${sig}`);
  return sig;
}

// ═══════════════════════════════════════════
// Read State
// ═══════════════════════════════════════════

async function readState(connection: Connection) {
  const [statePda] = findStatePda();
  const info = await connection.getAccountInfo(statePda, "confirmed");
  if (!info) {
    console.log("State PDA not found — contract not initialized.");
    return null;
  }
  // For Anchor programs, use program.account.state.fetch(statePda)
  // For native programs, manually deserialize via Borsh
  console.log(`State PDA: ${statePda.toString()}`);
  console.log(`Data length: ${info.data.length} bytes`);
  return info;
}

// ═══════════════════════════════════════════
// Batch Mint
// ═══════════════════════════════════════════

async function batchMint(
  connection: Connection,
  payer: Keypair,
  count: number,
  delayMs: number = 1000 // avoid RPC rate limiting
) {
  for (let i = 0; i < count; i++) {
    // Re-read state each time to get latest totalMinted
    const stateInfo = await readState(connection);
    if (!stateInfo) break;
    // TODO: deserialize state to get totalMinted
    // const state = deserializeState(stateInfo.data);
    // if (state.paused || state.totalMinted >= state.maxSupply) break;
    try {
      // await mint(connection, payer, state);
      console.log(`Batch mint #${i + 1}/${count} done`);
    } catch (err) {
      console.error(`Mint #${i + 1} failed:`, err);
    }
    if (i < count - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

// ═══════════════════════════════════════════
// CLI entry
// ═══════════════════════════════════════════

export {
  findStatePda, findTreasuryPda, findMintPda,
  initialize, mint, readState, batchMint,
  getSigner,
  PROGRAM_ID, STATE_SEED, TREASURY_SEED, MINT_SEED,
};
