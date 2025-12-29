"use client";

import { useAIAnalysis } from "@/hooks/use-ai-analysis";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, Square } from "lucide-react";
import Link from "next/link";

interface AIAnalysisCardProps {
  scanId: number;
  movieCount: number;
  showCount: number;
}

export function AIAnalysisCard({ scanId, movieCount, showCount }: AIAnalysisCardProps) {
  const {
    status,
    progress,
    suggestionsCount,
    error,
    startAnalysis,
    cancelAnalysis,
    reset,
  } = useAIAnalysis();

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

          {status === "complete" && (
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
              {suggestionsCount} Suggestions
            </div>
          )}
          {status === "error" && (
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
              Error
            </div>
          )}
        </div>

        {/* Idle state - show what will be analyzed */}
        {status === "idle" && (
          <div className="mb-6 p-4 rounded-lg bg-white/5">
            <p className="text-sm text-white/60 mb-2">
              AI will analyze your library and suggest collections based on:
            </p>
            <ul className="text-sm text-white/40 space-y-1">
              <li>• Franchises and series</li>
              <li>• Director filmographies</li>
              <li>• Shared actors and themes</li>
              <li>• Genres and decades</li>
            </ul>
            <p className="text-xs text-white/30 mt-3">
              {totalItems} items will be analyzed ({movieCount} movies, {showCount} shows)
            </p>
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
                className="h-full bg-[#E5A00D] rounded-full transition-all duration-1000 animate-pulse"
                style={{
                  width: progress?.phase === "loading" ? "20%" :
                         progress?.phase === "analyzing" ? "60%" :
                         progress?.phase === "saving" ? "90%" : "0%"
                }}
              />
            </div>
          </div>
        )}

        {/* Complete state - show results preview */}
        {status === "complete" && (
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

        {/* Error state */}
        {status === "error" && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
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
        {status === "complete" && (
          <>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/20 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </button>
            <Link
              href="/suggestions"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E5A00D] text-black font-medium text-sm hover:bg-[#E5A00D]/90 transition-colors"
            >
              Review Suggestions
              <ArrowRight className="h-4 w-4" />
            </Link>
          </>
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
    </div>
  );
}
