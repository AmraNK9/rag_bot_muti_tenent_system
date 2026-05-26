import { Tunnel } from 'cloudflared';

/**
 * TunnelService (Cloudflare Quick Tunnel implementation)
 *
 * Infrastructure-layer service that manages a Cloudflare Quick Tunnel,
 * exposing the local Express server over a public HTTPS URL so that
 * Telegram can reach our webhook endpoint.
 *
 * Uses the `cloudflared` npm package (event-based Tunnel class).
 * No account, no auth token — Quick Tunnels are completely free and
 * have no IP restrictions.
 *
 * Public URL format: https://<random>.trycloudflare.com
 */
export class TunnelService {
  private cfTunnel: Tunnel | null = null;
  private publicUrl: string | null = null;

  /**
   * Starts a Cloudflare Quick Tunnel forwarding to the given local port.
   * Waits until the tunnel is ready and the public URL is available.
   *
   * @param port - Local port the Express server is listening on
   */
  startTunnel(port: number): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log(`[TunnelService] Starting Cloudflare Quick Tunnel → localhost:${port} ...`);

      // Create a Quick Tunnel (no token needed)
      const cfTunnel = Tunnel.quick(`http://localhost:${port}`);
      this.cfTunnel = cfTunnel;

      // The 'url' event fires once cloudflared has established the tunnel
      cfTunnel.once('url', (url: string) => {
        this.publicUrl = url;
        console.log(`[TunnelService] ✅ Tunnel active → ${url}`);
        resolve(url);
      });

      // Catch startup errors
      cfTunnel.once('error', (err: Error) => {
        reject(new Error(`Cloudflare tunnel error: ${err.message}`));
      });

      // If the process exits before emitting 'url', reject
      cfTunnel.once('exit', (code: number | null) => {
        if (!this.publicUrl) {
          reject(new Error(`Cloudflare tunnel process exited early (code ${code}).`));
        }
      });
    });
  }

  /**
   * Returns the currently active public tunnel URL, or null if not started.
   */
  getPublicUrl(): string | null {
    return this.publicUrl;
  }

  /**
   * Stops the active Cloudflare tunnel.
   */
  stopTunnel(): void {
    if (this.cfTunnel) {
      this.cfTunnel.stop();
      this.cfTunnel = null;
      this.publicUrl = null;
      console.log('[TunnelService] Tunnel stopped.');
    }
  }
}

// Singleton instance shared across the application
export const tunnelService = new TunnelService();
