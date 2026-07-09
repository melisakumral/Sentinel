#![no_std]
//! Sentinel — Stellar/Soroban Crowdfunding (kitle fonlama) sözleşmesi.
//!
//! Akış:
//! 1. `initialize` — sahip; hedef tutar, son tarih (deadline) ve token'ı belirler.
//! 2. `deposit`    — bağışçılar sözleşmeye gerçek token (XLM) gönderir.
//! 3a. `claim`     — deadline sonrası hedefe ULAŞILDIYSA fonlar sahibe aktarılır.
//! 3b. `refund`    — deadline sonrası hedefe ULAŞILAMADIYSA bağışçı parasını geri alır.
use soroban_sdk::{contract, contractimpl, contracterror, contracttype, token, Address, Env};

/// Depolama anahtarları.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Recipient,             // Address — kampanya sahibi
    Token,                 // Address — bağış token'ı (native XLM SAC)
    Target,                // i128    — hedef tutar (stroop)
    Deadline,              // u64     — bitiş zamanı (unix saniye)
    Total,                 // i128    — toplanan toplam (stroop)
    Claimed,               // bool    — sahip fonları çekti mi
    Contribution(Address), // i128    — bağışçı bazlı katkı
}

/// Kampanya durumu (frontend için sayısal).
#[contracttype]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum State {
    Running = 0, // süre devam ediyor
    Success = 1, // süre bitti, hedefe ulaşıldı
    Failed = 2,  // süre bitti, hedefe ulaşılamadı
}

/// Hata tipleri.
#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    CampaignEnded = 3,     // deadline geçti, bağış kapalı
    CampaignRunning = 4,   // deadline gelmedi, claim/refund yok
    InvalidAmount = 5,
    GoalNotReached = 6,    // claim için hedef tutmadı
    GoalReached = 7,       // refund yok, kampanya başarılı
    AlreadyClaimed = 8,
    NothingToRefund = 9,
}

#[contract]
pub struct SentinelContract;

#[contractimpl]
impl SentinelContract {
    /// Kampanyayı bir kez kurar.
    /// - `recipient`: fonların gideceği sahip cüzdanı.
    /// - `token`: bağış token'ı (testnet native XLM SAC adresi).
    /// - `target`: hedef tutar (stroop; 1 XLM = 10_000_000 stroop).
    /// - `deadline`: bitiş zamanı (unix saniye).
    pub fn initialize(
        env: Env,
        recipient: Address,
        token: Address,
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
        env.storage().instance().set(&DataKey::Target, &target);
        env.storage().instance().set(&DataKey::Deadline, &deadline);
        env.storage().instance().set(&DataKey::Total, &0i128);
        env.storage().instance().set(&DataKey::Claimed, &false);
        env.storage().instance().extend_ttl(100, 200);
        Ok(())
    }

    /// Bağış yapar: `amount` kadar token'ı bağışçıdan sözleşmeye aktarır.
    pub fn deposit(env: Env, donor: Address, amount: i128) -> Result<i128, Error> {
        Self::require_init(&env)?;
        donor.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if env.ledger().timestamp() >= Self::deadline(&env) {
            return Err(Error::CampaignEnded);
        }

        // Gerçek token transferi: donor -> sözleşme.
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token = token::Client::new(&env, &token_addr);
        token.transfer(&donor, &env.current_contract_address(), &amount);

        // Toplam ve bağışçı katkısını güncelle.
        let mut total = Self::total(&env);
        total += amount;
        env.storage().instance().set(&DataKey::Total, &total);

        let key = DataKey::Contribution(donor);
        let mut given: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        given += amount;
        env.storage().persistent().set(&key, &given);
        env.storage().persistent().extend_ttl(&key, 100, 200);
        env.storage().instance().extend_ttl(100, 200);

        Ok(total)
    }

    /// Sahip, deadline sonrası hedefe ulaşıldıysa tüm fonu çeker.
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
        Ok(balance)
    }

    /// Bağışçı, deadline sonrası hedefe ulaşılamadıysa katkısını geri alır.
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

        // Önce kaydı sıfırla (reentrancy'e karşı), sonra transfer et.
        env.storage().persistent().set(&key, &0i128);

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token = token::Client::new(&env, &token_addr);
        token.transfer(&env.current_contract_address(), &donor, &amount);

        Ok(amount)
    }

    // ---------------- Görünümler (read-only) ----------------

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

    pub fn get_contribution(env: Env, donor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(donor))
            .unwrap_or(0)
    }

    pub fn is_claimed(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Claimed).unwrap_or(false)
    }

    // ---------------- Yardımcılar ----------------

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
}

#[cfg(test)]
mod test;
