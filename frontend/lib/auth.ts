export const SESSION_COOKIE = "caltodo_session";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function authPassword(): string {
  return required("FRONTEND_AUTH_PASSWORD");
}

export function authSecret(): string {
  return required("FRONTEND_AUTH_SECRET");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sessionToken(): Promise<string> {
  return sha256Hex(`caltodo:${authPassword()}:${authSecret()}`);
}
