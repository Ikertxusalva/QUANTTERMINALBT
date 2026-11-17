export const SESSION_COOKIE = "tj_session";

/** Token stored in the session cookie: a hash of the password, never the password. */
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`tradingjournal:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type AuthMode = "open" | "locked" | "misconfigured";

/** open: no password set in development. misconfigured: production without a password. */
export function authMode(): AuthMode {
  if (process.env.APP_PASSWORD) return "locked";
  return process.env.NODE_ENV === "production" ? "misconfigured" : "open";
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  const mode = authMode();
  if (mode === "open") return true;
  if (mode === "misconfigured" || !cookieValue) return false;
  return cookieValue === (await sessionToken(process.env.APP_PASSWORD!));
}
