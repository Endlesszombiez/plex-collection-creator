"use client";

import { useState, useCallback, useEffect } from "react";

interface SavedLibrary {
  key: string;
  title: string;
  type: "movie" | "show";
  uuid: string;
}

interface UseSavedLibrariesReturn {
  hasSavedSelection: boolean;
  serverUrl: string | null;
  serverId: string | null;
  serverName: string | null;
  libraries: SavedLibrary[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSavedLibraries(): UseSavedLibrariesReturn {
  const [hasSavedSelection, setHasSavedSelection] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [serverId, setServerId] = useState<string | null>(null);
  const [serverName, setServerName] = useState<string | null>(null);
  const [libraries, setLibraries] = useState<SavedLibrary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/plex/libraries/saved");
      const data = await response.json();

      if (data.success) {
        setHasSavedSelection(data.hasSavedSelection);
        setServerUrl(data.serverUrl);
        setServerId(data.serverId);
        setServerName(data.serverName);
        setLibraries(data.libraries || []);
      } else {
        setError(data.error || "Failed to check saved libraries");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check saved libraries");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    hasSavedSelection,
    serverUrl,
    serverId,
    serverName,
    libraries,
    isLoading,
    error,
    refresh,
  };
}
