"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface PlexStatus {
  connected: boolean;
  serverUrl?: string;
  serverId?: string;
}

interface PlexAuthState {
  status: PlexStatus | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  error: string | null;
  pinId: number | null;
}

interface UsePlexAuthReturn extends PlexAuthState {
  startAuth: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_TIME = 10 * 60 * 1000; // 10 minutes

export function usePlexAuth(): UsePlexAuthReturn {
  const [state, setState] = useState<PlexAuthState>({
    status: null,
    isLoading: true,
    isAuthenticating: false,
    error: null,
    pinId: null,
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartTimeRef = useRef<number>(0);
  const authWindowRef = useRef<Window | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Fetch current connection status
  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/plex/status");
      const data = await response.json();

      if (data.success) {
        setState((prev) => ({
          ...prev,
          status: {
            connected: data.connected,
            serverUrl: data.serverUrl,
            serverId: data.serverId,
          },
          isLoading: false,
          error: null,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: { connected: false },
          isLoading: false,
          error: data.error || "Failed to get status",
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: { connected: false },
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to get status",
      }));
    }
  }, []);

  // Initial status fetch
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Poll for authentication completion
  const pollForAuth = useCallback(async (pinId: number) => {
    try {
      const response = await fetch("/api/plex/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinId }),
      });

      const data = await response.json();

      if (data.success) {
        // Auth complete - stop polling and refresh status
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        // Close the auth popup window
        if (authWindowRef.current && !authWindowRef.current.closed) {
          authWindowRef.current.close();
          authWindowRef.current = null;
        }

        // Clean up URL query params
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          if (url.searchParams.has("plex")) {
            url.searchParams.delete("plex");
            window.history.replaceState({}, "", url.pathname);
          }
        }

        setState((prev) => ({
          ...prev,
          isAuthenticating: false,
          pinId: null,
        }));

        // Refresh to get updated status
        await refreshStatus();
        return true;
      }

      // Check if we've exceeded max poll time
      if (Date.now() - pollStartTimeRef.current > MAX_POLL_TIME) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        // Close the auth popup window on timeout
        if (authWindowRef.current && !authWindowRef.current.closed) {
          authWindowRef.current.close();
          authWindowRef.current = null;
        }

        setState((prev) => ({
          ...prev,
          isAuthenticating: false,
          pinId: null,
          error: "Authentication timed out. Please try again.",
        }));
        return true;
      }

      return false;
    } catch (err) {
      console.error("Error polling for auth:", err);
      return false;
    }
  }, [refreshStatus]);

  // Start the authentication flow
  const startAuth = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isAuthenticating: true,
      error: null,
    }));

    try {
      const response = await fetch("/api/plex/auth");
      const data = await response.json();

      if (!data.success) {
        setState((prev) => ({
          ...prev,
          isAuthenticating: false,
          error: data.error || "Failed to start authentication",
        }));
        return;
      }

      // Store the PIN ID
      setState((prev) => ({
        ...prev,
        pinId: data.pinId,
      }));

      // Open Plex login in new window and store reference
      authWindowRef.current = window.open(data.loginUrl, "plex-auth", "width=600,height=700");

      // Start polling for auth completion
      pollStartTimeRef.current = Date.now();
      pollIntervalRef.current = setInterval(async () => {
        const complete = await pollForAuth(data.pinId);
        if (complete && pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }, POLL_INTERVAL);

      // Also check if the popup was closed by user
      const popupCheckInterval = setInterval(() => {
        if (authWindowRef.current && authWindowRef.current.closed) {
          clearInterval(popupCheckInterval);
          // Don't stop polling immediately - user might have completed auth
          // The polling will timeout or succeed on its own
        }
      }, 1000);

    } catch (err) {
      setState((prev) => ({
        ...prev,
        isAuthenticating: false,
        error: err instanceof Error ? err.message : "Failed to start authentication",
      }));
    }
  }, [pollForAuth]);

  // Disconnect from Plex
  const disconnect = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await fetch("/api/plex/auth", {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setState((prev) => ({
          ...prev,
          status: { connected: false },
          isLoading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || "Failed to disconnect",
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to disconnect",
      }));
    }
  }, []);

  return {
    ...state,
    startAuth,
    disconnect,
    refreshStatus,
  };
}
