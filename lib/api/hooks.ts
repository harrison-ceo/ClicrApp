"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import {
  fetchSyncState,
  postSyncAction,
  type SyncState,
  type SyncPostBody,
} from "./sync";
import { fetchAggregateReport } from "./reports";

export const syncKeys = {
  all: ["sync"] as const,
  state: () => [...syncKeys.all, "state"] as const,
};

export function useSyncState(
  options?: Omit<
    UseQueryOptions<SyncState, Error, SyncState, readonly string[]>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery({
    queryKey: syncKeys.state(),
    queryFn: fetchSyncState,
    refetchInterval: 2000,
    staleTime: 1000,
    ...options,
  });
}

export function useSyncMutation(
  options?: UseMutationOptions<SyncState, Error, SyncPostBody>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postSyncAction,
    onSuccess: (data) => {
      queryClient.setQueryData(syncKeys.state(), data);
    },
    ...options,
  });
}

export const reportKeys = {
  aggregate: (businessId: string, date: string) =>
    ["reports", "aggregate", businessId, date] as const,
};

export function useAggregateReport(
  businessId: string | null,
  date: string | null,
  options?: Omit<
    UseQueryOptions<
      { success: boolean; report?: unknown },
      Error,
      { success: boolean; report?: unknown },
      readonly string[]
    >,
    "queryKey" | "queryFn"
  >
) {
  return useQuery({
    queryKey: reportKeys.aggregate(businessId ?? "", date ?? ""),
    queryFn: () => fetchAggregateReport(businessId!, date!),
    enabled: Boolean(businessId && date),
    ...options,
  });
}
