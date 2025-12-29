"use client";

import { useEffect, useRef } from "react";
import { useLibraryScan } from "@/hooks/use-library-scan";
import { Film, Tv, Play, Square, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

interface ScanProgressCardProps {
  onScanComplete?: (movies: number, shows: number, scanId: number) => void;
}

export function ScanProgressCard({ onScanComplete }: ScanProgressCardProps) {
  const {
    status,
    progress,
    movies,
    shows,
    scanId,
    error,
    startScan,
    cancelScan,
    reset,
  } = useLibraryScan();

  // Track if we've already notified to prevent multiple calls
  const hasNotified = useRef(false);

  // Notify parent when scan completes (in useEffect to avoid setState during render)
  useEffect(() => {
    if (status === "complete" && onScanComplete && scanId && !hasNotified.current) {
      hasNotified.current = true;
      onScanComplete(movies.length, shows.length, scanId);
    }
    // Reset notification flag when status changes away from complete
    if (status !== "complete") {
      hasNotified.current = false;
    }
  }, [status, scanId, movies.length, shows.length, onScanComplete]);

  const progressPercent =
    progress?.totalItems && progress?.itemsFetched
      ? Math.round((progress.itemsFetched / progress.totalItems) * 100)
      : 0;

  const overallPercent =
    progress?.totalLibraries && progress?.libraryIndex !== undefined
      ? Math.round(
          ((progress.libraryIndex + (progressPercent / 100)) / progress.totalLibraries) * 100
        )
      : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className={`
              relative flex items-center justify-center w-12 h-12 rounded-xl
              ${status === "complete" ? "bg-emerald-500/20" :
                status === "error" ? "bg-red-500/20" :
                status === "scanning" ? "bg-[#E5A00D]/20" : "bg-white/5"}
            `}>
              {status === "idle" && <Play className="h-6 w-6 text-white/50" />}
              {status === "scanning" && (
                <Loader2 className="h-6 w-6 text-[#E5A00D] animate-spin" />
              )}
              {status === "complete" && (
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              )}
              {status === "error" && (
                <AlertCircle className="h-6 w-6 text-red-400" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white mb-0.5">
                {status === "idle" && "Ready to Scan"}
                {status === "scanning" && "Scanning Libraries"}
                {status === "complete" && "Scan Complete"}
                {status === "error" && "Scan Failed"}
              </h3>
              <p className="text-sm text-white/50">
                {status === "idle" && "Scan your libraries to find collection opportunities"}
                {status === "scanning" && (progress?.message || "Starting scan...")}
                {status === "complete" && `Found ${movies.length} movies and ${shows.length} shows`}
                {status === "error" && (error || "An error occurred")}
              </p>
            </div>
          </div>

          {status === "complete" && (
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
              Complete
            </div>
          )}
          {status === "error" && (
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
              Error
            </div>
          )}
        </div>

        {/* Progress bar (during scan) */}
        {status === "scanning" && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/60">
                Library {(progress?.libraryIndex ?? 0) + 1} of {progress?.totalLibraries || "?"}
                {progress?.library && `: ${progress.library}`}
              </span>
              <span className="text-white/60">{overallPercent}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#E5A00D] rounded-full transition-all duration-300"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
            {progress?.totalItems && (
              <p className="text-xs text-white/40 mt-2">
                {progress.itemsFetched || 0} / {progress.totalItems} items
              </p>
            )}
          </div>
        )}

        {/* Results (after scan) */}
        {status === "complete" && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-white/5">
              <div className="flex items-center gap-3 mb-2">
                <Film className="h-5 w-5 text-[#E5A00D]" />
                <span className="text-sm font-medium text-white">Movies</span>
              </div>
              <p className="text-2xl font-bold text-white">{movies.length}</p>
            </div>
            <div className="p-4 rounded-lg bg-white/5">
              <div className="flex items-center gap-3 mb-2">
                <Tv className="h-5 w-5 text-[#E5A00D]" />
                <span className="text-sm font-medium text-white">TV Shows</span>
              </div>
              <p className="text-2xl font-bold text-white">{shows.length}</p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
        {status === "idle" && (
          <button
            onClick={startScan}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E5A00D] text-black font-medium text-sm hover:bg-[#E5A00D]/90 transition-colors"
          >
            <Play className="h-4 w-4" />
            Start Scan
          </button>
        )}
        {status === "scanning" && (
          <button
            onClick={cancelScan}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/20 transition-colors"
          >
            <Square className="h-4 w-4" />
            Cancel
          </button>
        )}
        {(status === "complete" || status === "error") && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/20 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Scan Again
          </button>
        )}
      </div>
    </div>
  );
}
