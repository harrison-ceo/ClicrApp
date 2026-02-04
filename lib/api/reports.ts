"use client";

import { apiClient } from "./client";

export async function fetchAggregateReport(
  businessId: string,
  date: string
): Promise<{ success: boolean; report?: unknown }> {
  const { data } = await apiClient.post("/api/reports/aggregate", {
    businessId,
    date,
  });
  return data;
}
