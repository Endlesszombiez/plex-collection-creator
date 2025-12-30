"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  FolderOpen,
  Film,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
} from "lucide-react";

interface AppliedCollection {
  id: number;
  suggestionId: number;
  plexCollectionKey: string;
  collectionName: string;
  itemCount: number;
  appliedAt: string;
}

interface PlexCollection {
  ratingKey: string;
  title: string;
  childCount?: number;
}

interface PlexItem {
  ratingKey: string;
  title: string;
  year?: number;
  type: string;
}

interface CollectionsData {
  appliedCollections: AppliedCollection[];
  plexCollections: PlexCollection[];
}

function CollectionCard({
  collection,
  isAppCreated,
  appliedInfo,
  onDelete,
  onRefresh,
}: {
  collection: PlexCollection;
  isAppCreated: boolean;
  appliedInfo?: AppliedCollection;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [items, setItems] = useState<PlexItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [removingItemKey, setRemovingItemKey] = useState<string | null>(null);

  const fetchItems = async () => {
    if (items.length > 0) return; // Already fetched
    setIsLoadingItems(true);
    try {
      const response = await fetch(`/api/plex/collections?collectionKey=${collection.ratingKey}`);
      const result = await response.json();
      if (result.success) {
        setItems(result.items);
      }
    } catch (error) {
      console.error("Failed to fetch items:", error);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleExpand = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (newExpanded) {
      fetchItems();
    }
  };

  const handleDeleteCollection = async () => {
    if (!confirm(`Delete "${collection.title}"? This will remove the collection from Plex.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/plex/collections?collectionKey=${collection.ratingKey}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.success) {
        onDelete();
        onRefresh();
      } else {
        alert(result.error || "Failed to delete collection");
      }
    } catch {
      alert("Failed to delete collection");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRemoveItem = async (itemKey: string, itemTitle: string) => {
    if (!confirm(`Remove "${itemTitle}" from this collection?`)) {
      return;
    }
    setRemovingItemKey(itemKey);
    try {
      const response = await fetch(
        `/api/plex/collections?collectionKey=${collection.ratingKey}&itemKey=${itemKey}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (result.success) {
        // Remove from local state
        setItems((prev) => prev.filter((item) => item.ratingKey !== itemKey));
        // Refresh to update counts
        onRefresh();
      } else {
        alert(result.error || "Failed to remove item");
      }
    } catch {
      alert("Failed to remove item");
    } finally {
      setRemovingItemKey(null);
    }
  };

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors ${
        isAppCreated
          ? "border-[#E5A00D]/30 bg-[#E5A00D]/5"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      {/* Header - clickable to expand */}
      <button
        onClick={handleExpand}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${
              isAppCreated ? "bg-[#E5A00D]/20" : "bg-white/5"
            }`}>
              <FolderOpen className={`h-5 w-5 ${isAppCreated ? "text-[#E5A00D]" : "text-white/40"}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white truncate">{collection.title}</h3>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-white/40 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-white/40 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="inline-flex items-center gap-1.5 text-sm text-white/50">
                  <Film className="h-3.5 w-3.5" />
                  {collection.childCount ?? items.length ?? "?"} items
                </span>
                {appliedInfo && (
                  <span className="text-xs text-white/30">
                    Added {new Date(appliedInfo.appliedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAppCreated && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[#E5A00D]/20 text-[#E5A00D]">
                <Sparkles className="h-3 w-3" />
                Created by app
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="border-t border-white/5 pt-4">
            {/* Items list */}
            {isLoadingItems ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 text-white/40 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-4">No items in collection</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div
                    key={item.ratingKey}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-white/5 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Film className="h-4 w-4 text-white/40 shrink-0" />
                      <span className="text-sm text-white/80 truncate">
                        {item.title}
                        {item.year && <span className="text-white/40"> ({item.year})</span>}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveItem(item.ratingKey, item.title);
                      }}
                      disabled={removingItemKey === item.ratingKey}
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      title="Remove from collection"
                    >
                      {removingItemKey === item.ratingKey ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Delete collection button */}
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCollection();
                }}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete Collection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CollectionsList() {
  const [data, setData] = useState<CollectionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/plex/collections");
      const result = await response.json();

      if (result.success) {
        setData({
          appliedCollections: result.appliedCollections,
          plexCollections: result.plexCollections,
        });
      } else {
        setError(result.error || "Failed to fetch collections");
      }
    } catch {
      setError("Failed to fetch collections");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  // Build a set of collection names created by this app (case-insensitive)
  const appCreatedNames = new Set(
    data?.appliedCollections.map((c) => c.collectionName.toLowerCase().trim()) || []
  );

  // Map plexCollectionKey to appliedCollection for extra info
  const appliedByKey = new Map(
    data?.appliedCollections.map((c) => [c.plexCollectionKey, c]) || []
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E5A00D] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchCollections}
          className="mt-3 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }

  const collections = data?.plexCollections || [];

  if (collections.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
          <FolderOpen className="h-8 w-8 text-white/30" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No collections yet</h3>
        <p className="text-white/50">
          Create collections by generating and applying AI suggestions from the Create tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">
          {collections.length} collection{collections.length !== 1 ? "s" : ""} in Plex
        </p>
        <button
          onClick={fetchCollections}
          disabled={isLoading}
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Collections list */}
      <div className="grid gap-3">
        {collections.map((collection) => {
          const isAppCreated = appCreatedNames.has(collection.title.toLowerCase().trim());
          const appliedInfo = appliedByKey.get(collection.ratingKey);

          return (
            <CollectionCard
              key={collection.ratingKey}
              collection={collection}
              isAppCreated={isAppCreated}
              appliedInfo={appliedInfo}
              onDelete={() => {
                // Remove from local state immediately for responsiveness
                setData((prev) => prev ? {
                  ...prev,
                  plexCollections: prev.plexCollections.filter((c) => c.ratingKey !== collection.ratingKey),
                } : null);
              }}
              onRefresh={fetchCollections}
            />
          );
        })}
      </div>
    </div>
  );
}
