import "server-only";

import { createHash, randomBytes } from "node:crypto";

export type EntraConfig = {
  authority: string;
  tenantId: string;
  webClientId: string;
  webClientSecret: string;
  scope: string;
  redirectUri: string;
};

// Returns null (never throws) when the Entra tenant hasn't been configured
// yet for this environment — every caller must treat that as "Entra login
// unavailable", not a crash, since coexistence with native auth is the point.
export function getEntraConfig(): EntraConfig | null {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const subdomain = process.env.ENTRA_TENANT_SUBDOMAIN;
  const customDomain = process.env.ENTRA_CUSTOM_DOMAIN;
  const webClientId = process.env.ENTRA_WEB_CLIENT_ID;
  const webClientSecret = process.env.ENTRA_WEB_CLIENT_SECRET;
  const scope = process.env.ENTRA_API_SCOPE;
  const redirectUri = process.env.ENTRA_REDIRECT_URI;

  if (
    !tenantId ||
    !webClientId ||
    !webClientSecret ||
    !scope ||
    !redirectUri ||
    !(subdomain || customDomain)
  ) {
    return null;
  }

  return {
    authority: customDomain ? `https://${customDomain}` : `https://${subdomain}.ciamlogin.com`,
    tenantId,
    webClientId,
    webClientSecret,
    scope,
    redirectUri,
  };
}

export function authorizeUrl(config: EntraConfig) {
  return `${config.authority}/${config.tenantId}/oauth2/v2.0/authorize`;
}

export function tokenUrl(config: EntraConfig) {
  return `${config.authority}/${config.tenantId}/oauth2/v2.0/token`;
}

export function endSessionUrl(config: EntraConfig) {
  return `${config.authority}/${config.tenantId}/oauth2/v2.0/logout`;
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(): string {
  return base64url(randomBytes(24));
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}
