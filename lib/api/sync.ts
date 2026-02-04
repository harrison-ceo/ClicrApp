"use client";

import { createClient } from "@/utils/supabase/client";
import { apiClient } from "./client";

export type SyncState = {
  business: Record<string, unknown> | null;
  venues: Record<string, unknown>[];
  areas: Record<string, unknown>[];
  clicrs: Record<string, unknown>[];
  events: Record<string, unknown>[];
  scanEvents: Record<string, unknown>[];
  users: Record<string, unknown>[];
  currentUser: Record<string, unknown>;
};

export async function fetchSyncState(): Promise<SyncState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const headers: Record<string, string> = {};
  if (user) {
    headers["x-user-id"] = user.id;
    headers["x-user-email"] = user.email ?? "";
  }
  const { data } = await apiClient.get<SyncState>("/api/sync", { headers });
  return data;
}

export type SyncPostBody = {
  action: string;
  payload?: unknown;
  venue_id?: string;
};

export async function postSyncAction(body: SyncPostBody): Promise<SyncState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const headers: Record<string, string> = {};
  if (user) {
    headers["x-user-id"] = user.id;
    headers["x-user-email"] = user.email ?? "";
  }
  const { data } = await apiClient.post<SyncState>("/api/sync", body, {
    headers,
  });
  return data;
}
