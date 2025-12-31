"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * Enriched item with title and year for display.
 */
export interface SuggestionItem {
  ratingKey: string;
  title: string;
  year?: number;
}

export interface Suggestion {
  id: number;
  scanId: number | null;
  collectionName: string;
  reasoning: string | null;
  items: SuggestionItem[];
  itemCount: number;
  status: "pending" | "approved" | "rejected" | "applied";
  customPrompt: string | null;
  createdAt: Date;
}

/**
 * Parse items from DB format.
 */
export function parseItems(items: unknown): SuggestionItem[] {
  if (!Array.isArray(items)) return [];
  return items as SuggestionItem[];
}

interface UseSuggestionsReturn {
  suggestions: Suggestion[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  approve: (id: number) => Promise<void>;
  reject: (id: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
  approveAll: () => Promise<void>;
  rejectAll: () => Promise<void>;
  restoreAll: () => Promise<void>;
  deleteAll: () => Promise<void>;
  markApplied: (id: number) => void;
}

export function useSuggestions(statusFilter?: string): UseSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const url = statusFilter
        ? `/api/suggestions?status=${statusFilter}`
        : "/api/suggestions";
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        // Normalize items to handle both old and new formats
        const normalized = data.suggestions.map((s: Suggestion & { items: unknown }) => ({
          ...s,
          items: parseItems(s.items),
        }));
        setSuggestions(normalized);
      } else {
        setError(data.error || "Failed to fetch suggestions");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch suggestions");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  const updateStatus = useCallback(async (id: number, status: string) => {
    try {
      const response = await fetch("/api/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await response.json();

      if (data.success) {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: status as Suggestion["status"] } : s))
        );
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update suggestion");
      throw err;
    }
  }, []);

  const approve = useCallback(
    (id: number) => updateStatus(id, "approved"),
    [updateStatus]
  );

  const reject = useCallback(
    (id: number) => updateStatus(id, "rejected"),
    [updateStatus]
  );

  const remove = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/suggestions?id=${id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete suggestion");
      throw err;
    }
  }, []);

  // Bulk operations with optimistic UI updates (single state change, then background sync)
  const approveAll = useCallback(async () => {
    const pendingIds = suggestions.filter((s) => s.status === "pending").map((s) => s.id);
    if (pendingIds.length === 0) return;

    // Optimistic update - single state change
    setSuggestions((prev) =>
      prev.map((s) => (pendingIds.includes(s.id) ? { ...s, status: "approved" as const } : s))
    );

    // Background sync with API
    await Promise.all(
      pendingIds.map((id) =>
        fetch("/api/suggestions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: "approved" }),
        }).catch(console.error)
      )
    );
  }, [suggestions]);

  const rejectAll = useCallback(async () => {
    const pendingIds = suggestions.filter((s) => s.status === "pending").map((s) => s.id);
    if (pendingIds.length === 0) return;

    // Optimistic update - single state change
    setSuggestions((prev) =>
      prev.map((s) => (pendingIds.includes(s.id) ? { ...s, status: "rejected" as const } : s))
    );

    // Background sync with API
    await Promise.all(
      pendingIds.map((id) =>
        fetch("/api/suggestions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: "rejected" }),
        }).catch(console.error)
      )
    );
  }, [suggestions]);

  const restoreAll = useCallback(async () => {
    const rejectedIds = suggestions.filter((s) => s.status === "rejected").map((s) => s.id);
    if (rejectedIds.length === 0) return;

    // Optimistic update - single state change
    setSuggestions((prev) =>
      prev.map((s) => (rejectedIds.includes(s.id) ? { ...s, status: "pending" as const } : s))
    );

    // Background sync with API
    await Promise.all(
      rejectedIds.map((id) =>
        fetch("/api/suggestions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: "pending" }),
        }).catch(console.error)
      )
    );
  }, [suggestions]);

  const deleteAll = useCallback(async () => {
    const rejectedIds = suggestions.filter((s) => s.status === "rejected").map((s) => s.id);
    if (rejectedIds.length === 0) return;

    // Optimistic update - single state change
    setSuggestions((prev) => prev.filter((s) => !rejectedIds.includes(s.id)));

    // Background sync with API
    await Promise.all(
      rejectedIds.map((id) =>
        fetch(`/api/suggestions?id=${id}`, { method: "DELETE" }).catch(console.error)
      )
    );
  }, [suggestions]);

  // Optimistically mark a suggestion as applied (no API call, just local state)
  const markApplied = useCallback((id: number) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "applied" as const } : s))
    );
  }, []);

  // Load on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    suggestions,
    isLoading,
    error,
    refresh,
    approve,
    reject,
    remove,
    approveAll,
    rejectAll,
    restoreAll,
    deleteAll,
    markApplied,
  };
}
