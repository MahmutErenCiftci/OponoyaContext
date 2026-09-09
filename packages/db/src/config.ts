import { z } from "zod";

export const databaseUrlSchema = z.url().refine((value) => {
  const url = URL.parse(value);
  return url !== null && ["postgresql:", "postgres:"].includes(url.protocol) &&
    Boolean(url.hostname) && url.pathname.length > 1;
}, "Expected a PostgreSQL connection URL with a database name");

export function readDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const result = databaseUrlSchema.safeParse(env.DATABASE_URL);
  if (!result.success) throw new Error("Invalid environment variable: DATABASE_URL");
  return result.data;
}
