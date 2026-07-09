#![no_std]
//! Sentinel — Stellar/Soroban crowdfunding contract.
//!
//! Flow:
//! 1. `initialize` — the owner sets the goal, deadline, token, and a
//!    Sentinel Registry contract address.
//! 2. `deposit`    — donors send real token (XLM) to the contract.
//! 3a. `claim`     — after the deadline, if the goal was REACHED, funds go to the owner.
//! 3b. `refund`    — after the deadline, if the goal was NOT reached, donors get refunded.
//!
//! After `claim`/`refund`, the campaign reports its final outcome to the
//! Sentinel Registry contract via a real **inter-contract call**
//! (`notify_registry`) and publishes an on-chain event — so the frontend can
//! listen to a real-time stream.
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, vec, Address, Env,
    IntoVal, Symbol, Val,
};

/// Storage keys.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Recipient,             // Address — campaign owner
    Token,                 // Address — donation token (native XLM SAC)
    Registry,              // Address — the Sentinel Registry contract to report results to
    Target,                // i128    — funding goal (stroops)
    Deadline,              // u64     — end time (unix seconds)
    Total,                 // i128    — total raised (stroops)
    Claimed,               // bool    — whether the owner withdrew the funds
    Contribution(Address), // i128    — per-donor contribution
}

/// Campaign status (numeric, for the frontend).
#[contracttype]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum State {
    Running = 0, // still accepting donations
    Success = 1, // ended, goal reached
    Failed = 2,  // ended, goal not reached
}

/// Error types.
#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    CampaignEnded = 3,   // deadline passed, donations closed
    CampaignRunning = 4, // deadline not reached yet, no claim/refund
    InvalidAmount = 5,
    GoalNotReached = 6, // goal wasn't met, claim not allowed
    GoalReached = 7,    // goal was met, no refunds
    AlreadyClaimed = 8,
    NothingToRefund = 9,
}

#[contract]
pub struct SentinelContract;

#[contractimpl]
impl SentinelContract {
    /// Sets up the campaign once.
    /// - `recipient`: the owner's wallet the funds go to.
    /// - `token`: the donation token (testnet native XLM SAC address).
    /// - `registry`: the Sentinel Registry contract to report results to.
    /// - `target`: the funding goal (stroops; 1 XLM = 10_000_000 stroops).
    /// - `deadline`: the end time (unix seconds).
    pub fn initialize(
        env: Env,
        recipient: Address,
        token: Address,
        registry: Address,
        target: i128,
        deadline: u64,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Recipient) {
            return Err(Error::AlreadyInitialized);
        }
        if target <= 0 {
            return Err(Error::InvalidAmount);
        }
        env.storage().instance().set(&DataKey::Recipient, &recipient);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Registry, &registry);
        env.storage().instance().set(&DataKey::Target, &target);
        env.storage().instance().set(&DataKey::Deadline, &deadline);
        env.storage().instance().set(&DataKey::Total, &0i128);
        env.storage().instance().set(&DataKey::Claimed, &false);
        env.storage().instance().extend_ttl(100, 200);
        Ok(())
    }

    /// Donates: transfers `amount` of the token from the donor to the contract.
    pub fn deposit(env: Env, donor: Address, amount: i128) -> Result<i128, Error> {
        Self::require_init(&env)?;
        donor.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if env.ledger().timestamp() >= Self::deadline(&env) {
            return Err(Error::CampaignEnded);
        }

        // Real token transfer: donor -> contract.
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token = token::Client::new(&env, &token_addr);
        token.transfer(&donor, &env.current_contract_address(), &amount);

        // Update the running total and the donor's own contribution.
        let mut total = Self::total(&env);
        total += amount;
        env.storage().instance().set(&DataKey::Total, &total);

        let key = DataKey::Contribution(donor.clone());
        let mut given: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        given += amount;
        env.storage().persistent().set(&key, &given);
        env.storage().persistent().extend_ttl(&key, 100, 200);
        env.storage().instance().extend_ttl(100, 200);

        env.events()
            .publish((symbol_short!("deposit"), donor), amount);

        Ok(total)
    }

    /// The owner withdraws all funds after the deadline, if the goal was reached.
    pub fn claim(env: Env) -> Result<i128, Error> {
        Self::require_init(&env)?;

        if env.ledger().timestamp() < Self::deadline(&env) {
            return Err(Error::CampaignRunning);
        }
        if Self::total(&env) < Self::target(&env) {
            return Err(Error::GoalNotReached);
        }
        if env.storage().instance().get(&DataKey::Claimed).unwrap_or(false) {
            return Err(Error::AlreadyClaimed);
        }

        let recipient: Address = env.storage().instance().get(&DataKey::Recipient).unwrap();
        recipient.require_auth();

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token = token::Client::new(&env, &token_addr);
        let balance = token.balance(&env.current_contract_address());
        token.transfer(&env.current_contract_address(), &recipient, &balance);

        env.storage().instance().set(&DataKey::Claimed, &true);
        env.storage().instance().extend_ttl(100, 200);

        env.events()
            .publish((symbol_short!("claim"), recipient.clone()), balance);
        Self::notify_registry(&env, &recipient, balance, Self::target(&env), true);

        Ok(balance)
    }

    /// A donor gets their contribution back after the deadline, if the goal wasn't reached.
    pub fn refund(env: Env, donor: Address) -> Result<i128, Error> {
        Self::require_init(&env)?;
        donor.require_auth();

        if env.ledger().timestamp() < Self::deadline(&env) {
            return Err(Error::CampaignRunning);
        }
        if Self::total(&env) >= Self::target(&env) {
            return Err(Error::GoalReached);
        }

        let key = DataKey::Contribution(donor.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount <= 0 {
            return Err(Error::NothingToRefund);
        }

        // Clear the record first (reentrancy guard), then transfer.
        env.storage().persistent().set(&key, &0i128);

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token = token::Client::new(&env, &token_addr);
        token.transfer(&env.current_contract_address(), &donor, &amount);

        env.events()
            .publish((symbol_short!("refund"), donor), amount);

        // The campaign has finally failed; notify the registry (idempotent —
        // even if every subsequent refund notifies it again, the registry
        // ignores repeats).
        let recipient: Address = env.storage().instance().get(&DataKey::Recipient).unwrap();
        Self::notify_registry(&env, &recipient, Self::total(&env), Self::target(&env), false);

        Ok(amount)
    }

    // ---------------- Read-only views ----------------

    pub fn get_state(env: Env) -> State {
        if !env.storage().instance().has(&DataKey::Recipient) {
            return State::Running;
        }
        if env.ledger().timestamp() < Self::deadline(&env) {
            State::Running
        } else if Self::total(&env) >= Self::target(&env) {
            State::Success
        } else {
            State::Failed
        }
    }

    pub fn get_total(env: Env) -> i128 {
        Self::total(&env)
    }

    pub fn get_target(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Target).unwrap_or(0)
    }

    pub fn get_deadline(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Deadline).unwrap_or(0)
    }

    pub fn get_recipient(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Recipient)
    }

    pub fn get_registry(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Registry)
    }

    pub fn get_contribution(env: Env, donor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(donor))
            .unwrap_or(0)
    }

    pub fn is_claimed(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Claimed).unwrap_or(false)
    }

    // ---------------- Helpers ----------------

    fn require_init(env: &Env) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Recipient) {
            Ok(())
        } else {
            Err(Error::NotInitialized)
        }
    }

    fn total(env: &Env) -> i128 {
        env.storage().instance().get(&DataKey::Total).unwrap_or(0)
    }

    fn target(env: &Env) -> i128 {
        env.storage().instance().get(&DataKey::Target).unwrap_or(0)
    }

    fn deadline(env: &Env) -> u64 {
        env.storage().instance().get(&DataKey::Deadline).unwrap_or(0)
    }

    /// Reports the final outcome to the Sentinel Registry contract via a real
    /// inter-contract call. The registry is called dynamically via
    /// `invoke_contract` instead of a statically resolved client, so this
    /// contract has no compile-time dependency on the registry's crate.
    fn notify_registry(env: &Env, recipient: &Address, total: i128, target: i128, success: bool) {
        let Some(registry): Option<Address> = env.storage().instance().get(&DataKey::Registry)
        else {
            return;
        };
        let this = env.current_contract_address();
        let args: soroban_sdk::Vec<Val> = vec![
            env,
            this.into_val(env),
            recipient.into_val(env),
            total.into_val(env),
            target.into_val(env),
            success.into_val(env),
        ];
        let _: () = env.invoke_contract(&registry, &Symbol::new(env, "record"), args);
    }
}

#[cfg(test)]
mod test;
