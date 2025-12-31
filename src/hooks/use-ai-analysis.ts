"use client";

import { useState, useCallback, useRef } from "react";

interface AnalysisProgress {
  type: "progress" | "complete" | "error";
  phase: "loading" | "analyzing" | "saving" | "complete";
  message?: string;
  totalItems?: number;
  suggestionsCount?: number;
  suggestionIds?: number[];
  error?: string;
  pass?: number;
  totalPasses?: number;
}

interface AnalysisState {
  status: "idle" | "analyzing" | "complete" | "error";
  progress: AnalysisProgress | null;
  suggestionsCount: number;
  suggestionIds: number[];
  error: string | null;
}

interface UseAIAnalysisReturn extends AnalysisState {
  startAnalysis: (scanId?: number) => void;
  cancelAnalysis: () => void;
  reset: () => void;
}

export function useAIAnalysis(): UseAIAnalysisReturn {
  const [state, setState] = useState<AnalysisState>({
    status: "idle",
    progress: null,
    suggestionsCount: 0,
    suggestionIds: [],
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const startAnalysis = useCallback(async (scanId?: number) => {
    // Cancel any existing analysis
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState({
      status: "analyzing",
      progress: null,
      suggestionsCount: 0,
      suggestionIds: [],
      error: null,
    });

    try {
      const url = scanId
        ? `/api/suggestions/generate?scanId=${scanId}`
        : "/api/suggestions/generate";

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Analysis request failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data: AnalysisProgress = JSON.parse(line.slice(6));

              if (data.type === "error") {
                setState((prev) => ({
                  ...prev,
                  status: "error",
                  error: data.error || "Unknown error",
                  progress: data,
                }));
              } else if (data.type === "complete") {
                setState((prev) => ({
                  ...prev,
                  status: "complete",
                  progress: data,
                  suggestionsCount: data.suggestionsCount || 0,
                  suggestionIds: data.suggestionIds || [],
                }));
              } else {
                setState((prev) => ({
                  ...prev,
                  progress: data,
                }));
              }
            } catch {
              console.error("Failed to parse SSE data:", line);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setState((prev) => ({
          ...prev,
          status: "idle",
          error: null,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Analysis failed",
      }));
    }
  }, []);

  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      status: "idle",
    }));
  }, []);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState({
      status: "idle",
      progress: null,
      suggestionsCount: 0,
      suggestionIds: [],
      error: null,
    });
  }, []);

  return {
    ...state,
    startAnalysis,
    cancelAnalysis,
    reset,
  };
}
