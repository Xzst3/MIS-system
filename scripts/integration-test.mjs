import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";
import { randomBytes, createHash, scryptSync } from "node:crypto";
const origin = process.env.ECF_TEST_ORIGIN || "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Integration tests must target a local test server.");
const sql = neon(process.env.DATABASE_URL);
const suffix = randomBytes(8).toString("hex");
const username = (role) => "t-" + suffix.slice(0, 8) + "-" + role;
const email = (role) => `ecf-test-${suffix}-${role}@example.test`;
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
const passwordHash =
  salt + ":" + scryptSync(password, salt, 64).toString("hex");
const users = {};
const cookies = {};
const checks = [];
const hash = (s) => createHash("sha256").update(s).digest("hex");
async function request(path, body, cookie, customOrigin = origin) {
  const options = {
    method: body ? "POST" : "GET",
    headers: {
      ...(body
        ? { "Content-Type": "application/json", Origin: customOrigin }
        : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      "X-Forwarded-For": "test-" + suffix,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(origin + path, options);
    if (response.status < 500 || attempt === 2) return response;
    await response.text();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
  console.log("  PASS " + name);
}
try {
  for (const role of ["admin", "coordinator", "fundraising", "volunteer"]) {
    const rows =
      await sql`INSERT INTO users(name,username,role,password_hash) VALUES(${"Integration " + role},${username(role)},${role},${passwordHash}) RETURNING id`;
    users[role] = String(rows[0].id);
    const login = await request("/api/auth", {
      username: username(role),
      password,
    });
    check(role + " can sign in", login.status === 200);
    cookies[role] = login.headers.get("set-cookie").split(";")[0];
  }
  check(
    "unauthenticated records are rejected",
    (await request("/api/records")).status === 401,
  );
  check(
    "cross-origin changes are rejected",
    (
      await request(
        "/api/records",
        {
          kind: "donors",
          name: "Blocked record",
          category: "Test",
          status: "New",
        },
        cookies.admin,
        "https://untrusted.example",
      )
    ).status === 403,
  );
  check(
    "coordinator cannot write donors",
    (
      await request(
        "/api/records",
        {
          kind: "donors",
          name: "Blocked record",
          category: "Test",
          status: "New",
        },
        cookies.coordinator,
      )
    ).status === 403,
  );
  check(
    "fundraising cannot write client records",
    (
      await request(
        "/api/records",
        {
          kind: "clients",
          name: "Blocked record",
          category: "Test",
          status: "New",
        },
        cookies.fundraising,
      )
    ).status === 403,
  );
  check(
    "volunteer cannot create records",
    (
      await request(
        "/api/records",
        {
          kind: "tasks",
          name: "Blocked record",
          category: "Test",
          status: "New",
        },
        cookies.volunteer,
      )
    ).status === 403,
  );
  check(
    "volunteer cannot list users",
    (await request("/api/users", null, cookies.volunteer)).status === 403,
  );
  const own =
    await sql`INSERT INTO records(kind,name,category,status,assigned_to,created_by) VALUES('tasks',${"ECF test " + suffix},'Test','New',${users.volunteer},${users.admin}) RETURNING id`;
  const other =
    await sql`INSERT INTO records(kind,name,category,status,assigned_to,created_by) VALUES('tasks',${"ECF other " + suffix},'Test','New',${users.coordinator},${users.admin}) RETURNING id`;
  const volunteerData = await (
    await request("/api/records", null, cookies.volunteer)
  ).json();
  check(
    "volunteer sees only own assigned tasks",
    volunteerData.tasks.some((t) => t.id === own[0].id) &&
      !volunteerData.tasks.some((t) => t.id === other[0].id),
  );
  check(
    "volunteer receives no client or donor data",
    volunteerData.clients.length === 0 &&
      volunteerData.donors.length === 0 &&
      volunteerData.referrals.length === 0,
  );
  check(
    "volunteer cannot update another user task",
    (
      await request(
        "/api/records",
        { id: other[0].id, kind: "tasks", status: "Completed" },
        cookies.volunteer,
      )
    ).status === 404,
  );
  check(
    "volunteer can complete own task",
    (
      await request(
        "/api/records",
        { id: own[0].id, kind: "tasks", status: "Completed" },
        cookies.volunteer,
      )
    ).status === 200,
  );
  const intake = await request("/api/intake", {
    kind: "donation",
    name: "ECF Integration Test",
    email: email("public"),
    category: "General giving",
    amount: 50,
    consent: true,
    website: "",
  });
  check("public pledge is saved", intake.status === 200);
  const donorData = await (
    await request("/api/records", null, cookies.fundraising)
  ).json();
  check(
    "public pledge appears in shared staff database",
    donorData.donors.some(
      (d) =>
        d.email === email("public") &&
        d.status === "Pledged" &&
        Number(d.amount) === 50,
    ),
  );
  const pledge = donorData.donors.find((d) => d.email === email("public"));
  check(
    "fundraising can edit donor details",
    (
      await request(
        "/api/records",
        {
          operation: "edit",
          id: pledge.id,
          kind: "donors",
          name: "ECF Updated Test",
          email: email("public"),
          category: "Individual giving",
          status: "Pledged",
          detail: "Updated test note",
          amount: 75,
        },
        cookies.fundraising,
      )
    ).status === 200,
  );
  const updatedPledge =
    await sql`SELECT name,amount FROM records WHERE id=${pledge.id}`;
  check(
    "edited donor details persist",
    updatedPledge[0].name === "ECF Updated Test" &&
      Number(updatedPledge[0].amount) === 75,
  );
  check(
    "volunteer cannot edit donor details",
    (
      await request(
        "/api/records",
        {
          operation: "edit",
          id: pledge.id,
          kind: "donors",
          name: "ECF Blocked Test",
          email: email("public"),
          category: "Test",
          status: "Pledged",
          detail: "",
          amount: 1,
        },
        cookies.volunteer,
      )
    ).status === 403,
  );
  check(
    "consent is required",
    (
      await request("/api/intake", {
        kind: "support",
        name: "ECF Test",
        email: email("public"),
        category: "Test",
        consent: false,
      })
    ).status === 400,
  );
  check(
    "honeypot rejects bot submissions",
    (
      await request("/api/intake", {
        kind: "support",
        name: "ECF Test",
        email: email("public"),
        category: "Test",
        consent: true,
        website: "spam",
      })
    ).status === 400,
  );
  const invitationResponse = await request(
    "/api/users",
    {
      name: "ECF Invited Test",
      username: username("invited"),
      role: "volunteer",
    },
    cookies.admin,
  );
  const invitation = await invitationResponse.json();
  check(
    "admin can issue invitation",
    invitationResponse.status === 200 &&
      invitation.invitation.includes("#token="),
  );
  const token = new URLSearchParams(
    new URL(invitation.invitation).hash.slice(1),
  ).get("token");
  const activation = await request("/api/auth", {
    action: "activate",
    token,
    password,
  });
  check("invitation activates account", activation.status === 200);
  check(
    "invitation cannot be replayed",
    (await request("/api/auth", { action: "activate", token, password }))
      .status === 400,
  );
  const invited =
    await sql`SELECT id FROM users WHERE username=${username("invited")}`;
  const invitedCookie = activation.headers.get("set-cookie").split(";")[0];
  check(
    "administrator can deactivate teammate",
    (
      await request(
        "/api/users",
        { action: "disable", id: invited[0].id },
        cookies.admin,
      )
    ).status === 200,
  );
  check(
    "deactivation revokes sessions",
    (await request("/api/records", null, invitedCookie)).status === 401,
  );
  check(
    "administrator cannot deactivate self",
    (
      await request(
        "/api/users",
        { action: "disable", id: users.admin },
        cookies.admin,
      )
    ).status === 400,
  );
  check(
    "logout succeeds",
    (await request("/api/auth", { action: "logout" }, cookies.volunteer))
      .status === 200,
  );
  check(
    "logout revokes session",
    (await request("/api/records", null, cookies.volunteer)).status === 401,
  );
  console.log("Integration checks passed: " + checks.length);
} catch (error) {
  console.error(
    "Integration stopped after " + checks.length + " passed checks.",
  );
  throw error;
} finally {
  const emails = [
    "admin",
    "coordinator",
    "fundraising",
    "volunteer",
    "invited",
    "public",
  ].map(email);
  const usernames = [
    "admin",
    "coordinator",
    "fundraising",
    "volunteer",
    "invited",
  ].map(username);
  const patterns = ["auth:", "intake:"].map(
    (prefix) => hash(prefix + "test-" + suffix) + ":%",
  );
  for (const role of ["admin", "coordinator", "fundraising", "volunteer"])
    patterns.push(hash("login:" + username(role)) + ":%");
  let cleaned = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await sql.transaction([
        sql`DELETE FROM audit_log WHERE user_id IN (SELECT id FROM users WHERE username=ANY(${usernames}))`,
        sql`DELETE FROM records WHERE created_by IN (SELECT id FROM users WHERE username=ANY(${usernames})) OR email=ANY(${emails})`,
        sql`DELETE FROM submissions WHERE email=ANY(${emails})`,
        sql`DELETE FROM users WHERE username=ANY(${usernames})`,
        sql`DELETE FROM rate_limits WHERE key LIKE ANY(${patterns}::text[])`,
      ]);
      cleaned = true;
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  if (cleaned)
    console.log(
      "Temporary integration users, records and requests were removed.",
    );
}
