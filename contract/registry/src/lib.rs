#![no_std]
//! Sentinel Registry — an independent contract that records the final
//! (claim/refund) outcome of campaign contracts.
//!
//! `sentinel-contract` (the campaign contract) calls this contract after
//! `claim`/`refund` via a real **inter-contract call** (`env.invoke_contract`).
//! Recording is idempotent: a second call for the same campaign is ignored, so
//! the campaign contract is free to report repeatedly (e.g. on every `refund` call).
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

#[contracttype]
#[derive(Clone)]
pub struct CampaignResult {
    pub recipient: Address,
    pub total: i128,
    pub target: i128,
    pub success: bool,
    pub reported_at: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Result(Address), // campaign contract address -> result
    Count,
}

#[contract]
pub struct SentinelRegistry;

#[contractimpl]
impl SentinelRegistry {
    /// A Sentinel campaign contract records its own final outcome here.
    /// `campaign` is the calling contract's own address; `require_auth` here
    /// verifies the identity of the calling contract (contract-to-contract auth).
    pub fn record(
        env: Env,
        campaign: Address,
        recipient: Address,
        total: i128,
        target: i128,
        success: bool,
    ) {
        campaign.require_auth();

        let key = DataKey::Result(campaign.clone());
        if env.storage().persistent().has(&key) {
            return; // idempotent: the first record wins
        }

        let result = CampaignResult {
            recipient,
            total,
            target,
            success,
            reported_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&key, &result);
        env.storage().persistent().extend_ttl(&key, 100, 200);

        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        env.storage().instance().set(&DataKey::Count, &(count + 1));
        env.storage().instance().extend_ttl(100, 200);

        env.events()
            .publish((symbol_short!("logged"), campaign), (success, total));
    }

    pub fn get_result(env: Env, campaign: Address) -> Option<CampaignResult> {
        env.storage().persistent().get(&DataKey::Result(campaign))
    }

    pub fn count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
