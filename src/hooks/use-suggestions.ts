"use client";

import { useState, useCallback, useEffect } from "react";

export interface Suggestion {
  id: number;
  scanId: number | null;
  collectionName: string;
  reasoning: string | null;
  items: string[];
  itemCount: number;
  status: "pending" | "approved" | "rejected" | "applied";
  customPrompt: string | null;
  createdAt: Date;
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
        setSuggestions(data.suggestions);
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

  const approveAll = useCallback(async () => {
    const pending = suggestions.filter((s) => s.status === "pending");
    for (const suggestion of pending) {
      await updateStatus(suggestion.id, "approved");
    }
  }, [suggestions, updateStatus]);

  const rejectAll = useCallback(async () => {
    const pending = suggestions.filter((s) => s.status === "pending");
    for (const suggestion of pending) {
      await updateStatus(suggestion.id, "rejected");
    }
  }, [suggestions, updateStatus]);

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
  };
}
