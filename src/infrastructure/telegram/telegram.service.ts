/**
 * TelegramService
 *
 * Infrastructure-layer service responsible for all direct communication
 * with the Telegram Bot API (webhook registration, deletion, status check).
 */
export class TelegramService {
  private readonly apiBase = 'https://api.telegram.org';

  /**
   * Validates a Telegram Bot token by calling the getMe endpoint.
   *
   * @param token - Telegram Bot token
   * @returns true if valid, false otherwise
   */
  async validateBotToken(token: string): Promise<boolean> {
    try {
      const url = `${this.apiBase}/bot${token}/getMe`;
      const response = await fetch(url);
      const data = await response.json() as { ok: boolean };
      return data.ok === true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Retrieves the current webhook status for the given bot token.
   *
   * @param token - Telegram Bot token
   * @returns webhook info object
   */
  async getWebhookInfo(token: string): Promise<{ ok: boolean; result?: { url: string; has_custom_certificate: boolean; pending_update_count: number } }> {
    try {
      const url = `${this.apiBase}/bot${token}/getWebhookInfo`;
      const response = await fetch(url);
      return await response.json() as any;
    } catch (e) {
      return { ok: false };
    }
  }

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

  /**
   * Sends a text message to a specific Telegram chat using the bot token.
   */
  async sendMessage(token: string, chatId: string | number, text: string, replyMarkup?: any, parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML'): Promise<number> {
    const url = `${this.apiBase}/bot${token}/sendMessage`;
    const payload: any = {
      chat_id: String(chatId),
      text: text,
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    if (parseMode) {
      payload.parse_mode = parseMode;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram sendMessage failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!data.ok || !data.result) {
      throw new Error(`Telegram sendMessage failed: ${data.description || 'Unknown error'}`);
    }
    return data.result.message_id;
  }

  /**
   * Sends a photo to a specific Telegram chat.
   */
  async sendPhoto(token: string, chatId: string | number, photoBuffer: Buffer, filename: string, caption?: string, replyMarkup?: any): Promise<number> {
    const url = `${this.apiBase}/bot${token}/sendPhoto`;
    
    // Convert Buffer to Uint8Array for compatibility with Blob
    const blob = new Blob([new Uint8Array(photoBuffer)], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('photo', blob, filename);
    if (caption) formData.append('caption', caption);
    if (replyMarkup) formData.append('reply_markup', JSON.stringify(replyMarkup));

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram sendPhoto failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json() as any;
    if (!data.ok || !data.result) {
      throw new Error(`Telegram sendPhoto failed: ${data.description || 'Unknown error'}`);
    }
    return data.result.message_id;
  }

  /**
   * Edits the reply markup of an existing message.
   */
  async editMessageReplyMarkup(token: string, chatId: string | number, messageId: number, replyMarkup: any): Promise<boolean> {
    const url = `${this.apiBase}/bot${token}/editMessageReplyMarkup`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        message_id: messageId,
        reply_markup: replyMarkup,
      }),
    });

    const data = await response.json() as any;
    return data.ok;
  }

  /**
   * Answers a callback query to stop the loading spinner.
   */
  async answerCallbackQuery(token: string, callbackQueryId: string, text?: string): Promise<boolean> {
    const url = `${this.apiBase}/bot${token}/answerCallbackQuery`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
      }),
    });

    const data = await response.json() as any;
    return data.ok;
  }

  /**
   * Retrieves bot information (including username) from Telegram with retry logic for network timeouts.
   */
  async getMe(token: string): Promise<{ ok: boolean; result?: { id: number; username: string; first_name: string } }> {
    const url = `${this.apiBase}/bot${token}/getMe`;
    let attempts = 0;
    while (attempts < 3) {
      try {
        attempts++;
        const response = await fetch(url);
        const data = await response.json() as any;
        return data;
      } catch (err) {
        if (attempts >= 3) {
          console.error(`[TelegramService] getMe failed after ${attempts} attempts:`, err);
          return { ok: false };
        }
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
    return { ok: false };
  }
}
