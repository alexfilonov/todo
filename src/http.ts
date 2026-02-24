export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}: ${body}`);
  }
  return (await response.json()) as T;
}

export function formUrlEncoded(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}
