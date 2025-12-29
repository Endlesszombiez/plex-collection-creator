"use client";

import { usePlexAuth } from "@/hooks/use-plex-auth";

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

function PlexIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M11.643 0H4.68l7.679 12L4.68 24h6.963l7.677-12z" />
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

export function PlexConnectionCard() {
  const {
    status,
    isLoading,
    isAuthenticating,
    error,
    startAuth,
    disconnect,
  } = usePlexAuth();

  const isConnected = status?.connected ?? false;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center justify-center gap-3 py-4">
          <LoadingSpinner className="h-5 w-5 text-white/40" />
          <span className="text-white/40">Checking connection...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`
      rounded-xl border transition-all duration-500 overflow-hidden
      ${isConnected
        ? "border-emerald-500/30 bg-emerald-500/5"
        : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
      }
    `}>
      {/* Main content */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Icon container */}
            <div className={`
              relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-500
              ${isConnected
                ? "bg-emerald-500/20"
                : "bg-white/5"
              }
            `}>
              <PlexIcon className={`h-6 w-6 transition-colors duration-500 ${isConnected ? "text-emerald-400" : "text-white/60"}`} />
              {isConnected && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-[#1a1a1a]">
                  <CheckIcon className="w-3 h-3 text-white" />
                </div>
              )}
            </div>

            {/* Text */}
            <div>
              <h3 className="font-semibold text-white mb-0.5">Plex</h3>
              <p className="text-sm text-white/50">
                {isConnected
                  ? "Your account is connected"
                  : "Sign in to access your libraries"}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <div className={`
            px-3 py-1 rounded-full text-xs font-medium transition-all duration-500
            ${isConnected
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-white/5 text-white/40"
            }
          `}>
            {isConnected ? "Connected" : "Not connected"}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Authenticating state */}
        {isAuthenticating && (
          <div className="mt-4 p-4 rounded-lg bg-[#E5A00D]/10 border border-[#E5A00D]/20">
            <div className="flex items-center gap-3">
              <LoadingSpinner className="h-5 w-5 text-[#E5A00D]" />
              <div>
                <p className="text-sm font-medium text-[#E5A00D]">Waiting for authentication...</p>
                <p className="text-xs text-[#E5A00D]/60 mt-0.5">Complete the login in the popup window</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with action */}
      <div className="px-6 py-4 border-t border-white/5 flex justify-end">
        {isConnected ? (
          <button
            onClick={disconnect}
            disabled={isLoading}
            className="
              px-4 py-2 rounded-lg text-sm font-medium
              text-red-400 hover:text-red-300
              bg-red-500/10 hover:bg-red-500/20
              border border-red-500/20 hover:border-red-500/30
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={startAuth}
            disabled={isAuthenticating}
            className="
              inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold
              bg-[#E5A00D] hover:bg-[#E5A00D]/90 active:bg-[#E5A00D]/80
              text-black
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-lg shadow-[#E5A00D]/20
            "
          >
            {isAuthenticating ? (
              <>
                <LoadingSpinner className="h-4 w-4" />
                Connecting...
              </>
            ) : (
              <>
                <PlexIcon className="h-4 w-4" />
                Connect with Plex
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
