import "server-only";
import { neon, types } from "@neondatabase/serverless";
// Calendar dates have no timezone. Keep DATE values as YYYY-MM-DD strings.
types.setTypeParser(1082, (value: string) => value);
export function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  return neon(process.env.DATABASE_URL);
}
export const databaseReady = () => !!process.env.DATABASE_URL;
