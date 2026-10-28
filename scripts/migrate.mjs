import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
if (!process.env.DATABASE_URL) {
  console.log("No DATABASE_URL: database migration deferred.");
  process.exit(0);
}
const sql = neon(process.env.DATABASE_URL);
const statements = readFileSync(
  new URL("../db/schema.sql", import.meta.url),
  "utf8",
)
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);
await sql.transaction(statements.map((s) => sql.query(s)));
await sql`DELETE FROM rate_limits WHERE expires_at<NOW()`;
await sql`DELETE FROM sessions WHERE expires_at<NOW()`;
await sql`DELETE FROM invitations WHERE expires_at<NOW()`;
console.log("Database schema is ready. No demo records were inserted.");
