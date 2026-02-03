use anchor_lang::prelude::*;

declare_id!("AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd"); // Will be replaced after deployment

#[program]
pub mod oracle {
    use super::*;

    /// Initialize the Oracle with an authority
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let oracle_state = &mut ctx.accounts.oracle_state;
        oracle_state.authority = ctx.accounts.authority.key();
        oracle_state.total_signals = 0;
        oracle_state.total_wins = 0;
        oracle_state.total_losses = 0;
        oracle_state.bump = ctx.bumps.oracle_state;
        
        msg!("ORACLE initialized with authority: {}", oracle_state.authority);
        Ok(())
    }

    /// Publish a new signal on-chain
    pub fn publish_signal(
        ctx: Context<PublishSignal>,
        token: Pubkey,
        symbol: String,
        score: u8,
        risk_level: u8,
        sources_bitmap: u8,
        mcap: u64,
        entry_price: u64,
    ) -> Result<()> {
        require!(symbol.len() <= 10, OracleError::SymbolTooLong);
        require!(score <= 100, OracleError::InvalidScore);
        
        let signal = &mut ctx.accounts.signal;
        let oracle_state = &mut ctx.accounts.oracle_state;
        
        signal.id = oracle_state.total_signals;
        signal.token = token;
        signal.symbol = symbol;
        signal.score = score;
        signal.risk_level = risk_level;
        signal.sources_bitmap = sources_bitmap;
        signal.mcap_at_signal = mcap;
        signal.entry_price = entry_price;
        signal.timestamp = Clock::get()?.unix_timestamp;
        signal.status = SignalStatus::Open;
        signal.ath_price = entry_price;
        signal.exit_price = 0;
        signal.roi_bps = 0;
        signal.bump = ctx.bumps.signal;
        
        oracle_state.total_signals += 1;
        
        emit!(SignalPublished {
            id: signal.id,
            token,
            score,
            timestamp: signal.timestamp,
        });
        
        msg!("Signal #{} published: {} with score {}", signal.id, signal.symbol, score);
        Ok(())
    }

    /// Update signal with ATH (for tracking)
    pub fn update_ath(
        ctx: Context<UpdateSignal>,
        new_ath: u64,
    ) -> Result<()> {
        let signal = &mut ctx.accounts.signal;
        
        if new_ath > signal.ath_price {
            signal.ath_price = new_ath;
            msg!("Signal #{} ATH updated to {}", signal.id, new_ath);
        }
        
        Ok(())
    }

    /// Close a signal (mark as win/loss)
    pub fn close_signal(
        ctx: Context<UpdateSignal>,
        exit_price: u64,
    ) -> Result<()> {
        let signal = &mut ctx.accounts.signal;
        let oracle_state = &mut ctx.accounts.oracle_state;
        
        require!(signal.status == SignalStatus::Open, OracleError::SignalAlreadyClosed);
        
        signal.exit_price = exit_price;
        
        // Calculate ROI in basis points (1 bps = 0.01%)
        if signal.entry_price > 0 {
            let roi = ((exit_price as i128 - signal.entry_price as i128) * 10000) 
                / signal.entry_price as i128;
            signal.roi_bps = roi as i64;
        }
        
        // Determine win/loss (win = 50%+ gain)
        if signal.roi_bps >= 5000 {
            signal.status = SignalStatus::Win;
            oracle_state.total_wins += 1;
        } else if signal.roi_bps < 0 {
            signal.status = SignalStatus::Loss;
            oracle_state.total_losses += 1;
        } else {
            signal.status = SignalStatus::Closed;
        }
        
        emit!(SignalClosed {
            id: signal.id,
            status: signal.status,
            roi_bps: signal.roi_bps,
        });
        
        msg!("Signal #{} closed with ROI: {}bps", signal.id, signal.roi_bps);
        Ok(())
    }
}

// === ACCOUNTS ===

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + OracleState::INIT_SPACE,
        seeds = [b"oracle_state"],
        bump
    )]
    pub oracle_state: Account<'info, OracleState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(token: Pubkey)]
pub struct PublishSignal<'info> {
    #[account(
        mut,
        seeds = [b"oracle_state"],
        bump = oracle_state.bump
    )]
    pub oracle_state: Account<'info, OracleState>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + Signal::INIT_SPACE,
        seeds = [b"signal", oracle_state.total_signals.to_le_bytes().as_ref()],
        bump
    )]
    pub signal: Account<'info, Signal>,
    
    #[account(
        mut,
        constraint = authority.key() == oracle_state.authority @ OracleError::Unauthorized
    )]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateSignal<'info> {
    #[account(
        mut,
        seeds = [b"oracle_state"],
        bump = oracle_state.bump
    )]
    pub oracle_state: Account<'info, OracleState>,
    
    #[account(mut)]
    pub signal: Account<'info, Signal>,
    
    #[account(
        constraint = authority.key() == oracle_state.authority @ OracleError::Unauthorized
    )]
    pub authority: Signer<'info>,
}

// === STATE ===

#[account]
#[derive(InitSpace)]
pub struct OracleState {
    pub authority: Pubkey,
    pub total_signals: u64,
    pub total_wins: u64,
    pub total_losses: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Signal {
    pub id: u64,
    pub token: Pubkey,
    #[max_len(10)]
    pub symbol: String,
    pub score: u8,
    pub risk_level: u8,
    pub sources_bitmap: u8,      // Bitmap of signal sources
    pub mcap_at_signal: u64,
    pub entry_price: u64,
    pub ath_price: u64,
    pub exit_price: u64,
    pub roi_bps: i64,            // ROI in basis points (can be negative)
    pub timestamp: i64,
    pub status: SignalStatus,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum SignalStatus {
    Open,
    Win,
    Loss,
    Closed,
}

// === EVENTS ===

#[event]
pub struct SignalPublished {
    pub id: u64,
    pub token: Pubkey,
    pub score: u8,
    pub timestamp: i64,
}

#[event]
pub struct SignalClosed {
    pub id: u64,
    pub status: SignalStatus,
    pub roi_bps: i64,
}

// === ERRORS ===

#[error_code]
pub enum OracleError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Symbol too long (max 10 chars)")]
    SymbolTooLong,
    #[msg("Invalid score (must be 0-100)")]
    InvalidScore,
    #[msg("Signal already closed")]
    SignalAlreadyClosed,
}
