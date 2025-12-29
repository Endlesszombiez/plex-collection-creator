import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="flex flex-col items-center justify-center gap-8 text-center px-4">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Plex Collection Creator
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Automatically create intelligent collections for your Plex media
            library using AI.
          </p>
        </div>

        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href="/setup">Get Started</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
