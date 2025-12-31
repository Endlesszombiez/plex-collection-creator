"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScanProgressCard } from "@/components/scan/scan-progress-card";
import { AIAnalysisCard } from "@/components/ai/ai-analysis-card";
import { CustomPromptCard } from "@/components/ai/custom-prompt-card";
import { SuggestionsList } from "@/components/suggestions/suggestions-list";
import { CollectionsList } from "@/components/collections/collections-list";
import { useSavedLibraries } from "@/hooks/use-saved-libraries";
import { useAIConfig } from "@/hooks/use-ai-config";
import { usePlexAuth } from "@/hooks/use-plex-auth";
import { PlexConnectionCard } from "@/components/plex/plex-connection-card";
import { LibrarySelectionCard } from "@/components/plex/library-selection-card";
import { AIConfigCard } from "@/components/ai/ai-config-card";
import { Plus, ListChecks, FolderOpen, Settings, Lock, Sparkles, Wand2 } from "lucide-react";

type TabType = 'create' | 'suggestions' | 'collections' | 'settings';
type SearchType = 'default' | 'custom';

// Wrapper component that uses useSearchParams (requires Suspense)
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoStart = searchParams.get('autoStart') === 'true';
  const { hasSavedSelection, isLoading: librariesLoading, refresh: refreshLibraries } = useSavedLibraries();
  const { configured: aiConfigured, isLoading: aiLoading, refreshConfig: refreshAIConfig } = useAIConfig();
  const { status: plexStatus, refreshStatus: refreshPlexStatus } = usePlexAuth();
  const [activeTab, setActiveTabState] = useState<TabType>('create');
  const [searchType, setSearchType] = useState<SearchType>('default');

  // Wrapper to scroll to top when changing tabs
  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    window.scrollTo(0, 0);
  };
  const [scanComplete, setScanComplete] = useState(false);
  const [scanResults, setScanResults] = useState<{ movies: number; shows: number; scanId: number } | null>(null);

  const isLoading = librariesLoading || aiLoading;
  const isConfigured = hasSavedSelection && aiConfigured;
  const isPlexConnected = plexStatus?.connected ?? false;

  // Redirect to setup if not configured
  useEffect(() => {
    if (!isLoading && !isConfigured) {
      router.push("/setup");
    }
  }, [isLoading, isConfigured, router]);

  const handleScanComplete = (movies: number, shows: number, scanId: number) => {
    setScanComplete(true);
    setScanResults({ movies, shows, scanId });
  };

  // Clear the URL param after consuming it (prevents re-run on refresh)
  useEffect(() => {
    if (autoStart && typeof window !== 'undefined') {
      // Replace URL without the autoStart param
      const url = new URL(window.location.href);
      url.searchParams.delete('autoStart');
      window.history.replaceState({}, '', url.pathname);
    }
  }, [autoStart]);

  const handleScanReset = () => {
    setScanComplete(false);
    setScanResults(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E5A00D] border-t-transparent" />
      </div>
    );
  }

  if (!isConfigured) {
    return null; // Will redirect
  }


  return (
    <div className="min-h-screen bg-[#1a1a1a] relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-[#E5A00D]/5 blur-[120px]" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-[#E5A00D]/3 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <main className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E5A00D]/10 border border-[#E5A00D]/20 mb-6">
              <svg className="w-4 h-4 text-[#E5A00D]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.643 0H4.68l7.679 12L4.68 24h6.963l7.677-12z" />
              </svg>
              <span className="text-[#E5A00D] text-sm font-medium">Plex Collection Creator</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
              Dashboard
            </h1>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-8">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'create'
                  ? 'bg-[#E5A00D] text-black shadow-lg'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Plus className="h-4 w-4" />
              Create
            </button>
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'suggestions'
                  ? 'bg-[#E5A00D] text-black shadow-lg'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <ListChecks className="h-4 w-4" />
              Suggestions
            </button>
            <button
              onClick={() => setActiveTab('collections')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'collections'
                  ? 'bg-[#E5A00D] text-black shadow-lg'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              Collections
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-[#E5A00D] text-black shadow-lg'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>

          {/* Tab Content - min-height prevents layout shift when switching tabs */}
          <div className="min-h-[600px]">
          {activeTab === 'create' && (
            <div className="space-y-6">
              {/* Header row for consistent layout */}
              <div className="flex items-center justify-between min-h-[40px]">
                <h2 className="text-lg font-medium text-white">Create New Collections</h2>
              </div>
              {/* Step 1: Scan Libraries - Vertical layout like setup */}
              <div className="grid grid-cols-[180px_1fr] gap-6">
                {/* Left: Step indicator with connector */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <div className={`
                      relative flex items-center justify-center w-10 h-10 rounded-full
                      font-semibold text-sm transition-all duration-500 shrink-0
                      ${scanComplete
                        ? "bg-[#E5A00D] text-black"
                        : "bg-[#E5A00D]/20 text-[#E5A00D] ring-2 ring-[#E5A00D]/50"
                      }
                    `}>
                      {scanComplete ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : '1'}
                      {!scanComplete && (
                        <span className="absolute inset-0 rounded-full animate-ping bg-[#E5A00D]/20" />
                      )}
                    </div>
                    <span className={`text-sm font-medium transition-colors duration-300 whitespace-nowrap ${
                      scanComplete ? "text-[#E5A00D]" : "text-white"
                    }`}>
                      Scan Libraries
                    </span>
                  </div>
                  {/* Connector line */}
                  <div className="flex justify-start pl-[19px] flex-1 py-3">
                    <div
                      className="w-0.5 h-full rounded-full transition-colors duration-500"
                      style={{ backgroundColor: scanComplete ? '#E5A00D' : 'rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
                {/* Right: Card */}
                <ScanProgressCard
                  onScanComplete={handleScanComplete}
                  completedScan={scanResults}
                  onReset={handleScanReset}
                  autoStart={autoStart}
                />
              </div>

              {/* Step 2: Create Collections - Vertical layout like setup */}
              <div className={`grid grid-cols-[180px_1fr] gap-6 transition-opacity duration-500 ${scanComplete ? "opacity-100" : "opacity-40"}`}>
                {/* Left: Step indicator (no connector after last step) */}
                <div className="flex items-start">
                  <div className="flex items-center gap-3">
                    <div className={`
                      relative flex items-center justify-center w-10 h-10 rounded-full
                      font-semibold text-sm transition-all duration-500 shrink-0
                      ${scanComplete
                        ? "bg-[#E5A00D]/20 text-[#E5A00D] ring-2 ring-[#E5A00D]/50"
                        : "bg-white/5 text-white/40"
                      }
                    `}>
                      2
                      {scanComplete && (
                        <span className="absolute inset-0 rounded-full animate-ping bg-[#E5A00D]/20" />
                      )}
                    </div>
                    <span className={`text-sm font-medium transition-colors duration-300 whitespace-nowrap ${
                      scanComplete ? "text-white" : "text-white/40"
                    }`}>
                      Create Collections
                    </span>
                  </div>
                </div>
                {/* Right: Card with tabs */}
                {scanComplete && scanResults ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                    {/* Search Type Tabs */}
                    <div className="flex border-b border-white/10">
                      <button
                        onClick={() => setSearchType('default')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                          searchType === 'default'
                            ? 'bg-[#E5A00D]/10 text-[#E5A00D] border-b-2 border-[#E5A00D]'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Sparkles className="h-4 w-4" />
                        Default Search
                      </button>
                      <button
                        onClick={() => setSearchType('custom')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                          searchType === 'custom'
                            ? 'bg-purple-500/10 text-purple-400 border-b-2 border-purple-400'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Wand2 className="h-4 w-4" />
                        Custom Search
                      </button>
                    </div>
                    {/* Tab Content - min-height prevents layout shift when switching */}
                    <div className="p-4 min-h-[320px]">
                      {searchType === 'default' ? (
                        <AIAnalysisCard
                          scanId={scanResults.scanId}
                          movieCount={scanResults.movies}
                          showCount={scanResults.shows}
                          embedded
                          onReviewSuggestions={() => setActiveTab('suggestions')}
                          autoStart={autoStart}
                        />
                      ) : (
                        <CustomPromptCard
                          scanId={scanResults.scanId}
                          movieCount={scanResults.movies}
                          showCount={scanResults.shows}
                          embedded
                          onReviewSuggestions={() => setActiveTab('suggestions')}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center min-h-[320px] flex flex-col items-center justify-center">
                    <Lock className="h-8 w-8 text-white/20 mb-3" />
                    <p className="text-white/40 text-sm">Complete the library scan to create collections</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'suggestions' && (
            <div className="space-y-6">
              {/* Header row for consistent layout */}
              <div className="flex items-center justify-between min-h-[40px]">
                <h2 className="text-lg font-medium text-white">Review Suggestions</h2>
              </div>
              <SuggestionsList />
            </div>
          )}

          {activeTab === 'collections' && (
            <div className="space-y-6">
              {/* Header row for consistent layout */}
              <div className="flex items-center justify-between min-h-[40px]">
                <h2 className="text-lg font-medium text-white">Plex Collections</h2>
              </div>
              <CollectionsList />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Header row for consistent layout */}
              <div className="flex items-center justify-between min-h-[40px]">
                <h2 className="text-lg font-medium text-white">Configuration</h2>
              </div>
              <div className="space-y-4">
                <PlexConnectionCard
                onAuthChange={(connected) => {
                  refreshPlexStatus();
                  if (!connected) {
                    refreshLibraries();
                  }
                }}
              />
              <LibrarySelectionCard
                isPlexConnected={isPlexConnected}
                onComplete={() => refreshLibraries()}
              />
              <AIConfigCard onComplete={() => refreshAIConfig()} />
              </div>
            </div>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Default export with Suspense wrapper for useSearchParams
export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E5A00D] border-t-transparent" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
