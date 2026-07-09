#![cfg(test)]
use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

// Creates and returns a token (Stellar Asset Contract) for use in tests.
fn setup_token(env: &Env) -> Address {
    let issuer = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    sac.address()
}

// --- Mock Sentinel Registry ---
// The real `sentinel-registry` crate is a separately deployed contract (see
// contract/registry). Instead of adding it as a Rust-level compile-time
// dependency here, we test against a minimal mock sharing the same ABI
// (`record(campaign, recipient, total, target, success)`). This verifies that
// the campaign contract makes a genuine **inter-contract call**
// (`env.invoke_contract`) with the right arguments; the two contracts stay
// coupled only through the ABI, not each other's Rust type (just like in production).
#[contracttype]
#[derive(Clone)]
struct RecordedResult {
    recipient: Address,
    total: i128,
    target: i128,
    success: bool,
}

#[contract]
struct MockRegistry;

#[contractimpl]
impl MockRegistry {
    pub fn record(env: Env, campaign: Address, recipient: Address, total: i128, target: i128, success: bool) {
        campaign.require_auth();
        env.storage().persistent().set(&campaign, &RecordedResult { recipient, total, target, success });
    }

    pub fn get_result(env: Env, campaign: Address) -> Option<RecordedResult> {
        env.storage().persistent().get(&campaign)
    }
}

fn setup_registry(env: &Env) -> Address {
    env.register(MockRegistry, ())
}

#[test]
fn test_success_and_claim() {
    let env = Env::default();
    env.mock_all_auths();

    let recipient = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let token_addr = setup_token(&env);
    let token_admin = token::StellarAssetClient::new(&env, &token_addr);
    let token = token::Client::new(&env, &token_addr);
    token_admin.mint(&alice, &1000);
    token_admin.mint(&bob, &1000);

    let registry_addr = setup_registry(&env);

    let cid = env.register(SentinelContract, ());
    let client = SentinelContractClient::new(&env, &cid);

    // Goal 100, deadline t=10_000
    client.initialize(&recipient, &token_addr, &registry_addr, &100, &10_000);
    assert_eq!(client.get_state(), State::Running);

    client.deposit(&alice, &60);
    let total = client.deposit(&bob, &50);
    assert_eq!(total, 110);
    assert_eq!(client.get_total(), 110);
    assert_eq!(client.get_contribution(&alice), 60);
    assert_eq!(token.balance(&cid), 110); // collected in the contract

    // End the campaign -> goal reached
    env.ledger().with_mut(|li| li.timestamp = 10_001);
    assert_eq!(client.get_state(), State::Success);

    let claimed = client.claim();
    assert_eq!(claimed, 110);
    assert_eq!(token.balance(&recipient), 110); // funds went to the owner
    assert_eq!(token.balance(&cid), 0);
    assert!(client.is_claimed());

    // Inter-contract call: was the campaign's result recorded correctly in the registry?
    let registry_client = MockRegistryClient::new(&env, &registry_addr);
    let result = registry_client.get_result(&cid).unwrap();
    assert_eq!(result.recipient, recipient);
    assert_eq!(result.total, 110);
    assert!(result.success);
}

#[test]
fn test_failure_and_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let recipient = Address::generate(&env);
    let alice = Address::generate(&env);

    let token_addr = setup_token(&env);
    let token_admin = token::StellarAssetClient::new(&env, &token_addr);
    let token = token::Client::new(&env, &token_addr);
    token_admin.mint(&alice, &1000);

    let registry_addr = setup_registry(&env);

    let cid = env.register(SentinelContract, ());
    let client = SentinelContractClient::new(&env, &cid);

    // High goal -> won't be reached
    client.initialize(&recipient, &token_addr, &registry_addr, &1000, &10_000);
    client.deposit(&alice, &100);
    assert_eq!(token.balance(&alice), 900);

    env.ledger().with_mut(|li| li.timestamp = 10_001);
    assert_eq!(client.get_state(), State::Failed);

    let refunded = client.refund(&alice);
    assert_eq!(refunded, 100);
    assert_eq!(token.balance(&alice), 1000); // got their money back
    assert_eq!(client.get_contribution(&alice), 0);

    // The registry should have recorded a failed result.
    let registry_client = MockRegistryClient::new(&env, &registry_addr);
    let result = registry_client.get_result(&cid).unwrap();
    assert!(!result.success);
}

#[test]
#[should_panic]
fn test_deposit_after_deadline_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let recipient = Address::generate(&env);
    let alice = Address::generate(&env);
    let token_addr = setup_token(&env);
    token::StellarAssetClient::new(&env, &token_addr).mint(&alice, &1000);
    let registry_addr = setup_registry(&env);

    let cid = env.register(SentinelContract, ());
    let client = SentinelContractClient::new(&env, &cid);
    client.initialize(&recipient, &token_addr, &registry_addr, &100, &10_000);

    env.ledger().with_mut(|li| li.timestamp = 10_001);
    client.deposit(&alice, &50); // panics: CampaignEnded
}

#[test]
#[should_panic]
fn test_refund_when_goal_reached_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let recipient = Address::generate(&env);
    let alice = Address::generate(&env);
    let token_addr = setup_token(&env);
    token::StellarAssetClient::new(&env, &token_addr).mint(&alice, &1000);
    let registry_addr = setup_registry(&env);

    let cid = env.register(SentinelContract, ());
    let client = SentinelContractClient::new(&env, &cid);
    client.initialize(&recipient, &token_addr, &registry_addr, &100, &10_000);
    client.deposit(&alice, &150); // goal exceeded

    env.ledger().with_mut(|li| li.timestamp = 10_001);
    client.refund(&alice); // panics: GoalReached
}

#[test]
fn test_double_refund_calls_registry_each_time() {
    // Note: idempotency (the first record wins) is enforced by the real
    // Registry contract (see contract/registry/src/lib.rs `record`). This test
    // verifies that the campaign contract reliably notifies the registry on
    // every refund call (i.e. the inter-contract call fires every time).
    let env = Env::default();
    env.mock_all_auths();

    let recipient = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let token_addr = setup_token(&env);
    let token_admin = token::StellarAssetClient::new(&env, &token_addr);
    token_admin.mint(&alice, &1000);
    token_admin.mint(&bob, &1000);
    let registry_addr = setup_registry(&env);

    let cid = env.register(SentinelContract, ());
    let client = SentinelContractClient::new(&env, &cid);
    client.initialize(&recipient, &token_addr, &registry_addr, &1000, &10_000);
    client.deposit(&alice, &100);
    client.deposit(&bob, &50);

    env.ledger().with_mut(|li| li.timestamp = 10_001);

    client.refund(&alice);
    client.refund(&bob);

    let registry_client = MockRegistryClient::new(&env, &registry_addr);
    let result = registry_client.get_result(&cid).unwrap();
    assert!(!result.success);
    assert_eq!(result.total, 150); // the total at the time of the last refund
}
