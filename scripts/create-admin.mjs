import { neon } from "@neondatabase/serverless";
import { randomBytes, createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split("=")));
if (!process.env.DATABASE_URL || !args.username || !args.origin)
  throw new Error(
    "Set DATABASE_URL and pass --username=admin --origin=https://your-domain",
  );
const sql = neon(process.env.DATABASE_URL);
const token = randomBytes(32).toString("hex");
const hash = createHash("sha256").update(token).digest("hex");
const rows =
  await sql`INSERT INTO users(name,username,role) VALUES(${args.name || "Foundation Administrator"},${args.username.toLowerCase()},'admin') ON CONFLICT(username) DO NOTHING RETURNING id`;
if (!rows[0])
  throw new Error(
    "Account already exists. Use administrator account management instead.",
  );
await sql`INSERT INTO invitations(token_hash,user_id,expires_at) VALUES(${hash},${rows[0].id},NOW()+INTERVAL '24 hours')`;
mkdirSync(".local", { recursive: true });
writeFileSync(
  ".local/admin-invitation.txt",
  `Private administrator invitation (expires in 24 hours). Open this URL and choose your own password:\n${args.origin}/activate#token=${token}\nDo not commit or share this invitation.\n`,
);
console.log(
  "Private invitation saved to .local/admin-invitation.txt. No password was generated.",
);
