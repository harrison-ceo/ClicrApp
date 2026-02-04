/**
 * Server-side only: base URL for the Nest backend.
 * Set NEXT_PUBLIC_API_URL so the Next.js server can call Nest (e.g. in server actions).
 */
export function getApiBaseServer(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "";
}

export function isUsingNest(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_URL);
}

export async function nestFetch(
  path: string,
  options: RequestInit & { body?: object } = {}
): Promise<Response> {
  const base = getApiBaseServer();
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not set. Set it to your Nest backend URL (e.g. http://localhost:3001).");
  }
  const { body, ...rest } = options;
  return fetch(`${base}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(rest.headers as Record<string, string>),
    },
    body: body !== undefined ? JSON.stringify(body) : rest.body,
  });
}
