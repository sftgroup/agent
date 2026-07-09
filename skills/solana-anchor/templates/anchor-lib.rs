// Anchor 合约初始化模板
// 基于 Anchor 框架，复制到 programs/<name>/src/ 下使用

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("REPLACE_WITH_YOUR_PROGRAM_ID");

// ─── Constants ───

pub const STATE_SEED: &[u8] = b"state";
pub const TREASURY_SEED: &[u8] = b"treasury";
pub const MINT_SEED: &[u8] = b"mint";
pub const TIMELOCK_DURATION: i64 = 86400; // 24 hours

// ─── Error ───

#[error_code]
pub enum ErrorCode {
    #[msg("Only the authority can perform this action")]
    Unauthorized,
    #[msg("Minting is paused")]
    Paused,
    #[msg("Max supply reached")]
    SoldOut,
    #[msg("Timelock has not expired")]
    TimelockNotExpired,
    #[msg("No pending change")]
    NoPendingChange,
    #[msg("Invalid beneficiary address")]
    InvalidBeneficiary,
    #[msg("Mint price must be non-zero")]
    InvalidMintPrice,
    #[msg("Max supply must be >= total minted")]
    InvalidMaxSupply,
}

// ─── State Account ───

#[account]
pub struct ProgramState {
    pub version: u8,
    pub authority: Pubkey,
    pub payment_mint: Pubkey,
    pub mint_price: u64,
    pub max_supply: u64,
    pub total_minted: u64,
    pub beneficiary: Pubkey,
    pub paused: bool,
    pub bump: u8,
    // Timelock — beneficiary
    pub pending_beneficiary: Pubkey,
    pub pending_beneficiary_deadline: i64,
}

impl ProgramState {
    pub const LEN: usize = 8 + 1 + 32 + 32 + 8 + 8 + 8 + 32 + 1 + 1 + 32 + 8;
}

// ─── Instructions ───

#[program]
pub mod my_program {
    use super::*;

    /// Initialize: creates state PDA
    pub fn initialize(
        ctx: Context<Initialize>,
        payment_mint: Pubkey,
        mint_price: u64,
        max_supply: u64,
        beneficiary: Pubkey,
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;
        require!(state.version == 0, ErrorCode::Unauthorized); // anti-reinit
        require!(mint_price > 0, ErrorCode::InvalidMintPrice);
        require!(max_supply > 0, ErrorCode::InvalidMaxSupply);
        require!(beneficiary != Pubkey::default(), ErrorCode::InvalidBeneficiary);

        state.version = 1;
        state.authority = ctx.accounts.authority.key();
        state.payment_mint = payment_mint;
        state.mint_price = mint_price;
        state.max_supply = max_supply;
        state.total_minted = 0;
        state.beneficiary = beneficiary;
        state.paused = false;
        state.bump = ctx.bumps.state;

        msg!("Initialized: authority={}", ctx.accounts.authority.key());
        Ok(())
    }

    /// Mint: pay SPL token → receive NFT
    pub fn mint(ctx: Context<Mint>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        require!(!state.paused, ErrorCode::Paused);
        require!(state.total_minted < state.max_supply, ErrorCode::SoldOut);

        // Step 1: transfer payment to treasury
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer_token.to_account_info(),
                    to: ctx.accounts.treasury_token.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            state.mint_price,
        )?;

        // Step 2: forward from treasury to beneficiary (treasury PDA signs)
        let treasury_seeds = &[TREASURY_SEED, &[ctx.bumps.treasury]];
        let signer_seeds = &[&treasury_seeds[..]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.treasury_token.to_account_info(),
                    to: ctx.accounts.beneficiary_token.to_account_info(),
                    authority: ctx.accounts.treasury.to_account_info(),
                },
                signer_seeds,
            ),
            state.mint_price,
        )?;

        // Step 3: mint NFT (pseudocode — extend with Metaplex if needed)
        // token::mint_to(...) here

        state.total_minted += 1;

        msg!("Minted: #{}/{}", state.total_minted, state.max_supply);
        Ok(())
    }

    /// Pause / unpause minting
    pub fn set_pause(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.paused = paused;
        msg!("Paused: {}", paused);
        Ok(())
    }

    /// Initiate beneficiary change (starts 24h timelock)
    pub fn initiate_beneficiary_change(ctx: Context<AdminOnly>, new_beneficiary: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.state;
        require!(new_beneficiary != Pubkey::default(), ErrorCode::InvalidBeneficiary);
        let clock = Clock::get()?;
        state.pending_beneficiary = new_beneficiary;
        state.pending_beneficiary_deadline = clock.unix_timestamp + TIMELOCK_DURATION;
        msg!("Beneficiary change initiated: {} (deadline +24h)", new_beneficiary);
        Ok(())
    }

    /// Cancel pending beneficiary change
    pub fn cancel_beneficiary_change(ctx: Context<AdminOnly>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        require!(state.pending_beneficiary != Pubkey::default(), ErrorCode::NoPendingChange);
        state.pending_beneficiary = Pubkey::default();
        state.pending_beneficiary_deadline = 0;
        msg!("Beneficiary change cancelled");
        Ok(())
    }

    /// Execute beneficiary change (anyone can call after deadline)
    pub fn execute_beneficiary_change(ctx: Context<ExecuteBeneficiary>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        require!(state.pending_beneficiary != Pubkey::default(), ErrorCode::NoPendingChange);
        let clock = Clock::get()?;
        require!(clock.unix_timestamp >= state.pending_beneficiary_deadline, ErrorCode::TimelockNotExpired);
        state.beneficiary = state.pending_beneficiary;
        state.pending_beneficiary = Pubkey::default();
        state.pending_beneficiary_deadline = 0;
        msg!("Beneficiary updated: {}", state.beneficiary);
        Ok(())
    }
}

// ─── Account Validators ───

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut, signer)]
    pub authority: AccountInfo<'info>,

    #[account(
        init,
        payer = authority,
        space = ProgramState::LEN,
        seeds = [STATE_SEED],
        bump,
    )]
    pub state: Account<'info, ProgramState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Mint<'info> {
    #[account(mut, signer)]
    pub payer: AccountInfo<'info>,

    #[account(mut, seeds = [STATE_SEED], bump = state.bump)]
    pub state: Account<'info, ProgramState>,

    /// CHECK: PDA, verified by seeds
    #[account(seeds = [TREASURY_SEED], bump)]
    pub treasury: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = state.payment_mint,
        associated_token::authority = payer,
    )]
    pub payer_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = state.payment_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = state.payment_mint,
        associated_token::authority = state.beneficiary,
    )]
    pub beneficiary_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(mut, signer)]
    pub authority: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [STATE_SEED],
        bump = state.bump,
        constraint = state.authority == *authority.key @ ErrorCode::Unauthorized,
    )]
    pub state: Account<'info, ProgramState>,
}

#[derive(Accounts)]
pub struct ExecuteBeneficiary<'info> {
    #[account(mut)]
    pub executor: Signer<'info>,

    #[account(mut, seeds = [STATE_SEED], bump = state.bump)]
    pub state: Account<'info, ProgramState>,
}
