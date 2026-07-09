#![no_std]
//! Sentinel Registry — kampanya sözleşmelerinin nihai sonucunu (claim/refund) kaydeden
//! bağımsız bir sözleşme.
//!
//! `sentinel-contract` (kampanya sözleşmesi), `claim`/`refund` sonrası bu sözleşmeyi
//! gerçek bir **inter-contract call** (`env.invoke_contract`) ile çağırır. Kayıt
//! idempotent'tir: aynı kampanya için ikinci çağrı yok sayılır, böylece kampanya
//! sözleşmesi tekrar tekrar (örn. her `refund` çağrısında) bildirebilir.
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
    Result(Address), // kampanya sözleşme adresi -> sonuç
    Count,
}

#[contract]
pub struct SentinelRegistry;

#[contractimpl]
impl SentinelRegistry {
    /// Bir Sentinel kampanya sözleşmesi kendi nihai sonucunu buraya kaydeder.
    /// `campaign` çağıran sözleşmenin kendi adresidir; `require_auth` burada
    /// çağıran kontratın kimliğini doğrular (contract-to-contract auth).
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
            return; // idempotent: ilk kayıt kazanır
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
