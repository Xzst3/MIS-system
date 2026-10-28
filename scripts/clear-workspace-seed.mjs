import { neon } from "@neondatabase/serverless";
import { seedRecords } from "./workspace-seed-data.mjs";
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first.");
const sql = neon(process.env.DATABASE_URL);
const ids = seedRecords.map((record) => record.id);
const matching = await sql.query(
  "SELECT kind,count(*)::int AS count FROM records WHERE id=ANY($1::uuid[]) GROUP BY kind ORDER BY kind",
  [ids],
);
console.table(matching);
if (!process.argv.includes("--apply")) {
  console.log(
    "Dry run only. To remove this exact batch, run npm run workspace:clear -- --apply. Accounts, other records and public submissions are retained.",
  );
} else {
  const removed = await sql.query(
    "DELETE FROM records WHERE id=ANY($1::uuid[]) RETURNING id",
    [ids],
  );
  console.log(
    "Removed " +
      removed.length +
      " records from the fixed workspace batch. No other records or accounts were removed.",
  );
}
