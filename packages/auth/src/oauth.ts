export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class OAuthProvider {
  constructor(private config: OAuthConfig) {}

  /**
   * Helper to construct GitHub OAuth authorization URL
   */
  getGithubAuthUrl(scope = "user:email"): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Helper to exchange GitHub authorization code for access token
   */
  async exchangeGithubCode(code: string): Promise<{ access_token?: string; error?: string }> {
    try {
      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri,
        }),
      });

      return (await res.json()) as { access_token?: string; error?: string };
    } catch (err: any) {
      return { error: err.message || "Failed to exchange OAuth code" };
    }
  }

  /**
   * Helper to construct Google OAuth authorization URL
   */
  getGoogleAuthUrl(scope = "openid email profile"): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope,
      access_type: "offline",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
}
