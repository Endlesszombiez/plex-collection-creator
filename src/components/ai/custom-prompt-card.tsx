"use client";

import { useState } from "react";
import { useCustomAnalysis } from "@/hooks/use-custom-analysis";
import {
  Wand2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Square,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { AnalysisCardLayout } from "./analysis-card-layout";

interface CustomPromptCardProps {
  scanId: number;
  movieCount: number;
  showCount: number;
  /** When true, renders without outer border/padding (for embedding in parent card) */
  embedded?: boolean;
  /** Callback when user wants to review suggestions (instead of navigating to /suggestions) */
  onReviewSuggestions?: () => void;
}

const EXAMPLE_PROMPTS = [
  {
    title: "Holiday Movies",
    prompt: "Find all Christmas and holiday-themed movies for a seasonal collection",
  },
  {
    title: "Award Winners",
    prompt: "Group movies that have won major awards (Oscars, Golden Globes, BAFTAs)",
  },
  {
    title: "Cult Classics",
    prompt: "Identify cult classic films that have gained dedicated followings over time",
  },
  {
    title: "Hidden Gems",
    prompt: "Find underrated movies with high ratings but lower popularity",
  },
  {
    title: "Mind-Benders",
    prompt: "Group movies with complex plots, plot twists, or psychological themes",
  },
  {
    title: "90s Nostalgia",
    prompt: "Create a collection of iconic movies from the 1990s",
  },
];

export function CustomPromptCard({ scanId, movieCount, showCount, embedded = false, onReviewSuggestions }: CustomPromptCardProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [showExamples, setShowExamples] = useState(false);

  const {
    status,
    progress,
    suggestionsCount,
    error,
    startAnalysis,
    cancelAnalysis,
    reset,
  } = useCustomAnalysis();

  const totalItems = movieCount + showCount;

  const wrapperClass = embedded
    ? ""
    : "rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden";

  const innerClass = embedded ? "" : "p-6";
  const actionsClass = embedded
    ? "pt-4 flex justify-end gap-3"
    : "px-6 py-4 border-t border-white/5 flex justify-end gap-3";

  const handleStartAnalysis = () => {
    if (customPrompt.trim()) {
      startAnalysis(scanId, customPrompt.trim());
    }
  };

  const handleExampleClick = (prompt: string) => {
    setCustomPrompt(prompt);
    setShowExamples(false);
  };

  const handleReset = () => {
    reset();
    setCustomPrompt("");
  };

  // Determine phase message
  const getPhaseMessage = () => {
    if (!progress) return "Ready for custom search";
    switch (progress.phase) {
      case "loading":
        return progress.message || "Loading...";
      case "analyzing":
        return progress.message || "AI is searching your library...";
      case "saving":
        return progress.message || "Saving results...";
      case "complete":
        return `Found ${suggestionsCount} matching items`;
      default:
        return progress.message || "Processing...";
    }
  };

  return (
    <div className={wrapperClass}>
      <div className={innerClass}>
        {/* Header - hidden when embedded and idle */}
        {!(embedded && status === "idle") && (
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div
                className={`
                relative flex items-center justify-center w-12 h-12 rounded-xl
                ${
                  status === "complete"
                    ? "bg-emerald-500/20"
                    : status === "error"
                      ? "bg-red-500/20"
                      : status === "analyzing"
                        ? "bg-purple-500/20"
                        : "bg-purple-500/10"
                }
              `}
              >
                {status === "idle" && <Wand2 className="h-6 w-6 text-purple-400" />}
                {status === "analyzing" && <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />}
                {status === "complete" && <CheckCircle2 className="h-6 w-6 text-emerald-400" />}
                {status === "error" && <AlertCircle className="h-6 w-6 text-red-400" />}
              </div>
              <div>
                <h3 className="font-semibold text-white mb-0.5">
                  {status === "idle" && "Custom Collection Search"}
                  {status === "analyzing" && "Searching Library"}
                  {status === "complete" && "Search Complete"}
                  {status === "error" && "Search Failed"}
                </h3>
                <p className="text-sm text-white/50">{getPhaseMessage()}</p>
              </div>
            </div>

            {status === "complete" && (
              <div className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                {suggestionsCount} Found
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
            label="Describe what you're looking for"
            labelAction={
              customPrompt ? (
                <button
                  onClick={() => setCustomPrompt("")}
                  className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              ) : undefined
            }
            movieCount={movieCount}
            showCount={showCount}
            actionButton={
              <button
                onClick={handleStartAnalysis}
                disabled={!customPrompt.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white font-medium text-sm hover:bg-purple-500/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-4 w-4" />
                Generate Suggestions
              </button>
            }
            expandableContent={
              <div>
                <button
                  onClick={() => setShowExamples(!showExamples)}
                  className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {showExamples ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showExamples ? "Hide examples" : "Show examples"}
                </button>
                {showExamples && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {EXAMPLE_PROMPTS.map((example) => (
                      <button
                        key={example.title}
                        onClick={() => handleExampleClick(example.prompt)}
                        className="text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-purple-500/30 transition-colors"
                      >
                        <p className="text-sm font-medium text-white mb-1">{example.title}</p>
                        <p className="text-xs text-white/40 line-clamp-2">{example.prompt}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            }
          >
            <textarea
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., Find all movies directed by Christopher Nolan..."
              className="w-full h-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-colors"
            />
          </AnalysisCardLayout>
        )}

        {/* Idle state - standalone (non-embedded) */}
        {status === "idle" && !embedded && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="custom-prompt-standalone" className="text-sm font-medium text-white/70">
                  Describe what you&apos;re looking for
                </label>
                {customPrompt && (
                  <button
                    onClick={() => setCustomPrompt("")}
                    className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>
              <textarea
                id="custom-prompt-standalone"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g., Find all movies directed by Christopher Nolan..."
                className="w-full min-h-[7rem] px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-colors"
              />
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
            <div className="p-3 rounded-lg bg-white/5 mb-4">
              <p className="text-sm text-white/60 italic">&ldquo;{customPrompt}&rdquo;</p>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/60">
                {progress?.phase === "loading" && "Loading..."}
                {progress?.phase === "analyzing" && "AI searching..."}
                {progress?.phase === "saving" && "Saving..."}
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-1000 animate-pulse"
                style={{
                  width:
                    progress?.phase === "loading"
                      ? "20%"
                      : progress?.phase === "analyzing"
                        ? "60%"
                        : progress?.phase === "saving"
                          ? "90%"
                          : "0%",
                }}
              />
            </div>
          </div>
        )}

        {/* Complete state - show results preview */}
        {status === "complete" && (
          <div className="mb-6">
            <div className="p-3 rounded-lg bg-white/5 mb-4">
              <p className="text-sm text-white/60 italic">&ldquo;{customPrompt}&rdquo;</p>
            </div>
            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm text-white">
                    Found <span className="font-semibold text-emerald-400">{suggestionsCount}</span> collection
                    {suggestionsCount !== 1 ? "s" : ""} matching your criteria
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">
                    Review and approve to create collections in Plex
                  </p>
                </div>
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
            <div className="flex flex-col w-full gap-3">
              <div className="flex justify-end">
                <button
                  onClick={handleStartAnalysis}
                  disabled={!customPrompt.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white font-medium text-sm hover:bg-purple-500/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Suggestions
                </button>
              </div>

              {/* Example prompts toggle */}
              <div>
                <button
                  onClick={() => setShowExamples(!showExamples)}
                  className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {showExamples ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showExamples ? "Hide examples" : "Show examples"}
                </button>
                {showExamples && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {EXAMPLE_PROMPTS.map((example) => (
                      <button
                        key={example.title}
                        onClick={() => handleExampleClick(example.prompt)}
                        className="text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-purple-500/30 transition-colors"
                      >
                        <p className="text-sm font-medium text-white mb-1">{example.title}</p>
                        <p className="text-xs text-white/40 line-clamp-2">{example.prompt}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/20 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              New Search
            </button>
            {onReviewSuggestions ? (
              <button
                onClick={onReviewSuggestions}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white font-medium text-sm hover:bg-purple-500/90 transition-colors"
              >
                Review Results
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link
                href="/suggestions"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white font-medium text-sm hover:bg-purple-500/90 transition-colors"
              >
                Review Results
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </>
        )}
        {status === "error" && (
          <button
            onClick={handleReset}
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
