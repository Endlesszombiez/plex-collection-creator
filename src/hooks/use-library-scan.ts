"use client";

import { useState, useCallback, useRef } from "react";
import { PlexMediaItem } from "@/lib/plex/client";

interface ScanProgress {
  type: "progress" | "complete" | "error";
  phase: "init" | "scanning" | "complete";
  library?: string;
  libraryIndex?: number;
  totalLibraries?: number;
  itemsFetched?: number;
  totalItems?: number;
  message?: string;
  scanId?: number;
  movies?: PlexMediaItem[];
  shows?: PlexMediaItem[];
  totalMovies?: number;
  totalShows?: number;
  error?: string;
}

interface ScanState {
  status: "idle" | "scanning" | "complete" | "error";
  progress: ScanProgress | null;
  movies: PlexMediaItem[];
  shows: PlexMediaItem[];
  scanId: number | null;
  error: string | null;
}

interface UseLibraryScanReturn extends ScanState {
  startScan: () => void;
  cancelScan: () => void;
  reset: () => void;
}

export function useLibraryScan(): UseLibraryScanReturn {
  const [state, setState] = useState<ScanState>({
    status: "idle",
    progress: null,
    movies: [],
    shows: [],
    scanId: null,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const startScan = useCallback(async () => {
    // Cancel any existing scan
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState({
      status: "scanning",
      progress: null,
      movies: [],
      shows: [],
      scanId: null,
      error: null,
    });

    try {
      const response = await fetch("/api/plex/scan", {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Scan request failed: ${response.statusText}`);
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
              const data: ScanProgress = JSON.parse(line.slice(6));

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
                  movies: data.movies || [],
                  shows: data.shows || [],
                  scanId: data.scanId || null,
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
        error: error instanceof Error ? error.message : "Scan failed",
      }));
    }
  }, []);

  const cancelScan = useCallback(() => {
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
      movies: [],
      shows: [],
      scanId: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    startScan,
    cancelScan,
    reset,
  };
}
