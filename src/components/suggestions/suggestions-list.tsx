"use client";

import { useState } from "react";
import { useSuggestions, Suggestion, SuggestionItem } from "@/hooks/use-suggestions";
import {
  Check,
  X,
  Trash2,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Upload,
  Film,
  ChevronDown,
  ChevronUp,
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
  onApply: (items: SuggestionItem[]) => void;
  isApplying: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());

  const selectedItems = suggestion.items.filter(
    (item) => !excludedKeys.has(item.ratingKey)
  );
  const selectedCount = selectedItems.length;

  const toggleItem = (ratingKey: string) => {
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(ratingKey)) {
        next.delete(ratingKey);
      } else {
        next.add(ratingKey);
      }
      return next;
    });
  };

  const statusColors = {
    pending: "border-white/10 bg-white/[0.02]",
    approved: "border-emerald-500/30 bg-emerald-500/5",
    rejected: "border-red-500/20 bg-red-500/5",
    applied: "border-[#E5A00D]/30 bg-[#E5A00D]/5",
  };

  // Action buttons for top-right of card (replaces bottom action bar)
  const renderActions = () => {
    if (suggestion.status === "pending") {
      return (
        <div className="flex items-center gap-1.5">
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onReject}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-white/70 text-xs font-medium hover:bg-white/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
          <button
            onClick={onApprove}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            Approve
          </button>
        </div>
      );
    }
    if (suggestion.status === "approved") {
      return (
        <div className="flex items-center gap-1.5">
          <button
            onClick={onReject}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-white/70 text-xs font-medium hover:bg-white/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
          <button
            onClick={() => onApply(selectedItems)}
            disabled={isApplying || selectedCount === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E5A00D] text-black text-xs font-medium hover:bg-[#E5A00D]/90 transition-colors disabled:opacity-50"
          >
            {isApplying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Apply to Plex
          </button>
        </div>
      );
    }
    if (suggestion.status === "rejected") {
      return (
        <div className="flex items-center gap-1.5">
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onApprove}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-white/70 text-xs font-medium hover:bg-white/10 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            Restore
          </button>
        </div>
      );
    }
    // Applied status - just show badge
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#E5A00D]/20 text-[#E5A00D]">
        <CheckCircle2 className="h-3 w-3" />
        Applied to Plex
      </span>
    );
  };

  // Format item display
  const formatItem = (item: SuggestionItem) => {
    if (item.year) {
      return `${item.title} (${item.year})`;
    }
    return item.title;
  };

  // Get preview text for collapsed view
  const getPreviewText = () => {
    const previewItems = suggestion.items.slice(0, 3);
    const preview = previewItems.map(formatItem).join(", ");
    if (suggestion.items.length > 3) {
      return `${preview} +${suggestion.items.length - 3} more`;
    }
    return preview;
  };

  // Checkboxes editable for pending and approved (not applied or rejected)
  const canEditItems = suggestion.status === "pending" || suggestion.status === "approved";

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors ${statusColors[suggestion.status]}`}>
      {/* Header with actions */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-left"
            >
              <h3 className="font-semibold text-white text-lg">{suggestion.collectionName}</h3>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-white/40" />
              ) : (
                <ChevronDown className="h-4 w-4 text-white/40" />
              )}
            </button>
            <p className="text-sm text-white/50">
              {suggestion.itemCount} items
              {excludedKeys.size > 0 && canEditItems && (
                <span className="text-amber-400"> ({selectedCount} selected)</span>
              )}
            </p>
          </div>
          {renderActions()}
        </div>

        {/* Reasoning */}
        {suggestion.reasoning && (
          <p className="text-sm text-white/60 mb-4 line-clamp-2">
            {suggestion.reasoning}
          </p>
        )}

        {/* Item preview (collapsed) */}
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            <Film className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{getPreviewText()}</span>
          </button>
        )}
      </div>

      {/* Expanded items list */}
      {isExpanded && (
        <div className="px-5 pb-4">
          <div className="border-t border-white/5 pt-4 space-y-2 max-h-64 overflow-y-auto">
            {suggestion.items.map((item) => {
              const isExcluded = excludedKeys.has(item.ratingKey);
              const isDisabled = !canEditItems;

              return (
                <label
                  key={item.ratingKey}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    isDisabled
                      ? "opacity-60 cursor-default"
                      : isExcluded
                      ? "bg-white/5 text-white/40"
                      : "hover:bg-white/5"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!isExcluded}
                    onChange={() => !isDisabled && toggleItem(item.ratingKey)}
                    disabled={isDisabled}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#E5A00D] focus:ring-[#E5A00D]/50 focus:ring-offset-0"
                  />
                  <Film className="h-4 w-4 text-white/40 flex-shrink-0" />
                  <span className={`text-sm ${isExcluded ? "line-through" : "text-white/80"}`}>
                    {formatItem(item)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type FilterType = "all" | "pending" | "approved" | "rejected" | "applied";

export function SuggestionsList() {
  const { suggestions, isLoading, error, approve, reject, remove, approveAll, rejectAll, restoreAll, deleteAll, markApplied } = useSuggestions();
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [isApplyingAll, setIsApplyingAll] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  const handleApply = async (suggestion: Suggestion, items: SuggestionItem[]) => {
    setApplyingId(suggestion.id);
    try {
      const response = await fetch("/api/plex/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId: suggestion.id,
          collectionName: suggestion.collectionName,
          items: items,
        }),
      });
      const data = await response.json();

      if (data.success) {
        // Optimistically update local state instead of full refresh
        markApplied(suggestion.id);
      } else {
        alert(data.error || "Failed to apply collection");
      }
    } catch {
      alert("Failed to apply collection");
    } finally {
      setApplyingId(null);
    }
  };

  const handleApplyAll = async () => {
    const approvedSuggestions = suggestions.filter((s) => s.status === "approved");
    if (approvedSuggestions.length === 0) return;

    setIsApplyingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (const suggestion of approvedSuggestions) {
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
          successCount++;
          // Optimistically update local state
          markApplied(suggestion.id);
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setIsApplyingAll(false);

    if (failCount > 0) {
      alert(`Applied ${successCount} collections. ${failCount} failed.`);
    }
  };

  const filteredSuggestions = suggestions.filter((s) => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;
  const approvedCount = suggestions.filter((s) => s.status === "approved").length;
  const rejectedCount = suggestions.filter((s) => s.status === "rejected").length;
  const appliedCount = suggestions.filter((s) => s.status === "applied").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E5A00D] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters & Bulk Actions */}
      <div className="flex flex-wrap items-center gap-3">
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
          onClick={() => setFilter("rejected")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "rejected"
              ? "bg-red-500/20 text-red-400"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          Rejected ({rejectedCount})
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

        {/* Bulk action buttons - depends on active filter */}
        <div className="ml-auto flex items-center gap-2">
          {filter === "pending" && pendingCount > 0 && (
            <>
              <button
                onClick={approveAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
              >
                <Check className="h-4 w-4" />
                Approve All
              </button>
              <button
                onClick={rejectAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
              >
                <X className="h-4 w-4" />
                Reject All
              </button>
            </>
          )}
          {filter === "approved" && approvedCount > 0 && (
            <>
              <button
                onClick={handleApplyAll}
                disabled={isApplyingAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E5A00D] text-black text-sm font-medium hover:bg-[#E5A00D]/90 transition-colors disabled:opacity-50"
              >
                {isApplyingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Apply All ({approvedCount})
                  </>
                )}
              </button>
            </>
          )}
          {filter === "rejected" && rejectedCount > 0 && (
            <>
              <button
                onClick={restoreAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white/70 text-sm font-medium hover:bg-white/20 transition-colors"
              >
                <Check className="h-4 w-4" />
                Restore All
              </button>
              <button
                onClick={deleteAll}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
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
          <p className="text-white/50">
            {filter === "all"
              ? "Run an AI analysis from the Create tab to generate collection suggestions."
              : `No ${filter} suggestions.`}
          </p>
        </div>
      )}

      {/* Suggestions list */}
      {filteredSuggestions.length > 0 && (
        <div className="grid gap-4">
          {filteredSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onApprove={() => approve(suggestion.id)}
              onReject={() => reject(suggestion.id)}
              onRemove={() => remove(suggestion.id)}
              onApply={(items) => handleApply(suggestion, items)}
              isApplying={applyingId === suggestion.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
