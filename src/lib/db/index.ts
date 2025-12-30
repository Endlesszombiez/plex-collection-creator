import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";

// Database path - configurable via environment variable
const DATABASE_PATH = process.env.DATABASE_URL || "./data/plex-collections.db";

// Singleton pattern to avoid multiple connections during build
let sqlite: Database.Database | null = null;
let drizzleDb: BetterSQLite3Database<typeof schema> | null = null;
let migrationRun = false;

/**
 * Get the database instance (lazy initialization).
 * This prevents database locking issues during Next.js build.
 */
function getDb(): BetterSQLite3Database<typeof schema> {
  if (drizzleDb) {
    return drizzleDb;
  }

  // Ensure the data directory exists
  const dbDir = dirname(DATABASE_PATH);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Initialize SQLite database
  sqlite = new Database(DATABASE_PATH);

  // Enable WAL mode for better concurrent access
  sqlite.pragma("journal_mode = WAL");

  // Set busy timeout to handle concurrent access
  sqlite.pragma("busy_timeout = 5000");

  // Create Drizzle ORM instance with schema
  drizzleDb = drizzle(sqlite, { schema });

  // Run migrations on first connection (if not already run)
  if (!migrationRun) {
    try {
      // Try multiple possible migration paths (dev vs Docker)
      const possiblePaths = [
        join(process.cwd(), "drizzle"),
        "./drizzle",
        "/app/drizzle",
      ];

      for (const migrationsPath of possiblePaths) {
        if (existsSync(migrationsPath)) {
          migrate(drizzleDb, { migrationsFolder: migrationsPath });
          console.log(`Database migrations applied from ${migrationsPath}`);
          break;
        }
      }
      migrationRun = true;
    } catch (error) {
      console.error("Migration error:", error);
      // Continue anyway - tables might already exist
      migrationRun = true;
    }
  }

  return drizzleDb;
}

// Export a proxy that lazily initializes the database
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_, prop) {
    const database = getDb();
    const value = database[prop as keyof typeof database];
    if (typeof value === "function") {
      return value.bind(database);
    }
    return value;
  },
});

// Export schema for use in queries
export * from "./schema";
