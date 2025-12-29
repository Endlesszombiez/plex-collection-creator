"use client";

import { useState, useEffect } from "react";
import { FolderOpen, ExternalLink, Clock } from "lucide-react";

interface AppliedCollection {
  id: number;
  suggestionId: number;
  plexCollectionKey: string;
  collectionName: string;
  itemCount: number;
  appliedAt: string;
}

interface CollectionsData {
  appliedCollections: AppliedCollection[];
  plexCollections: { ratingKey: string; title: string; childCount?: number }[];
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString();
}

export function CollectionsSummaryCard() {
  const [data, setData] = useState<CollectionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCollections() {
      try {
        const response = await fetch("/api/plex/collections");
        const result = await response.json();
        if (result.success) {
          setData(result);
        }
      } catch (error) {
        console.error("Error fetching collections:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCollections();
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3" />
          <div className="h-4 bg-white/10 rounded w-1/2" />
          <div className="space-y-2">
            <div className="h-4 bg-white/10 rounded w-full" />
            <div className="h-4 bg-white/10 rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  // No collections created yet
  if (!data || data.appliedCollections.length === 0) {
    return null; // Don't show the card if no collections have been created
  }

  const { appliedCollections } = data;
  const totalCollections = appliedCollections.length;
  const totalItems = appliedCollections.reduce((sum, c) => sum + c.itemCount, 0);

  // Get most recent collections (last 5)
  const recentCollections = [...appliedCollections]
    .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    .slice(0, 5);

  const mostRecent = recentCollections[0];
  const mostRecentDate = mostRecent ? new Date(mostRecent.appliedAt) : null;

  return (
    <div className="rounded-xl border border-[#E5A00D]/20 bg-[#E5A00D]/5 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-[#E5A00D]/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#E5A00D]/20 flex items-center justify-center">
            <FolderOpen className="h-5 w-5 text-[#E5A00D]" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Collections Created</h3>
            <p className="text-sm text-white/50">
              {totalCollections} collection{totalCollections === 1 ? "" : "s"} with {totalItems} items
            </p>
          </div>
        </div>
      </div>

      {/* Recent collections */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-white/40" />
          <span className="text-sm text-white/50">
            {mostRecentDate ? `Last created ${formatTimeAgo(mostRecentDate)}` : "Recent"}
          </span>
        </div>

        <div className="space-y-2">
          {recentCollections.map((collection) => (
            <div
              key={collection.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen className="h-4 w-4 text-[#E5A00D] flex-shrink-0" />
                <span className="text-sm text-white/80 truncate">
                  {collection.collectionName}
                </span>
              </div>
              <span className="text-xs text-white/40 flex-shrink-0 ml-2">
                {collection.itemCount} items
              </span>
            </div>
          ))}
        </div>

        {totalCollections > 5 && (
          <p className="text-xs text-white/40 mt-3 text-center">
            +{totalCollections - 5} more collection{totalCollections - 5 === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {/* View in Plex link */}
      <div className="px-5 pb-5">
        <a
          href="#"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10 hover:text-white/80 transition-colors"
          onClick={(e) => {
            e.preventDefault();
            // Could open Plex web app in new tab if we knew the URL
            alert("Open your Plex app to view collections");
          }}
        >
          <ExternalLink className="h-4 w-4" />
          View in Plex
        </a>
      </div>
    </div>
  );
}
