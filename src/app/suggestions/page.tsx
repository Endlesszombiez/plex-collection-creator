"use client";

import { useState } from "react";
import { useSuggestions, Suggestion } from "@/hooks/use-suggestions";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  X,
  Trash2,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Upload,
  Film,
  Tv,
} from "lucide-react";

function SuggestionCard({
  suggestion,
  onApprove,
  onReject,
  onRemove,
  onApply,
  isApplying,
}: {
  suggestion: Suggestion;
  onApprove: () => void;
  onReject: () => void;
  onRemove: () => void;
  onApply: () => void;
  isApplying: boolean;
}) {
  const statusColors = {
    pending: "border-white/10 bg-white/[0.02]",
    approved: "border-emerald-500/30 bg-emerald-500/5",
    rejected: "border-red-500/20 bg-red-500/5",
    applied: "border-[#E5A00D]/30 bg-[#E5A00D]/5",
  };

  const statusBadges = {
    pending: null,
    approved: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </span>
    ),
    rejected: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
        <XCircle className="h-3 w-3" />
        Rejected
      </span>
    ),
    applied: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#E5A00D]/20 text-[#E5A00D]">
        <CheckCircle2 className="h-3 w-3" />
        Applied to Plex
      </span>
    ),
  };

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors ${statusColors[suggestion.status]}`}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-white text-lg">{suggestion.collectionName}</h3>
            <p className="text-sm text-white/50">
              {suggestion.itemCount} items
            </p>
          </div>
          {statusBadges[suggestion.status]}
        </div>

        {/* Reasoning */}
        {suggestion.reasoning && (
          <p className="text-sm text-white/60 mb-4 line-clamp-2">
            {suggestion.reasoning}
          </p>
        )}

        {/* Item preview */}
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Film className="h-3.5 w-3.5" />
          <span>Rating keys: {suggestion.items.slice(0, 3).join(", ")}</span>
          {suggestion.items.length > 3 && (
            <span>+{suggestion.items.length - 3} more</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
        {suggestion.status === "pending" && (
          <>
            <button
              onClick={onRemove}
              className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onReject}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
                Reject
              </button>
              <button
                onClick={onApprove}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
              >
                <Check className="h-4 w-4" />
                Approve
              </button>
            </div>
          </>
        )}

        {suggestion.status === "approved" && (
          <>
            <button
              onClick={onReject}
              className="text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Undo
            </button>
            <button
              onClick={onApply}
              disabled={isApplying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E5A00D] text-black text-sm font-medium hover:bg-[#E5A00D]/90 transition-colors disabled:opacity-50"
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Apply to Plex
            </button>
          </>
        )}

        {suggestion.status === "rejected" && (
          <>
            <button
              onClick={onRemove}
              className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onApprove}
              className="text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Restore
            </button>
          </>
        )}

        {suggestion.status === "applied" && (
          <span className="text-sm text-white/40">
            Collection created in Plex
          </span>
        )}
      </div>
    </div>
  );
}

export default function SuggestionsPage() {
  const { suggestions, isLoading, error, approve, reject, remove, approveAll } = useSuggestions();
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "applied">("all");

  const handleApply = async (suggestion: Suggestion) => {
    setApplyingId(suggestion.id);
    try {
      const response = await fetch("/api/plex/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId: suggestion.id,
          collectionName: suggestion.collectionName,
          items: suggestion.items,
        }),
      });
      const data = await response.json();

      if (data.success) {
        // Refresh to show updated status
        window.location.reload();
      } else {
        alert(data.error || "Failed to apply collection");
      }
    } catch (err) {
      alert("Failed to apply collection");
    } finally {
      setApplyingId(null);
    }
  };

  const filteredSuggestions = suggestions.filter((s) => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;
  const approvedCount = suggestions.filter((s) => s.status === "approved").length;
  const appliedCount = suggestions.filter((s) => s.status === "applied").length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E5A00D] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-[#E5A00D]/5 blur-[120px]" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-[#E5A00D]/3 blur-[100px]" />
      </div>

      <main className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-4 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
                Collection Suggestions
              </h1>
              <p className="text-white/60">
                Review AI-generated collections and apply them to Plex
              </p>
            </div>
          </div>

          {/* Stats & Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "all"
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              All ({suggestions.length})
            </button>
            <button
              onClick={() => setFilter("pending")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "pending"
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilter("approved")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "approved"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              onClick={() => setFilter("applied")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === "applied"
                  ? "bg-[#E5A00D]/20 text-[#E5A00D]"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              Applied ({appliedCount})
            </button>

            {pendingCount > 0 && (
              <button
                onClick={approveAll}
                className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
              >
                <Check className="h-4 w-4" />
                Approve All
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-8">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {filteredSuggestions.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-white/30" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No suggestions</h3>
              <p className="text-white/50 mb-6">
                {filter === "all"
                  ? "Run an AI analysis from the dashboard to generate collection suggestions."
                  : `No ${filter} suggestions.`}
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E5A00D] text-black font-medium text-sm hover:bg-[#E5A00D]/90 transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          )}

          {/* Suggestions grid */}
          {filteredSuggestions.length > 0 && (
            <div className="grid gap-4">
              {filteredSuggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onApprove={() => approve(suggestion.id)}
                  onReject={() => reject(suggestion.id)}
                  onRemove={() => remove(suggestion.id)}
                  onApply={() => handleApply(suggestion)}
                  isApplying={applyingId === suggestion.id}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
