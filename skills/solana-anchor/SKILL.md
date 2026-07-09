---
name: solana-anchor
description: "Solana Anchor framework: SBF compilation, PDA/Timelock/SPL Token patterns, deploy, debug, and mainnet safety."
user-invocable: true
metadata: { "openclaw": { "requires": { "bins": ["solana", "cargo"], "anyBins": ["cargo-build-sbf"] }, "os": ["linux"] } }
---

# Solana Anchor 合约开发 Skill

> 基于 Contra AI NFT 合约编译部署实战总结。适用 Anchor 框架及原生 Solana 程序。本机工具链：Solana CLI 2.3.3, platform-tools v1.48, Node v22。

---

## Toolchain & Edition Compatibility

**SBF 编译器内嵌 rustc 版本限制** — `cargo build-sbf` 工具链取决于 Solana CLI 版本：

| agave-install | platform-tools | rustc | edition2024 |
|---------------|----------------|-------|-------------|
| 2.1.0 | v1.43 | 1.79 | ❌ |
| 2.3.3 | v1.48 | 1.84 | ❌ |
| 2.3.3 + manual replace | v1.54 | 1.89.0-dev | ✅ (unofficial) |

Fix strategy: use `edition = "2021"` for all contracts. If dependencies require edition2024, downgrade to compatible versions.

**Emergency platform-tools swap:**

```bash
wget https://github.com/godmode-investments/platform-tools/releases/download/v1.54/platform-tools-linux-x86_64.tar.bz2
mkdir -p ~/.cache/solana/v1.54
tar -xjf platform-tools-linux-x86_64.tar.bz2 -C ~/.cache/solana/v1.54/
rm -rf ~/.cache/solana/v1.48 && ln -sf ~/.cache/solana/v1.54 ~/.cache/solana/v1.48
```

---

## Cargo.toml Release Profile

```toml
[profile.release]
overflow-checks = true   # critical for arithmetic safety
lto = true               # shrink .so
codegen-units = 1        # better optimization
```

---

## PDA Design Pattern

Use deterministic seeds for all program-derived accounts:

```rust
pub const STATE_SEED: &[u8] = b"state";
pub const TREASURY_SEED: &[u8] = b"treasury";
pub const MINT_SEED: &[u8] = b"mint";

let (state_pda, bump) = Pubkey::find_program_address(&[STATE_SEED], program_id);
let (mint_pda, bump) = Pubkey::find_program_address(
    &[MINT_SEED, &token_id.to_le_bytes()], program_id,
);
```

- State: singleton PDA for all config (`b"state"` seed)
- Treasury: singleton PDA for intermediate fund holding
- Per-token: individual PDA per `token_id`

---

## Account Struct Design

**Chain-determined size** preferred over `String` — use `[u8; N]` arrays with explicit `LEN`:

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct ProgramState {
    pub version: u8,          // anti-reinit
    pub authority: Pubkey,
    pub payment_mint: Pubkey,
    pub mint_price: u64,
    pub max_supply: u64,
    pub total_minted: u64,
    pub treasury: Pubkey,
    pub beneficiary: Pubkey,
    pub base_uri: [u8; 128],  // fixed size, not String
    pub base_uri_len: u8,
    pub paused: bool,
    pub bump: u8,
    // Timelock fields at the end
    pub pending_owner: Pubkey,
    pub pending_owner_deadline: i64,
    // ... more pending fields
}

impl ProgramState {
    pub const LEN: usize = 1 + 32 + 32 + 8 + 8 + 8 + 32 + 32 + 128 + 1 + 1 + 1 + 32 + 8 + /* ... */;
}
```

For Anchor projects, use `#[account]` + `#[derive(InitSpace)]` for automatic space calculation.

---

## Timelock Pattern (24h Three-Step)

Sensitive changes get a 24-hour delay:

```rust
pub const TIMELOCK_DURATION: i64 = 86400;

// Step 1 — Initiate (authority only):
state.pending_beneficiary = new_beneficiary;
state.pending_beneficiary_deadline = clock.unix_timestamp + TIMELOCK_DURATION;

// Step 2 — Cancel (authority only, before deadline):
state.pending_beneficiary = Pubkey::default();

// Step 3 — Execute (anyone, after deadline):
require!(clock.unix_timestamp >= deadline, Error::TimelockNotExpired);
state.beneficiary = state.pending_beneficiary;
```

Items with timelock: owner, beneficiary, treasury, max_supply, payment_mint, mint_price.
Items without: pause/unpause, base_uri.

---

## SPL Token Payment Flow

Two-hop transfer pattern (payer → treasury PDA → beneficiary):

```rust
// Hop 1: payer → treasury (user signs)
spl_token::transfer(
    payer_token, treasury_token, payer, &[],
    state.mint_price,
)?;

// Hop 2: treasury → beneficiary (PDA signs)
invoke_signed(
    &transfer_ix,
    &[treasury_token, beneficiary_token, treasury_pda, token_program],
    &[&[TREASURY_SEED, &[treasury_bump]]],
)?;
```

Create ATAs on-chain when they don't exist yet (include rent sysvar in invoke accounts).

---

## Anchor Account Validation

```rust
#[derive(Accounts)]
pub struct MintAccounts<'info> {
    #[account(mut, seeds = [b"state"], bump = state.bump)]
    pub state: Account<'info, ProgramState>,

    #[account(mut, associated_token::mint = state.payment_mint, associated_token::authority = payer)]
    pub payer_token: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = state.payment_mint, associated_token::authority = treasury_pda)]
    pub treasury_token: Account<'info, TokenAccount>,
}
```

For native programs, validate every account explicitly:

```rust
require!(token_program.key == spl_token::id(), Error::InvalidProgram);
require!(payer_token.key == expected_ata, Error::InvalidToken);
require!(nft_mint.key == expected_mint_pda, Error::InvalidMint);
```

---

## Build & Deploy

**Build:**

```bash
cd project && cargo build-sbf --sbf-out-dir target/deploy
# or: anchor build
```

**Deploy (upgrade):**

```bash
solana program deploy target/deploy/contract.so \
  --program-id <PROGRAM_ID> \
  --keypair /path/to/deployer.json
```

**Fees:**

- First deploy: ~1.1 SOL
- Upgrade: ~0.03 SOL (old buffer rent refunded)
- Init state account: ~0.0014 SOL
- Single tx: ~0.000005 SOL
- Mint NFT (15-account ix): ~0.00002 SOL

**Pre-deploy checklist:**

- edition = "2021" in Cargo.toml
- Build passes clean (no warnings — SBF is sensitive)
- Tests pass
- Program keypair backed up
- Wallet has ≥ 1.2 SOL (first) / 0.05 SOL (upgrade)
- Upgrade-compatible: no field reordering, new fields at end with defaults

---

## Bug Diagnosis Quick Reference

| Symptom | Likely Cause |
|---------|-------------|
| `unknown account` / `InvalidSeeds` | Wrong PDA seeds or account order in invoke |
| `missing required signature` | invoke_signed used wrong PDA seeds for the signer account |
| `InvalidAccountData` | Wrong account size (e.g. Account::LEN=165 vs Mint::LEN=82) |
| `rent-exempt` failure | Missing lamports or wrong space in create_account |
| `IncorrectProgramId` | Wrong token/ATA program ID in accounts |
| `AccountNotInitialized` | ATA doesn't exist — create it first in the same transaction |

**Real bugs encountered:**

1. **invoke_signed signer mismatch**: passed `state_info` as signer for treasury PDA seeds. Fix: use correct `treasury_pda_info` account with matching seeds.
2. **Missing rent sysvar in create_ata**: `create_associated_token_account` invoke needs `[payer, ata, owner, mint, system, token, rent, ata_program]`.
3. **Wrong space constant**: `spl_token::state::Account::LEN` (165) vs `spl_token::state::Mint::LEN` (82) for mint accounts.
4. **mint_to signer**: must use mint PDA seeds, not state PDA seeds.

---

## Client (TypeScript)

**Anchor:**

```ts
const program = new Program(IDL, PROGRAM_ID, { connection });
await program.methods.mint().accounts({ state, payer: wallet.publicKey, /* ... */ }).rpc();
```

**Native web3.js:**

```ts
const ix = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [ /* 15 accounts in exact order */ ],
  data: Buffer.from([1]), // variant index for Mint
});
const tx = new Transaction().add(ix);
tx.feePayer = payer.pubkey;
tx.recentBlockhash = (await conn.getLatestBlockhash("processed")).blockhash;
tx.sign(payerKeypair);
const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
```

**Batch mint:** re-read state before each mint (get latest token_id), 1s pause between txs to avoid RPC rate limiting.

**Read state (Anchor):**

```ts
const state = await program.account.programState.fetch(statePda);
```

---

## Security Checklist

- Re-init prevention: check `state.version > 0` before initialize
- Authority-only gating: `require!(signer == state.authority)`
- PDA verification for every account: compare computed vs actual
- Token/ATA program ID checks: `require!(key == spl_token::id())`
- Timelock on owner/treasury/beneficiary/max_supply/mint_price/payment_mint
- Pause switch for emergency
- Zero-address rejection: `require!(key != Pubkey::default())`
- Decimals awareness: prices in base units (USDC: 1e6 per token)
- Rent-exempt on all account creation: `Rent::get()? + minimum_balance(len)`
- CPI account order correctness
- Upgrade safety: append-only fields, no layout reorder
- Keypair: never in repo, backup offline
- Rate limit: ≥ 1s between batch RPC calls

---

## Environment (VM-0-2-ubuntu)

- Solana CLI: 2.3.3 (Agave), installed versions: 2.1.0, 2.2.0, 2.2.20, 2.3.0, 2.3.3
- SBF: `cargo build-sbf 2.3.3`, platform-tools v1.48 (replaceable → v1.54)
- Rust: nightly-2025-07-01 + stable (`~/.rustup/toolchains/`)
- Node: v22.23.0 (nvm)
- Reference project: `/home/ubuntu/contra-ai-solana/` (native Solana, non-Anchor, 18 instr, Borsh)

---

## Scripts & Templates

Executable scripts in `scripts/`:

- `scripts/solana-build-deploy.sh` — one-shot build + upgrade deploy with safety checks
- `scripts/solana-verify-state.sh` — read on-chain contract state

Code templates in `templates/`:

- `templates/anchor-lib.rs` — full Anchor contract skeleton (state, mint, timelock, pause)
- `templates/client.ts` — TypeScript client (init, mint, read state, batch mint)
