"use client";

import { apiClient } from "./client";

export async function logErrorToBackend(
  userId: string | undefined,
  message: string,
  context: string,
  payload?: unknown
): Promise<void> {
  const headers: Record<string, string> = {};
  if (userId) headers["x-user-id"] = userId;
  await apiClient.post(
    "/api/log-error",
    { message, context, payload },
    { headers }
  );
}
