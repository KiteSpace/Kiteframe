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
