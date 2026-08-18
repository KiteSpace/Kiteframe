// Resolves the app's public base URL for building absolute links (e.g.
// diagram_url in the external API response). Mirrors the domain-resolution
// pattern used for OIDC callback URLs in server/replitAuth.ts:
// explicit env override first, then REPLIT_DOMAINS, then localhost for dev.
export function getPublicAppUrl(): string {
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  const domains = process.env.REPLIT_DOMAINS?.split(",").map((d) => d.trim()).filter(Boolean) || [];
  if (domains.length > 0) {
    return `https://${domains[0]}`;
  }

  const port = process.env.PORT || "5000";
  return `http://localhost:${port}`;
}

/**
 * Live Stripe must never be registered against a workspace URL. Those hosts
 * can change or disappear, which leaves Stripe retrying a dead endpoint.
 */
export function getStripeWebhookBaseUrl(): string {
  const baseUrl = getPublicAppUrl();
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid PUBLIC_APP_URL for Stripe webhook registration: ${baseUrl}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const isWorkspaceHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".replit.dev");

  if (parsed.protocol !== "https:" || isWorkspaceHost) {
    throw new Error(
      `Stripe live webhooks require a public HTTPS deployment URL; refusing to register ${baseUrl}`,
    );
  }

  return baseUrl;
}
