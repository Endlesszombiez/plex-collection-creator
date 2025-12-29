import { PlexOauth, IPlexClientDetails } from "plex-oauth";
import { db, settings } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { eq } from "drizzle-orm";

// Client identifier should be unique per installation
// In production, this could be generated and stored on first run
const CLIENT_IDENTIFIER =
  process.env.PLEX_CLIENT_ID || "plex-collection-creator";

const getClientDetails = (forwardUrl?: string): IPlexClientDetails => ({
  clientIdentifier: CLIENT_IDENTIFIER,
  product: "Plex Collection Creator",
  device: "Web Browser",
  version: "1.0.0",
  platform: "Web",
  forwardUrl,
  urlencode: true,
});

// Store active PIN sessions (in production, consider Redis or database)
const activePins = new Map<number, { createdAt: Date }>();

/**
 * Start the OAuth flow by generating a PIN and login URL.
 */
export async function startPlexAuth(callbackUrl: string): Promise<{
  loginUrl: string;
  pinId: number;
}> {
  const clientDetails = getClientDetails(callbackUrl);
  const plexOauth = new PlexOauth(clientDetails);

  const [loginUrl, pinId] = await plexOauth.requestHostedLoginURL();

  // Store the PIN session
  activePins.set(pinId, { createdAt: new Date() });

  // Clean up old PINs (older than 10 minutes)
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [id, session] of activePins.entries()) {
    if (session.createdAt.getTime() < tenMinutesAgo) {
      activePins.delete(id);
    }
  }

  return { loginUrl, pinId };
}

/**
 * Check if the user has completed authentication and retrieve the token.
 */
export async function checkPlexAuth(pinId: number): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  // Verify this is a valid PIN session
  if (!activePins.has(pinId)) {
    return { success: false, error: "Invalid or expired PIN session" };
  }

  const clientDetails = getClientDetails();
  const plexOauth = new PlexOauth(clientDetails);

  try {
    // Check for auth token (single check, not polling)
    const token = await plexOauth.checkForAuthToken(pinId, 1000, 1);

    if (token) {
      // Clean up the PIN session
      activePins.delete(pinId);

      // Save the token to database
      await savePlexToken(token);

      return { success: true, token };
    }

    return { success: false, error: "Authentication not yet complete" };
  } catch (error) {
    console.error("Error checking Plex auth:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Save the Plex token to the database (encrypted).
 */
export async function savePlexToken(token: string): Promise<void> {
  const encryptedToken = encrypt(token);

  // Check if settings row exists
  const existing = await db.select().from(settings).limit(1);

  if (existing.length > 0) {
    // Update existing settings
    await db
      .update(settings)
      .set({
        plexToken: encryptedToken,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, existing[0].id));
  } else {
    // Create new settings row
    await db.insert(settings).values({
      plexToken: encryptedToken,
    });
  }
}

/**
 * Get the stored Plex token from the database.
 */
export async function getPlexToken(): Promise<string | null> {
  const result = await db.select().from(settings).limit(1);

  if (result.length === 0 || !result[0].plexToken) {
    return null;
  }

  try {
    return decrypt(result[0].plexToken);
  } catch (error) {
    console.error("Error decrypting Plex token:", error);
    return null;
  }
}

/**
 * Check if Plex is connected (has a valid token).
 */
export async function isPlexConnected(): Promise<boolean> {
  const token = await getPlexToken();
  return token !== null;
}

/**
 * Disconnect Plex by removing the stored token.
 */
export async function disconnectPlex(): Promise<void> {
  const existing = await db.select().from(settings).limit(1);

  if (existing.length > 0) {
    await db
      .update(settings)
      .set({
        plexToken: null,
        plexServerUrl: null,
        plexServerId: null,
        selectedLibraries: null,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, existing[0].id));
  }
}

/**
 * Get Plex connection status and basic info.
 */
export async function getPlexStatus(): Promise<{
  connected: boolean;
  serverUrl?: string;
  serverId?: string;
}> {
  const result = await db.select().from(settings).limit(1);

  if (result.length === 0 || !result[0].plexToken) {
    return { connected: false };
  }

  return {
    connected: true,
    serverUrl: result[0].plexServerUrl || undefined,
    serverId: result[0].plexServerId || undefined,
  };
}
