"use client";

import axios from "axios";
import { createClient } from "@/utils/supabase/client";

/** Base URL for Nest backend. Set NEXT_PUBLIC_API_URL (e.g. http://localhost:3001) so all /api/* calls go to Nest. */
export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "";
}

const baseURL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001")
    : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const apiClient = axios.create({
  baseURL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  transformResponse: [
    (data, headers) => {
      if (typeof data !== "string") return data;
      const trimmed = data.trim();
      if (trimmed === "") return null;
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    },
  ],
});

// Attach Supabase auth headers to every request (x-user-id, x-user-email)
apiClient.interceptors.request.use(async (config) => {
  if (typeof window === "undefined") return config;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      config.headers["x-user-id"] = user.id;
      config.headers["x-user-email"] = user.email ?? "";
    }
  } catch {
    // ignore
  }
  return config;
});

export default apiClient;
