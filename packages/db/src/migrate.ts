import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase, type Database } from "./index.js";
import { readDatabaseUrl } from "./config.js";

const migrationsFolder = fileURLToPath(new URL("../drizzle/", import.meta.url));

/** Applies every committed migration to a node-postgres database. */
export async function runMigrations(database: Pick<Database, "db">) {
  await migrate(database.db, { migrationsFolder });
}

async function main() {
  const database = createDatabase(readDatabaseUrl());
  try {
    await runMigrations(database);
    console.log("Database migrations applied successfully.");
  } finally {
    await database.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(() => {
    console.error("Database migration failed. Check DATABASE_URL, connectivity and migration files.");
    process.exitCode = 1;
  });
}
