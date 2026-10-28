import { neon } from "@neondatabase/serverless";
import { mkdirSync, writeFileSync } from "node:fs";
import { batch, seedRecords } from "./workspace-seed-data.mjs";
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first.");
const sql = neon(process.env.DATABASE_URL);
const users = await sql.query(
  "SELECT id,username,role FROM users WHERE username=ANY($1) AND active=true",
  [["admin", "coordinator", "fundraising", "volunteer"]],
);
const accounts = new Map(users.map((user) => [user.username, user]));
for (const role of ["admin", "coordinator", "fundraising", "volunteer"]) {
  if (accounts.get(role)?.role !== role)
    throw new Error(
      "Expected an active " + role + " account. No records were inserted.",
    );
}
mkdirSync(".local", { recursive: true });
writeFileSync(
  ".local/workspace-seed-manifest.json",
  JSON.stringify(
    {
      batch,
      records: seedRecords.map(({ id, kind, name }) => ({ id, kind, name })),
    },
    null,
    2,
  ) + String.fromCharCode(10),
);
const inserted = await sql.transaction(
  seedRecords.map((record) =>
    sql.query(
      "INSERT INTO records(id,kind,name,email,category,status,detail,amount,assigned_to,created_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) ON CONFLICT(id) DO NOTHING RETURNING id",
      [
        record.id,
        record.kind,
        record.name,
        record.email,
        record.category,
        record.status,
        record.detail,
        record.amount,
        accounts.get(record.assignee).id,
        accounts.get("admin").id,
        record.created_at,
      ],
    ),
  ),
);
console.log(
  "Inserted " +
    inserted.reduce((total, rows) => total + rows.length, 0) +
    " workspace records. Existing records were not modified.",
);
const summary = await sql.query(
  "SELECT kind,count(*)::int AS count FROM records WHERE id=ANY($1::uuid[]) GROUP BY kind ORDER BY kind",
  [seedRecords.map((record) => record.id)],
);
console.table(summary);
const assignments = await sql.query(
  "SELECT u.username,r.status,count(*)::int AS count FROM records r JOIN users u ON u.id=r.assigned_to WHERE r.kind='tasks' AND r.id=ANY($1::uuid[]) GROUP BY u.username,r.status ORDER BY u.username,r.status",
  [seedRecords.map((record) => record.id)],
);
console.table(assignments);
