"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanProgressCard } from "@/components/scan/scan-progress-card";
import { AIAnalysisCard } from "@/components/ai/ai-analysis-card";
import { CustomPromptCard } from "@/components/ai/custom-prompt-card";
import { CollectionsSummaryCard } from "@/components/dashboard/collections-summary-card";
import { useSavedLibraries } from "@/hooks/use-saved-libraries";
import { useAIConfig } from "@/hooks/use-ai-config";
import { Settings, Sparkles, Library } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const { hasSavedSelection, serverName, libraries, isLoading: librariesLoading } = useSavedLibraries();
  const { configured: aiConfigured, provider, isLoading: aiLoading } = useAIConfig();
  const [scanComplete, setScanComplete] = useState(false);
  const [scanResults, setScanResults] = useState<{ movies: number; shows: number; scanId: number } | null>(null);

  const isLoading = librariesLoading || aiLoading;
  const isConfigured = hasSavedSelection && aiConfigured;

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

  const movieLibraries = libraries.filter((l) => l.type === "movie");
  const showLibraries = libraries.filter((l) => l.type === "show");

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
          <div className="flex items-start justify-between mb-12">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E5A00D]/10 border border-[#E5A00D]/20 mb-6">
                <svg className="w-4 h-4 text-[#E5A00D]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.643 0H4.68l7.679 12L4.68 24h6.963l7.677-12z" />
                </svg>
                <span className="text-[#E5A00D] text-sm font-medium">Plex Collection Creator</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
                Dashboard
              </h1>
              <p className="text-white/60">
                Scan your libraries and let AI suggest collections
              </p>
            </div>
            <Link
              href="/setup"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white/70 text-sm font-medium hover:bg-white/10 hover:text-white transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>

          {/* Configuration summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Libraries */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10">
                  <Library className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Libraries</h3>
                  <p className="text-sm text-white/50">{serverName}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {movieLibraries.map((lib) => (
                  <span
                    key={lib.key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 text-xs text-white/70"
                  >
                    <span className="text-[#E5A00D]">Movies</span>
                    {lib.title}
                  </span>
                ))}
                {showLibraries.map((lib) => (
                  <span
                    key={lib.key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 text-xs text-white/70"
                  >
                    <span className="text-[#E5A00D]">TV</span>
                    {lib.title}
                  </span>
                ))}
              </div>
            </div>

            {/* AI Provider */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10">
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">AI Provider</h3>
                  <p className="text-sm text-white/50 capitalize">{provider}</p>
                </div>
              </div>
              <p className="text-xs text-white/40">
                AI will analyze your library metadata to suggest intelligent collections
              </p>
            </div>
          </div>

          {/* Collections Summary - shows if any collections have been created */}
          <div className="mb-8">
            <CollectionsSummaryCard />
          </div>

          {/* Workflow Steps */}
          <div className="space-y-6">
            {/* Step 1: Scan */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-xs font-bold text-white/60">1</span>
                Library Scan
              </h2>
              <ScanProgressCard onScanComplete={handleScanComplete} />
            </div>

            {/* Step 2: AI Analysis - shown after scan complete */}
            {scanComplete && scanResults && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#E5A00D]/20 text-xs font-bold text-[#E5A00D]">2</span>
                  AI Analysis
                </h2>
                <AIAnalysisCard
                  scanId={scanResults.scanId}
                  movieCount={scanResults.movies}
                  showCount={scanResults.shows}
                />
              </div>
            )}

            {/* Step 3: Custom Prompt - shown after scan complete */}
            {scanComplete && scanResults && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-xs font-bold text-purple-400">3</span>
                  Custom Search
                  <span className="text-xs font-normal text-white/40 ml-2">(Optional)</span>
                </h2>
                <CustomPromptCard
                  scanId={scanResults.scanId}
                  movieCount={scanResults.movies}
                  showCount={scanResults.shows}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
