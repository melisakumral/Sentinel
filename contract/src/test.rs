#![cfg(test)]
use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, Address, Env};

// Testlerde kullanılacak bir token (Stellar Asset Contract) oluşturur ve döner.
fn setup_token(env: &Env) -> Address {
    let issuer = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    sac.address()
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

    let cid = env.register(SentinelContract, ());
    let client = SentinelContractClient::new(&env, &cid);

    // Hedef 100, deadline t=10_000
    client.initialize(&recipient, &token_addr, &100, &10_000);
    assert_eq!(client.get_state(), State::Running);

    client.deposit(&alice, &60);
    let total = client.deposit(&bob, &50);
    assert_eq!(total, 110);
    assert_eq!(client.get_total(), 110);
    assert_eq!(client.get_contribution(&alice), 60);
    assert_eq!(token.balance(&cid), 110); // sözleşmede toplandı

    // Süreyi bitir → hedefe ulaşıldı
    env.ledger().with_mut(|li| li.timestamp = 10_001);
    assert_eq!(client.get_state(), State::Success);

    let claimed = client.claim();
    assert_eq!(claimed, 110);
    assert_eq!(token.balance(&recipient), 110); // fon sahibe gitti
    assert_eq!(token.balance(&cid), 0);
    assert!(client.is_claimed());
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

    let cid = env.register(SentinelContract, ());
    let client = SentinelContractClient::new(&env, &cid);

    // Yüksek hedef → ulaşılamayacak
    client.initialize(&recipient, &token_addr, &1000, &10_000);
    client.deposit(&alice, &100);
    assert_eq!(token.balance(&alice), 900);

    env.ledger().with_mut(|li| li.timestamp = 10_001);
    assert_eq!(client.get_state(), State::Failed);

    let refunded = client.refund(&alice);
    assert_eq!(refunded, 100);
    assert_eq!(token.balance(&alice), 1000); // parası geri geldi
    assert_eq!(client.get_contribution(&alice), 0);
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

    let cid = env.register(SentinelContract, ());
    let client = SentinelContractClient::new(&env, &cid);
    client.initialize(&recipient, &token_addr, &100, &10_000);

    env.ledger().with_mut(|li| li.timestamp = 10_001);
    client.deposit(&alice, &50); // panik: CampaignEnded
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

    let cid = env.register(SentinelContract, ());
    let client = SentinelContractClient::new(&env, &cid);
    client.initialize(&recipient, &token_addr, &100, &10_000);
    client.deposit(&alice, &150); // hedef aşıldı

    env.ledger().with_mut(|li| li.timestamp = 10_001);
    client.refund(&alice); // panik: GoalReached
}
