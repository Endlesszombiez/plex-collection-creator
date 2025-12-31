"use client";

import { useState, useCallback, useEffect } from "react";
import { AIProvider, getProviderInfo } from "@/lib/ai/types";

interface AIConfigState {
  configured: boolean;
  provider: AIProvider | null;
  providerName: string | null;
  source: "env" | "database" | null;
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  testResult: { success: boolean; message: string } | null;
  error: string | null;
}

interface UseAIConfigReturn extends AIConfigState {
  refreshConfig: () => Promise<void>;
  testConnection: (provider: AIProvider, credentials: Record<string, string>) => Promise<boolean>;
  saveConfig: (provider: AIProvider, credentials: Record<string, string>) => Promise<boolean>;
  clearConfig: () => Promise<boolean>;
  clearTestResult: () => void;
  clearError: () => void;
}

export function useAIConfig(): UseAIConfigReturn {
  const [state, setState] = useState<AIConfigState>({
    configured: false,
    provider: null,
    providerName: null,
    source: null,
    isLoading: true,
    isSaving: false,
    isTesting: false,
    testResult: null,
    error: null,
  });

  // Fetch current configuration
  const refreshConfig = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch("/api/ai/config");
      const data = await response.json();

      if (data.success) {
        setState((prev) => ({
          ...prev,
          configured: data.configured,
          provider: data.provider,
          providerName: data.providerName,
          source: data.source || null,
          isLoading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || "Failed to get configuration",
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to get configuration",
      }));
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  // Test connection
  const testConnection = useCallback(
    async (provider: AIProvider, credentials: Record<string, string>): Promise<boolean> => {
      setState((prev) => ({ ...prev, isTesting: true, testResult: null, error: null }));

      try {
        const response = await fetch("/api/ai/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, credentials }),
        });

        const data = await response.json();

        setState((prev) => ({
          ...prev,
          isTesting: false,
          testResult: { success: data.success, message: data.message },
        }));

        return data.success;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Connection test failed";
        setState((prev) => ({
          ...prev,
          isTesting: false,
          testResult: { success: false, message },
        }));
        return false;
      }
    },
    []
  );

  // Save configuration
  const saveConfig = useCallback(
    async (provider: AIProvider, credentials: Record<string, string>): Promise<boolean> => {
      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        const response = await fetch("/api/ai/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, credentials }),
        });

        const data = await response.json();

        if (data.success) {
          const providerInfo = getProviderInfo(provider);
          setState((prev) => ({
            ...prev,
            isSaving: false,
            configured: true,
            provider,
            providerName: providerInfo?.name || provider,
            source: "database",
          }));
          return true;
        } else {
          setState((prev) => ({
            ...prev,
            isSaving: false,
            error: data.error || "Failed to save configuration",
          }));
          return false;
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isSaving: false,
          error: err instanceof Error ? err.message : "Failed to save configuration",
        }));
        return false;
      }
    },
    []
  );

  // Clear configuration
  const clearConfig = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      const response = await fetch("/api/ai/config", {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setState((prev) => ({
          ...prev,
          isSaving: false,
          configured: false,
          provider: null,
          providerName: null,
          source: null,
          testResult: null,
        }));
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          isSaving: false,
          error: data.error || "Failed to clear configuration",
        }));
        return false;
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: err instanceof Error ? err.message : "Failed to clear configuration",
      }));
      return false;
    }
  }, []);

  // Clear test result
  const clearTestResult = useCallback(() => {
    setState((prev) => ({ ...prev, testResult: null }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    refreshConfig,
    testConnection,
    saveConfig,
    clearConfig,
    clearTestResult,
    clearError,
  };
}
