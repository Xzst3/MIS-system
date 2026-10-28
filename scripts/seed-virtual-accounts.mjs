import { neon } from "@neondatabase/serverless";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL first.");
const sql = neon(process.env.DATABASE_URL);
mkdirSync(".local", { recursive: true });
const seedPath = ".local/virtual-account-seed.json";
let accounts;
if (existsSync(seedPath)) {
  accounts = JSON.parse(readFileSync(seedPath, "utf8"));
} else {
  const definitions = [
    ["admin", "Foundation Administrator", "admin"],
    ["coordinator", "Case Coordinator", "coordinator"],
    ["fundraising", "Fundraising Officer", "fundraising"],
    ["volunteer", "Community Volunteer", "volunteer"],
  ];
  const existing = await sql.query(
    "SELECT username FROM users WHERE username=ANY($1)",
    [definitions.map((r) => r[0])],
  );
  if (existing.length)
    throw new Error(
      "One of the reserved virtual usernames already exists. No account was modified.",
    );
  accounts = definitions.map(([username, name, role]) => ({
    username,
    name,
    role,
    password: "ECF-" + randomBytes(12).toString("base64url"),
  }));
  writeFileSync(seedPath, JSON.stringify(accounts, null, 2));
}
writeFileSync(
  ".local/TEST_ACCOUNTS.md",
  "# Private virtual test accounts\n\nLogin: https://mis-ecru-sigma.vercel.app/login\n\nThese are fictional software demonstration identities. They are not tied to any real person or email address. Do not commit or publicly share these passwords.\n\n| Username | Password | Role |\n| --- | --- | --- |\n" +
    accounts
      .map(
        (r) => "| " + r.username + " | " + r.password + " | " + r.role + " |",
      )
      .join("\n") +
    "\n",
);
const results = await sql.transaction(
  accounts.map((account) => {
    const salt = randomBytes(16).toString("hex");
    const hash =
      salt + ":" + scryptSync(account.password, salt, 64).toString("hex");
    return sql.query(
      "INSERT INTO users(name,username,role,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(username) DO NOTHING RETURNING id",
      [account.name, account.username, account.role, hash],
    );
  }),
);
console.log(
  "Created " +
    results.reduce((n, r) => n + r.length, 0) +
    " virtual accounts. Private credentials: .local/TEST_ACCOUNTS.md. Existing accounts were not changed.",
);
