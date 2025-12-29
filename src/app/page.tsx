import Link from "next/link";

function PlexIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M11.643 0H4.68l7.679 12L4.68 24h6.963l7.677-12z" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] relative overflow-hidden flex items-center justify-center">
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full bg-[#E5A00D]/5 blur-[150px]" />
        <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-[#E5A00D]/3 blur-[100px]" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-[#E5A00D]/4 blur-[80px]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center gap-10 text-center px-4 py-16">
        {/* Logo/Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-[#E5A00D]/20 blur-2xl rounded-full scale-150" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#E5A00D] to-[#cc8800] flex items-center justify-center shadow-2xl shadow-[#E5A00D]/30">
            <PlexIcon className="w-10 h-10 text-black" />
          </div>
        </div>

        {/* Text content */}
        <div className="space-y-4 max-w-lg">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
            Collection Creator
          </h1>
          <p className="text-lg md:text-xl text-white/50 leading-relaxed">
            Intelligently organize your Plex media library with AI-powered collection suggestions
          </p>
        </div>

        {/* Features */}
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          {["AI-Powered", "Franchise Detection", "Custom Prompts", "One-Click Apply"].map((feature) => (
            <span
              key={feature}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60"
            >
              {feature}
            </span>
          ))}
        </div>

        {/* CTA Button */}
        <Link
          href="/setup"
          className="
            inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold
            bg-[#E5A00D] hover:bg-[#E5A00D]/90 active:bg-[#E5A00D]/80
            text-black
            transition-all duration-200
            shadow-xl shadow-[#E5A00D]/25
            hover:shadow-2xl hover:shadow-[#E5A00D]/30
            hover:-translate-y-0.5
          "
        >
          Get Started
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>

        {/* Footer note */}
        <p className="text-sm text-white/30">
          Connect your Plex account to get started
        </p>
      </main>
    </div>
  );
}
