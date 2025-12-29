"use client";

import { usePlexAuth } from "@/hooks/use-plex-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

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

export function PlexConnectionCard() {
  const {
    status,
    isLoading,
    isAuthenticating,
    error,
    startAuth,
    disconnect,
  } = usePlexAuth();

  if (isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner />
          <span className="ml-2 text-muted-foreground">Loading...</span>
        </CardContent>
      </Card>
    );
  }

  const isConnected = status?.connected ?? false;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#E5A00D]/10">
              <PlexIcon className="h-6 w-6 text-[#E5A00D]" />
            </div>
            <div>
              <CardTitle>Plex</CardTitle>
              <CardDescription>
                Connect your Plex account to get started
              </CardDescription>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Connected" : "Not Connected"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isAuthenticating && (
          <Alert>
            <AlertDescription className="flex items-center gap-2">
              <LoadingSpinner />
              Waiting for Plex authentication... Please complete the login in
              the popup window.
            </AlertDescription>
          </Alert>
        )}

        {isConnected && status?.serverUrl && (
          <div className="text-sm text-muted-foreground">
            <p>
              Server URL:{" "}
              <span className="font-mono text-foreground">
                {status.serverUrl}
              </span>
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-end gap-2">
        {isConnected ? (
          <Button
            variant="destructive"
            onClick={disconnect}
            disabled={isLoading}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            onClick={startAuth}
            disabled={isAuthenticating}
            className="bg-[#E5A00D] hover:bg-[#E5A00D]/90 text-black"
          >
            {isAuthenticating ? (
              <>
                <LoadingSpinner />
                Authenticating...
              </>
            ) : (
              <>
                <PlexIcon className="h-4 w-4" />
                Connect Plex
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
