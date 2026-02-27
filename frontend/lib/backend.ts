export function backendBaseUrl(): string {
  const value = process.env.BACKEND_BASE_URL?.trim();
  if (!value) {
    throw new Error("Missing BACKEND_BASE_URL");
  }
  return value.replace(/\/$/, "");
}

export function adminToken(): string {
  const value = process.env.BACKEND_ADMIN_TOKEN?.trim();
  if (!value) {
    throw new Error("Missing BACKEND_ADMIN_TOKEN");
  }
  return value;
}

export async function fetchBackend<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${backendBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}
