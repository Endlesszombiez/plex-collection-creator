"use client";

import { useState, useCallback, useEffect } from "react";

interface ServerInfo {
  name: string;
  clientIdentifier: string;
  owned: boolean;
  uri: string | null;
  accessToken: string;
  online: boolean;
}

interface LibraryInfo {
  key: string;
  title: string;
  type: "movie" | "show";
  uuid: string;
}

interface UsePlexServersReturn {
  servers: ServerInfo[];
  selectedServer: ServerInfo | null;
  libraries: LibraryInfo[];
  selectedLibraries: string[];
  isLoadingServers: boolean;
  isLoadingLibraries: boolean;
  isSaving: boolean;
  error: string | null;
  fetchServers: () => Promise<void>;
  selectServer: (server: ServerInfo) => Promise<void>;
  toggleLibrary: (libraryKey: string) => void;
  selectAllLibraries: () => void;
  deselectAllLibraries: () => void;
  saveSelection: () => Promise<boolean>;
}

export function usePlexServers(): UsePlexServersReturn {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [selectedServer, setSelectedServer] = useState<ServerInfo | null>(null);
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(false);
  const [isLoadingLibraries, setIsLoadingLibraries] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available servers
  const fetchServers = useCallback(async () => {
    setIsLoadingServers(true);
    setError(null);

    try {
      const response = await fetch("/api/plex/servers");
      const data = await response.json();

      if (data.success) {
        setServers(data.servers);

        // Auto-select first online server if none selected
        if (!selectedServer) {
          const onlineServer = data.servers.find((s: ServerInfo) => s.online);
          if (onlineServer) {
            await selectServerInternal(onlineServer);
          }
        }
      } else {
        setError(data.error || "Failed to fetch servers");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch servers");
    } finally {
      setIsLoadingServers(false);
    }
  }, [selectedServer]);

  // Internal server selection (to avoid dependency issues)
  const selectServerInternal = async (server: ServerInfo) => {
    if (!server.online || !server.uri) {
      setError("Server is not reachable");
      return;
    }

    setSelectedServer(server);
    setLibraries([]);
    setSelectedLibraries([]);
    setIsLoadingLibraries(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        serverUri: server.uri,
        accessToken: server.accessToken,
      });

      const response = await fetch(`/api/plex/libraries?${params}`);
      const data = await response.json();

      if (data.success) {
        setLibraries(data.libraries);
        // Auto-select all libraries by default
        setSelectedLibraries(data.libraries.map((lib: LibraryInfo) => lib.key));
      } else {
        setError(data.error || "Failed to fetch libraries");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch libraries");
    } finally {
      setIsLoadingLibraries(false);
    }
  };

  // Select a server and fetch its libraries
  const selectServer = useCallback(async (server: ServerInfo) => {
    await selectServerInternal(server);
  }, []);

  // Toggle a library selection
  const toggleLibrary = useCallback((libraryKey: string) => {
    setSelectedLibraries((prev) =>
      prev.includes(libraryKey)
        ? prev.filter((key) => key !== libraryKey)
        : [...prev, libraryKey]
    );
  }, []);

  // Select all libraries
  const selectAllLibraries = useCallback(() => {
    setSelectedLibraries(libraries.map((lib) => lib.key));
  }, [libraries]);

  // Deselect all libraries
  const deselectAllLibraries = useCallback(() => {
    setSelectedLibraries([]);
  }, []);

  // Save the selection to the database
  const saveSelection = useCallback(async (): Promise<boolean> => {
    if (!selectedServer || !selectedServer.uri) {
      setError("No server selected");
      return false;
    }

    if (selectedLibraries.length === 0) {
      setError("Please select at least one library");
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const selectedLibraryDetails = libraries
        .filter((lib) => selectedLibraries.includes(lib.key))
        .map((lib) => ({
          key: lib.key,
          title: lib.title,
          type: lib.type,
          uuid: lib.uuid,
        }));

      const response = await fetch("/api/plex/libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUri: selectedServer.uri,
          serverId: selectedServer.clientIdentifier,
          serverName: selectedServer.name,
          libraries: selectedLibraryDetails,
        }),
      });

      const data = await response.json();

      if (data.success) {
        return true;
      } else {
        setError(data.error || "Failed to save selection");
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save selection");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [selectedServer, selectedLibraries, libraries]);

  return {
    servers,
    selectedServer,
    libraries,
    selectedLibraries,
    isLoadingServers,
    isLoadingLibraries,
    isSaving,
    error,
    fetchServers,
    selectServer,
    toggleLibrary,
    selectAllLibraries,
    deselectAllLibraries,
    saveSelection,
  };
}
