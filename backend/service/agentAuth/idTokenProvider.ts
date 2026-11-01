import { logInfo } from "../../logger";

/* Refresh this long before the ID token's exp, so a call never races the expiry. */
const REFRESH_MARGIN_SECONDS = 120;

export interface IdTokenConfig {
  idToken: string;
  refreshToken: string;
  clientId: string;
  region: string;
}

export interface IdTokenDeps {
  fetch?: typeof fetch;
  now?: () => Date;
}

function tokenExpiry(idToken: string): number {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : 0;
  } catch {
    return 0;
  }
}

/**
 * An agent's Cognito ID token for its MCP servers (docs/17-executive-team.md
 * §10.7): the one the run script signed in with, refreshed through
 * Cognito's REFRESH_TOKEN_AUTH when it nears expiry.
 */
export class IdTokenProvider {
  private idToken: string;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => Date;

  constructor(
    private readonly config: IdTokenConfig,
    deps: IdTokenDeps = {}
  ) {
    this.idToken = config.idToken;
    this.fetchFn = deps.fetch ?? fetch;
    this.now = deps.now ?? (() => new Date());
  }

  async token(): Promise<string> {
    if (tokenExpiry(this.idToken) - REFRESH_MARGIN_SECONDS > this.now().getTime() / 1000) return this.idToken;
    logInfo("IdTokenProvider.refresh", {});
    const response = await this.fetchFn(`https://cognito-idp.${this.config.region}.amazonaws.com/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth" },
      body: JSON.stringify({ AuthFlow: "REFRESH_TOKEN_AUTH", ClientId: this.config.clientId, AuthParameters: { REFRESH_TOKEN: this.config.refreshToken } }),
    });
    const body = (await response.json()) as { AuthenticationResult?: { IdToken?: string } };
    const idToken = body.AuthenticationResult?.IdToken;
    if (!response.ok || !idToken) throw new Error(`Cognito token refresh failed: HTTP ${response.status}`);
    this.idToken = idToken;
    return idToken;
  }
}
