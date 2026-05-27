/**
 * TelegramService
 *
 * Infrastructure-layer service responsible for all direct communication
 * with the Telegram Bot API (webhook registration, deletion, status check).
 */
export class TelegramService {
  private readonly apiBase = 'https://api.telegram.org';

  /**
   * Registers a webhook URL with Telegram for the given bot token.
   * Telegram will POST all incoming updates to this URL.
   *
   * @param token      - Telegram Bot token (e.g. "123456:ABC-...")
   * @param webhookUrl - Publicly reachable HTTPS URL to receive updates
   */
  async setWebhook(token: string, webhookUrl: string): Promise<{ ok: boolean; description: string }> {
    const url = `${this.apiBase}/bot${token}/setWebhook`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl ,drop_pending_updates: true}),
    });

    const data = await response.json() as { ok: boolean; description: string };

    if (!data.ok) {
      throw new Error(`Telegram setWebhook failed: ${data.description}`);
    }

    console.log(`[TelegramService] Webhook set → ${webhookUrl}`);
    return data;
  }

  /**
   * Removes the currently registered webhook for the given bot token.
   *
   * @param token - Telegram Bot token
   */
  async deleteWebhook(token: string): Promise<{ ok: boolean; description: string }> {
    const url = `${this.apiBase}/bot${token}/deleteWebhook`;
    const response = await fetch(url, { method: 'POST' });
    const data = await response.json() as { ok: boolean; description: string };

    if (!data.ok) {
      throw new Error(`Telegram deleteWebhook failed: ${data.description}`);
    }

    console.log(`[TelegramService] Webhook deleted.`);
    return data;
  }

  /**
   * Retrieves the current webhook configuration from Telegram.
   *
   * @param token - Telegram Bot token
   */
  async getWebhookInfo(token: string): Promise<{
    ok: boolean;
    result: {
      url: string;
      has_custom_certificate: boolean;
      pending_update_count: number;
      last_error_date?: number;
      last_error_message?: string;
    };
  }> {
    const url = `${this.apiBase}/bot${token}/getWebhookInfo`;
    const response = await fetch(url);
    const data = await response.json() as any;

    if (!data.ok) {
      throw new Error(`Telegram getWebhookInfo failed: ${data.description}`);
    }

    return data;
  }
}
