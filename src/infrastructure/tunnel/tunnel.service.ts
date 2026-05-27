import ngrok from '@ngrok/ngrok';

/**
 * TunnelService (ngrok implementation)
 *
 * Infrastructure-layer service that manages an ngrok tunnel,
 * exposing the local Express server over a public HTTPS URL so that
 * Telegram can reach our webhook endpoint.
 *
 * Uses the `@ngrok/ngrok` npm package.
 * Requires NGROK_AUTHTOKEN in .env — get a free token at https://ngrok.com
 * Must be run with VPN if connecting from Myanmar (IP restriction applies).
 *
 * Public URL format: https://<random>.ngrok-free.app
 */
export class TunnelService {
  private listener: Awaited<ReturnType<typeof ngrok.forward>> | null = null;
  private publicUrl: string | null = null;

  /**
   * Starts an ngrok tunnel forwarding to the given local port.
   * Resolves with the public HTTPS URL when the tunnel is ready.
   *
   * Requires NGROK_AUTHTOKEN environment variable.
   *
   * @param port - Local port the Express server is listening on
   */
  async startTunnel(port: number): Promise<string> {
    const authtoken = process.env.NGROK_AUTHTOKEN;
    const domain = process.env.NGROK_DOMAIN; 
    if (!authtoken) {
      throw new Error(
        'NGROK_AUTHTOKEN is not set in .env. ' +
        'Get a free token at https://ngrok.com and add it to your .env file.'
      );
    }

    console.log(`[TunnelService] Starting ngrok tunnel → localhost:${port} ...`);

    this.listener = await ngrok.forward({
      addr: port,
      authtoken,
      domain,
    });

    this.publicUrl = this.listener.url()!;

    console.log(`[TunnelService] ✅ ngrok tunnel active → ${this.publicUrl}`);

    return this.publicUrl;
  }

  /**
   * Returns the currently active public tunnel URL, or null if not started.
   */
  getPublicUrl(): string | null {
    return this.publicUrl;
  }

  /**
   * Stops the active ngrok tunnel.
   */
  async stopTunnel(): Promise<void> {
    if (this.listener) {
      await this.listener.close();
      this.listener = null;
      this.publicUrl = null;
      console.log('[TunnelService] ngrok tunnel stopped.');
    }
  }
}

// Singleton instance shared across the application
export const tunnelService = new TunnelService();
