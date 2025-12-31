"use client";

import { useEffect, useRef } from "react";
import { useAIAnalysis } from "@/hooks/use-ai-analysis";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Square } from "lucide-react";
import Link from "next/link";
import { AnalysisCardLayout } from "./analysis-card-layout";

interface AIAnalysisCardProps {
  scanId: number;
  movieCount: number;
  showCount: number;
  /** When true, renders without outer border/padding (for embedding in parent card) */
  embedded?: boolean;
  /** Callback when user wants to review suggestions (instead of navigating to /suggestions) */
  onReviewSuggestions?: () => void;
  /** If true, auto-start analysis on mount */
  autoStart?: boolean;
}

export function AIAnalysisCard({ scanId, movieCount, showCount, embedded = false, onReviewSuggestions, autoStart }: AIAnalysisCardProps) {
  const {
    status,
    progress,
    suggestionsCount,
    error,
    startAnalysis,
    cancelAnalysis,
    reset,
  } = useAIAnalysis();

  // Track if we've already auto-started
  const hasAutoStarted = useRef(false);

  // Auto-start analysis if requested
  useEffect(() => {
    if (autoStart && status === "idle" && scanId && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      startAnalysis(scanId);
    }
  }, [autoStart, status, scanId, startAnalysis]);

  const totalItems = movieCount + showCount;

  // Determine phase message
  const getPhaseMessage = () => {
    if (!progress) return "Ready to analyze";
    switch (progress.phase) {
      case "loading":
        return progress.message || "Loading...";
      case "analyzing":
        return progress.message || "AI is analyzing your library...";
      case "saving":
        return progress.message || "Saving suggestions...";
      case "complete":
        return `Generated ${suggestionsCount} collection suggestions`;
      default:
        return progress.message || "Processing...";
    }
  };

  const wrapperClass = embedded
    ? ""
    : "rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden";

  const innerClass = embedded ? "" : "p-6";
  const actionsClass = embedded
    ? "pt-4 flex justify-end gap-3"
    : "px-6 py-4 border-t border-white/5 flex justify-end gap-3";

  return (
    <div className={wrapperClass}>
      <div className={innerClass}>
        {/* Header - hidden when embedded and idle */}
        {!(embedded && status === "idle") && (
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className={`
                relative flex items-center justify-center w-12 h-12 rounded-xl
                ${status === "complete" ? "bg-emerald-500/20" :
                  status === "error" ? "bg-red-500/20" :
                  status === "analyzing" ? "bg-[#E5A00D]/20" : "bg-[#E5A00D]/10"}
              `}>
                {status === "idle" && <Sparkles className="h-6 w-6 text-[#E5A00D]" />}
                {status === "analyzing" && (
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
                  {status === "idle" && "AI Collection Analysis"}
                  {status === "analyzing" && "Analyzing Library"}
                  {status === "complete" && "Analysis Complete"}
                  {status === "error" && "Analysis Failed"}
                </h3>
                <p className="text-sm text-white/50">
                  {getPhaseMessage()}
                </p>
              </div>
            </div>

            {status === "complete" && suggestionsCount > 0 && (
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                {suggestionsCount} Suggestions
              </div>
            )}
            {status === "complete" && suggestionsCount === 0 && (
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-[#E5A00D]/20 text-[#E5A00D]">
                Up to date
              </div>
            )}
            {status === "error" && (
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                Error
              </div>
            )}
          </div>
        )}

        {/* Idle state - use shared layout when embedded */}
        {status === "idle" && embedded && (
          <AnalysisCardLayout
            label="Auto-detect collection opportunities"
            movieCount={movieCount}
            showCount={showCount}
            actionButton={
              <button
                onClick={() => startAnalysis(scanId)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E5A00D] text-black font-medium text-sm hover:bg-[#E5A00D]/90 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Generate Suggestions
              </button>
            }
            expandableContent={
              // Invisible placeholder to match height of "Show examples" in Custom Search
              <div className="h-5" aria-hidden="true" />
            }
          >
            <div className="h-full p-3 rounded-lg bg-white/5 border border-white/10">
              <ul className="text-sm text-white/40 space-y-1">
                <li>• Franchises and series</li>
                <li>• Director filmographies</li>
                <li>• Shared actors and themes</li>
                <li>• Genres and decades</li>
              </ul>
            </div>
          </AnalysisCardLayout>
        )}

        {/* Idle state - standalone (non-embedded) */}
        {status === "idle" && !embedded && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-white/70 mb-2">
                Auto-detect collection opportunities
              </p>
              <div className="min-h-[7rem] p-3 rounded-lg bg-white/5 border border-white/10">
                <ul className="text-sm text-white/40 space-y-1">
                  <li>• Franchises and series</li>
                  <li>• Director filmographies</li>
                  <li>• Shared actors and themes</li>
                  <li>• Genres and decades</li>
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <p className="text-xs text-white/30">
                {totalItems} items ({movieCount} movies, {showCount} shows)
              </p>
            </div>
          </div>
        )}

        {/* Analyzing state - show progress */}
        {status === "analyzing" && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/60">
                {progress?.phase === "loading" && "Loading..."}
                {progress?.phase === "analyzing" && "AI analyzing..."}
                {progress?.phase === "saving" && "Saving..."}
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#E5A00D] rounded-full transition-all duration-500"
                style={{
                  width: (() => {
                    if (!progress) return "5%";
                    if (progress.phase === "loading") return "10%";
                    if (progress.phase === "saving") return "95%";
                    if (progress.phase === "analyzing" && progress.pass && progress.totalPasses) {
                      // Progress from 15% to 90% based on pass
                      const passProgress = 15 + ((progress.pass - 1) / progress.totalPasses) * 75;
                      return `${Math.min(passProgress, 90)}%`;
                    }
                    // Analyzing phase but no pass info yet (e.g., "Starting multi-pass analysis...")
                    if (progress.phase === "analyzing") return "12%";
                    return "5%";
                  })()
                }}
              />
            </div>
          </div>
        )}

        {/* Complete state - show results preview */}
        {status === "complete" && suggestionsCount > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm text-white">
                  Found <span className="font-semibold text-emerald-400">{suggestionsCount}</span> collection opportunities
                </p>
                <p className="text-xs text-white/50 mt-0.5">
                  Review and approve suggestions to create collections in Plex
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Complete with 0 suggestions - nothing new found */}
        {status === "complete" && suggestionsCount === 0 && (
          <div className="mb-6 p-4 rounded-lg bg-[#E5A00D]/5 border border-[#E5A00D]/20">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#E5A00D] shrink-0" />
              <div>
                <p className="text-sm text-white">
                  {progress?.message || "No new collections found"}
                </p>
                <p className="text-xs text-white/50 mt-0.5">
                  Try a custom search below for specific themes or genres
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Actions - hidden when embedded and idle (button is in layout) */}
      {!(embedded && status === "idle") && (
        <div className={actionsClass}>
          {status === "idle" && (
            <button
              onClick={() => startAnalysis(scanId)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E5A00D] text-black font-medium text-sm hover:bg-[#E5A00D]/90 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Generate Suggestions
            </button>
          )}
        {status === "analyzing" && (
          <button
            onClick={cancelAnalysis}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/20 transition-colors"
          >
            <Square className="h-4 w-4" />
            Cancel
          </button>
        )}
        {status === "complete" && suggestionsCount > 0 && (
          <>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/20 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </button>
            {onReviewSuggestions ? (
              <button
                onClick={onReviewSuggestions}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E5A00D] text-black font-medium text-sm hover:bg-[#E5A00D]/90 transition-colors"
              >
                Review Suggestions
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link
                href="/suggestions"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E5A00D] text-black font-medium text-sm hover:bg-[#E5A00D]/90 transition-colors"
              >
                Review Suggestions
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </>
        )}
        {status === "complete" && suggestionsCount === 0 && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/20 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        )}
        {status === "error" && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/20 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        )}
        </div>
      )}
    </div>
  );
}
