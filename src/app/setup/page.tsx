"use client";

import { PlexConnectionCard } from "@/components/plex/plex-connection-card";
import { usePlexAuth } from "@/hooks/use-plex-auth";

function StepIndicator({
  step,
  title,
  isActive,
  isComplete
}: {
  step: number;
  title: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`
          relative flex items-center justify-center w-10 h-10 rounded-full
          font-semibold text-sm transition-all duration-500
          ${isComplete
            ? "bg-[#E5A00D] text-black"
            : isActive
              ? "bg-[#E5A00D]/20 text-[#E5A00D] ring-2 ring-[#E5A00D]/50"
              : "bg-white/5 text-white/40"
          }
        `}
      >
        {isComplete ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          step
        )}
        {isActive && !isComplete && (
          <span className="absolute inset-0 rounded-full animate-ping bg-[#E5A00D]/20" />
        )}
      </div>
      <span className={`
        text-sm font-medium transition-colors duration-300
        ${isComplete ? "text-[#E5A00D]" : isActive ? "text-white" : "text-white/40"}
      `}>
        {title}
      </span>
    </div>
  );
}

function StepConnector({ isComplete }: { isComplete: boolean }) {
  return (
    <div className="w-10 flex justify-center py-1">
      <div
        className={`
          w-0.5 h-8 rounded-full transition-colors duration-500
          ${isComplete ? "bg-[#E5A00D]" : "bg-white/10"}
        `}
      />
    </div>
  );
}

export default function SetupPage() {
  const { status, isLoading } = usePlexAuth();
  const isPlexConnected = status?.connected ?? false;

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
          <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E5A00D]/10 border border-[#E5A00D]/20 mb-6">
              <svg className="w-4 h-4 text-[#E5A00D]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.643 0H4.68l7.679 12L4.68 24h6.963l7.677-12z" />
              </svg>
              <span className="text-[#E5A00D] text-sm font-medium">Plex Collection Creator</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Set up your workspace
            </h1>
            <p className="text-lg text-white/60 max-w-md mx-auto">
              Connect your accounts to start creating intelligent collections with AI
            </p>
          </div>

          {/* Main content grid */}
          <div className="grid md:grid-cols-[200px_1fr] gap-12 md:gap-16">
            {/* Progress sidebar */}
            <div className="hidden md:block animate-in fade-in slide-in-from-left-4 duration-700 delay-150">
              <div className="sticky top-8">
                <StepIndicator
                  step={1}
                  title="Connect Plex"
                  isActive={!isPlexConnected}
                  isComplete={isPlexConnected}
                />
                <StepConnector isComplete={isPlexConnected} />
                <StepIndicator
                  step={2}
                  title="Configure AI"
                  isActive={isPlexConnected}
                  isComplete={false}
                />
                <StepConnector isComplete={false} />
                <StepIndicator
                  step={3}
                  title="Select Libraries"
                  isActive={false}
                  isComplete={false}
                />
              </div>
            </div>

            {/* Steps content */}
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              {/* Step 1: Plex Connection */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-[#E5A00D]/20 text-[#E5A00D] text-sm font-semibold">
                    {isPlexConnected ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : "1"}
                  </div>
                  <h2 className="text-xl font-semibold text-white">Connect your Plex account</h2>
                </div>
                <p className="text-white/50 mb-6 text-sm md:pl-11">
                  Sign in with Plex to allow access to your media libraries
                </p>
                <div className="md:pl-11">
                  <PlexConnectionCard />
                </div>
              </section>

              {/* Step 2: AI Configuration (Coming Soon) */}
              <section className={`transition-opacity duration-500 ${isPlexConnected ? "opacity-100" : "opacity-40"}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-white/40 text-sm font-semibold">
                    2
                  </div>
                  <h2 className="text-xl font-semibold text-white">Configure AI provider</h2>
                </div>
                <p className="text-white/50 mb-6 text-sm md:pl-11">
                  Choose your AI provider and add your API credentials
                </p>
                <div className="md:pl-11">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                      </svg>
                    </div>
                    <p className="text-white/40 text-sm">
                      {isPlexConnected
                        ? "AI configuration coming in the next update"
                        : "Complete step 1 to continue"}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
