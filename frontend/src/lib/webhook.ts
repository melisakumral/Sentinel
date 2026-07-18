// Generic outbound webhook delivery for the Profile page's personal alerts.
// Deliberately not tied to one provider's SDK: a Telegram bot's sendMessage
// endpoint (https://api.telegram.org/bot<token>/sendMessage?chat_id=<id>),
// a Discord/Slack incoming webhook, or any custom endpoint that accepts a
// JSON POST all work, since we send the message under a few common keys.
// Everything here runs client-side and only in the connected wallet's own
// browser — the URL is stored in localStorage, never sent to Sentinel.

export interface WebhookConfig {
  url: string;
  enabled: boolean;
}

const KEY_PREFIX = 'sentinel-webhook-';

export function getWebhookConfig(pubKey: string): WebhookConfig {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + pubKey);
    if (raw) return JSON.parse(raw) as WebhookConfig;
  } catch {
    // localStorage unavailable or malformed value — fall back to defaults.
  }
  return { url: '', enabled: false };
}

export function setWebhookConfig(pubKey: string, config: WebhookConfig): void {
  try {
    localStorage.setItem(KEY_PREFIX + pubKey, JSON.stringify(config));
  } catch {
    // Non-fatal — the setting just won't persist across reloads.
  }
}

export async function sendWebhookAlert(url: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Sent under a few common receiver keys at once (Telegram: `text`,
      // Discord: `content`, Slack: `text`) so most webhook destinations pick
      // it up without extra configuration.
      body: JSON.stringify({ text, content: text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
