import { PlexConnectionCard } from "@/components/plex/plex-connection-card";

export default function SetupPage() {
  return (
    <main className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Setup</h1>
          <p className="text-muted-foreground mt-2">
            Connect your Plex account and configure AI to get started.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Step 1: Connect Plex</h2>
          <PlexConnectionCard />
        </section>

        {/* AI Configuration will be added in F007 */}
        <section className="space-y-4 opacity-50">
          <h2 className="text-xl font-semibold">Step 2: Configure AI</h2>
          <p className="text-sm text-muted-foreground">
            Configure your AI provider to enable collection suggestions.
            (Coming soon)
          </p>
        </section>
      </div>
    </main>
  );
}
