"use client";

import { useEffect, useState, useRef } from "react";
import { usePlexServers } from "@/hooks/use-plex-servers";
import { useSavedLibraries } from "@/hooks/use-saved-libraries";

function LoadingSpinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function MovieIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
    </svg>
  );
}

function TvIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

interface LibrarySelectionCardProps {
  isPlexConnected: boolean;
  onComplete?: () => void;
}

export function LibrarySelectionCard({ isPlexConnected, onComplete }: LibrarySelectionCardProps) {
  const {
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
    saveSelection,
  } = usePlexServers();

  const {
    hasSavedSelection,
    serverName: savedServerName,
    libraries: savedLibraries,
    isLoading: isLoadingSaved,
    refresh: refreshSaved,
  } = useSavedLibraries();

  const [showForm, setShowForm] = useState(false);
  const prevConnectedRef = useRef<boolean | null>(null);

  // Refresh saved libraries when Plex connection status changes
  useEffect(() => {
    // On initial render or when connection status changes, refresh
    if (prevConnectedRef.current !== null && prevConnectedRef.current !== isPlexConnected) {
      refreshSaved();
    }
    prevConnectedRef.current = isPlexConnected;
  }, [isPlexConnected, refreshSaved]);

  // Fetch servers when Plex is connected and we're showing the form
  useEffect(() => {
    if (isPlexConnected && servers.length === 0 && !isLoadingServers && (showForm || !hasSavedSelection)) {
      fetchServers();
    }
  }, [isPlexConnected, servers.length, isLoadingServers, fetchServers, showForm, hasSavedSelection]);

  const handleSave = async () => {
    const success = await saveSelection();
    if (success) {
      setShowForm(false);
      refreshSaved();
      onComplete?.();
    }
  };

  // Not connected state - matches configured card structure
  if (!isPlexConnected) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                <ServerIcon className="w-6 h-6 text-white/30" />
              </div>
              <div>
                <h3 className="font-semibold text-white/40 mb-0.5">Libraries</h3>
                <p className="text-sm text-white/30">Connect Plex to select libraries</p>
              </div>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-white/30">
              Not configured
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-white/5 flex justify-end">
          <div className="h-10 w-36 rounded-lg bg-white/5" />
        </div>
      </div>
    );
  }

  // Loading saved state - skeleton matches loaded structure
  if (isLoadingSaved) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 animate-pulse" />
              <div>
                <div className="h-5 w-32 bg-white/10 rounded animate-pulse mb-1.5" />
                <div className="h-4 w-40 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
            <div className="h-6 w-24 bg-white/5 rounded-full animate-pulse" />
          </div>
          <div className="mt-4 flex gap-2">
            <div className="h-8 w-24 bg-white/5 rounded-lg animate-pulse" />
            <div className="h-8 w-28 bg-white/5 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-white/5 flex justify-end">
          <div className="h-10 w-36 bg-white/5 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  // Saved state (not editing)
  if (hasSavedSelection && !showForm) {
    const movieLibraries = savedLibraries.filter(lib => lib.type === "movie");
    const showLibraries = savedLibraries.filter(lib => lib.type === "show");

    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/20">
                <ServerIcon className="h-6 w-6 text-emerald-400" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-[#1a1a1a]">
                  <CheckIcon className="w-3 h-3 text-white" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-0.5">Libraries Selected</h3>
                <p className="text-sm text-white/50">
                  {savedLibraries.length} {savedLibraries.length === 1 ? "library" : "libraries"} from {savedServerName || "server"}
                </p>
              </div>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
              Configured
            </div>
          </div>

          {/* Show selected libraries */}
          <div className="mt-4 flex flex-wrap gap-2">
            {movieLibraries.map(lib => (
              <div key={lib.key} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-sm">
                <MovieIcon className="w-4 h-4 text-[#E5A00D]" />
                <span className="text-white/80">{lib.title}</span>
              </div>
            ))}
            {showLibraries.map(lib => (
              <div key={lib.key} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-sm">
                <TvIcon className="w-4 h-4 text-[#E5A00D]" />
                <span className="text-white/80">{lib.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/5 flex justify-end">
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
          >
            Change Selection
          </button>
        </div>
      </div>
    );
  }

  // Loading servers state
  if (isLoadingServers) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center justify-center gap-3 py-8">
          <LoadingSpinner className="h-5 w-5 text-[#E5A00D]" />
          <span className="text-white/60">Discovering Plex servers...</span>
        </div>
      </div>
    );
  }

  // No servers found
  if (servers.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <ServerIcon className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-white/60 text-sm mb-4">No Plex servers found</p>
        <button
          onClick={fetchServers}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      {/* Server Selection */}
      <div className="p-6 border-b border-white/5">
        <h3 className="text-sm font-medium text-white/80 mb-4">Select Server</h3>
        <div className="space-y-2">
          {servers.map((server) => (
            <button
              key={server.clientIdentifier}
              onClick={() => selectServer(server)}
              disabled={!server.online}
              className={`
                w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all
                ${selectedServer?.clientIdentifier === server.clientIdentifier
                  ? "bg-[#E5A00D]/10 border border-[#E5A00D]/30"
                  : server.online
                    ? "bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                    : "bg-white/[0.01] border border-white/5 opacity-50 cursor-not-allowed"
                }
              `}
            >
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center
                ${selectedServer?.clientIdentifier === server.clientIdentifier
                  ? "bg-[#E5A00D]/20"
                  : "bg-white/5"
                }
              `}>
                <ServerIcon className={`w-5 h-5 ${
                  selectedServer?.clientIdentifier === server.clientIdentifier
                    ? "text-[#E5A00D]"
                    : "text-white/40"
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{server.name}</p>
                <p className="text-xs text-white/40">
                  {server.online ? (server.owned ? "Owned" : "Shared") : "Offline"}
                </p>
              </div>
              {selectedServer?.clientIdentifier === server.clientIdentifier && (
                <div className="w-5 h-5 rounded-full bg-[#E5A00D] flex items-center justify-center">
                  <CheckIcon className="w-3 h-3 text-black" />
                </div>
              )}
              {!server.online && (
                <span className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400">
                  Offline
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Library Selection */}
      {selectedServer && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white/80">Select Libraries</h3>
            {libraries.length > 0 && (
              <span className="text-xs text-white/40">
                {selectedLibraries.length} of {libraries.length} selected
              </span>
            )}
          </div>

          {isLoadingLibraries ? (
            <div className="flex items-center justify-center gap-3 py-8">
              <LoadingSpinner className="h-5 w-5 text-[#E5A00D]" />
              <span className="text-white/60">Loading libraries...</span>
            </div>
          ) : libraries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/40 text-sm">No movie or TV show libraries found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {libraries.map((library) => (
                <button
                  key={library.key}
                  onClick={() => toggleLibrary(library.key)}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all
                    ${selectedLibraries.includes(library.key)
                      ? "bg-[#E5A00D]/10 border border-[#E5A00D]/30"
                      : "bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                    }
                  `}
                >
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center
                    ${selectedLibraries.includes(library.key)
                      ? "bg-[#E5A00D]/20"
                      : "bg-white/5"
                    }
                  `}>
                    {library.type === "movie" ? (
                      <MovieIcon className={`w-5 h-5 ${
                        selectedLibraries.includes(library.key)
                          ? "text-[#E5A00D]"
                          : "text-white/40"
                      }`} />
                    ) : (
                      <TvIcon className={`w-5 h-5 ${
                        selectedLibraries.includes(library.key)
                          ? "text-[#E5A00D]"
                          : "text-white/40"
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{library.title}</p>
                    <p className="text-xs text-white/40 capitalize">{library.type === "show" ? "TV Shows" : "Movies"}</p>
                  </div>
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                    ${selectedLibraries.includes(library.key)
                      ? "bg-[#E5A00D] border-[#E5A00D]"
                      : "border-white/20"
                    }
                  `}>
                    {selectedLibraries.includes(library.key) && (
                      <CheckIcon className="w-3 h-3 text-black" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-6 pb-4">
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Save Button */}
      {selectedServer && libraries.length > 0 && (
        <div className="px-6 py-4 border-t border-white/5 flex justify-between">
          {hasSavedSelection && showForm ? (
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
            >
              Cancel
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || selectedLibraries.length === 0}
            className="
              inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
              bg-[#E5A00D] hover:bg-[#E5A00D]/90 active:bg-[#E5A00D]/80
              text-black
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-lg shadow-[#E5A00D]/20
            "
          >
            {isSaving ? (
              <>
                <LoadingSpinner className="h-4 w-4" />
                Saving...
              </>
            ) : (
              "Save Selection"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
