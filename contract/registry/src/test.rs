#![cfg(test)]
use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Env;

#[test]
fn test_record_and_get() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SentinelRegistry, ());
    let client = SentinelRegistryClient::new(&env, &contract_id);

    let campaign = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.record(&campaign, &recipient, &500_000_000, &500_000_000, &true);

    let result = client.get_result(&campaign).unwrap();
    assert_eq!(result.recipient, recipient);
    assert_eq!(result.total, 500_000_000);
    assert!(result.success);
    assert_eq!(client.count(), 1);
}

#[test]
fn test_record_is_idempotent() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SentinelRegistry, ());
    let client = SentinelRegistryClient::new(&env, &contract_id);

    let campaign = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.record(&campaign, &recipient, &10, &100, &false);
    client.record(&campaign, &recipient, &999, &100, &true); // ignored, first record wins

    assert_eq!(client.count(), 1);
    let result = client.get_result(&campaign).unwrap();
    assert_eq!(result.total, 10);
    assert!(!result.success);
}

#[test]
fn test_unknown_campaign_returns_none() {
    let env = Env::default();
    let contract_id = env.register(SentinelRegistry, ());
    let client = SentinelRegistryClient::new(&env, &contract_id);
    let unknown = Address::generate(&env);
    assert!(client.get_result(&unknown).is_none());
    assert_eq!(client.count(), 0);
}
