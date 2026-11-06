import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";
import { randomUUID, randomBytes, scryptSync, createHash } from "node:crypto";
const origin = process.env.ECF_TEST_ORIGIN || "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw new Error("Business integration tests only target localhost.");
const raw = neon(process.env.DATABASE_URL);
const sql = {
  query: async (...args) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await raw.query(...args);
      } catch (e) {
        if (!e.sourceError || attempt === 3) throw e;
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  },
  transaction: (...args) => raw.transaction(...args),
};
const run = "b-" + randomBytes(6).toString("hex");
const users = {},
  cookies = {},
  people = [],
  funds = [],
  requests = [],
  services = [],
  engagements = [];
let checks = 0;
const date = "2026-11-06",
  weekend = "2026-10-31";
const nutrition = "10000000-0000-4000-8000-000000000001",
  welfare = "10000000-0000-4000-8000-000000000005";
const publicEmail = run + "-giving@example.test",
  intakeEmail = run + "-intake@example.test";
const salt = randomBytes(16).toString("hex"),
  password = randomBytes(24).toString("base64url");
const passwordHash =
  salt + ":" + scryptSync(password, salt, 64).toString("hex");
async function request(path, body, role, customOrigin = origin) {
  const options = {
    method: body ? "POST" : "GET",
    headers: {
      ...(body
        ? { "Content-Type": "application/json", Origin: customOrigin }
        : {}),
      ...(cookies[role] ? { Cookie: cookies[role] } : {}),
      "X-Forwarded-For": run,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(origin + path, options);
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { error: text.slice(0, 100) };
    }
    if (response.status < 500 || attempt === 2)
      return {
        status: response.status,
        body: result,
        headers: response.headers,
      };
    await new Promise((r) => setTimeout(r, 500));
  }
}
function check(name, condition, detail) {
  assert.ok(condition, name + (detail ? " " + JSON.stringify(detail) : ""));
  checks++;
  console.log("PASS " + name);
}
async function create(kind, amount, fund, options = {}, role = "fundraising") {
  const body = {
    action: "submit",
    client_reference: randomUUID(),
    kind,
    amount,
    event_date: date,
    fund_id: fund,
    description: "Business integration " + run + " " + kind,
    external_reference: run + "-" + randomUUID(),
    ...options,
  };
  const r = await request("/api/finance", body, role);
  check("submit " + kind + " " + amount, r.status === 200, r.body);
  requests.push(r.body.id);
  return { ...r.body, input: body };
}
async function review(id, role = "admin", decision = "approve") {
  return request(
    "/api/finance",
    {
      action: "review",
      id,
      decision,
      note: "Reviewed test evidence and designation.",
    },
    role,
  );
}
try {
  for (const role of [
    "admin",
    "finance",
    "coordinator",
    "fundraising",
    "volunteer",
  ]) {
    const person = randomUUID(),
      id = randomUUID();
    people.push(person);
    await sql.query("INSERT INTO people(id,name,email) VALUES($1,$2,$3)", [
      person,
      run + " " + role,
      run + "-" + role + "@example.test",
    ]);
    await sql.query(
      "INSERT INTO users(id,name,username,role,password_hash,person_id) VALUES($1,$2,$3,$4,$5,$6)",
      [id, run + " " + role, run + "-" + role, role, passwordHash, person],
    );
    users[role] = { id, person };
    const login = await request("/api/auth", {
      username: run + "-" + role,
      password,
    });
    check(role + " can log in", login.status === 200, login.body);
    cookies[role] = login.headers.get("set-cookie").split(";")[0];
    const e = randomUUID();
    engagements.push(e);
    await sql.query(
      "INSERT INTO person_engagements(id,person_id,role,status,starts_on,weekdays,onboarding_complete,screening_complete,training_complete) VALUES($1,$2,$3,'Active','2026-01-01',$4,true,true,true)",
      [
        e,
        person,
        role === "volunteer" ? "volunteer" : "employee",
        role === "volunteer" ? [6, 7] : [1, 2, 3, 4, 5],
      ],
    );
    users[role].engagement = e;
  }
  const donor = users.fundraising.person;
  await sql.query(
    "INSERT INTO person_engagements(person_id,role,status,starts_on) VALUES($1,'donor','Active','2026-01-01')",
    [donor],
  );
  const weekendEngagement = randomUUID();
  engagements.push(weekendEngagement);
  await sql.query(
    "INSERT INTO person_engagements(id,person_id,role,status,starts_on,weekdays,onboarding_complete,screening_complete,training_complete) VALUES($1,$2,'volunteer','Active','2026-01-01',ARRAY[6,7],true,true,true)",
    [weekendEngagement, donor],
  );
  const beneficiary = randomUUID();
  people.push(beneficiary);
  await sql.query("INSERT INTO people(id,name,email) VALUES($1,$2,$3)", [
    beneficiary,
    run + " beneficiary",
    run + "-beneficiary@example.test",
  ]);
  await sql.query(
    "INSERT INTO person_engagements(person_id,role,status,starts_on) VALUES($1,'beneficiary','Active','2026-01-01')",
    [beneficiary],
  );
  for (const [code, program] of [
    ["general", null],
    ["nutrition", nutrition],
    ["welfare", welfare],
  ]) {
    const id = randomUUID();
    funds.push(id);
    await sql.query(
      "INSERT INTO funds(id,code,name,program_id,restriction) VALUES($1,$2,$3,$4,$5)",
      [
        id,
        run + "-" + code,
        run + " " + code,
        program,
        program ? "Designated programme only" : "",
      ],
    );
  }
  const [general, nutri, other] = funds;
  const servicePayload = {
    action: "service",
    beneficiary_id: beneficiary,
    program_id: nutrition,
    service_type: "Referral",
    title: run + " nutrition service",
    service_date: date,
    assigned_to: users.coordinator.id,
    status: "Completed",
    provider: "Independent provider",
    notes: "Test coordination",
    outcome: "Connection and next step confirmed.",
  };
  const service = await request(
    "/api/operations",
    servicePayload,
    "coordinator",
  );
  check(
    "coordinator records beneficiary service",
    service.status === 200,
    service.body,
  );
  services.push(service.body.id);
  check(
    "unauthorized financial access is rejected",
    (await request("/api/finance", null, "volunteer")).status === 403,
  );
  check(
    "cross-origin financial submission is rejected",
    (
      await request(
        "/api/finance",
        { action: "submit" },
        "admin",
        "https://untrusted.example",
      )
    ).status === 403,
  );
  const waiting = await create("cash_donation", "10", general, {
    person_id: donor,
    settlement_confirmed: false,
  });
  check(
    "unconfirmed cash cannot be posted",
    (await review(waiting.id)).status === 400,
  );
  const gift = await create("cash_donation", "100.25", general, {
    person_id: donor,
    settlement_confirmed: true,
  });
  const backdated = await create(
    "allocation",
    "1",
    general,
    { to_fund_id: nutri, event_date: "2026-11-05" },
    "finance",
  );
  check(
    "funding unavailable on the transaction date is held",
    (await review(backdated.id)).status === 400,
  );
  const sameRetry = await request("/api/finance", gift.input, "fundraising");
  check(
    "identical request retry returns same record",
    sameRetry.body.id === gift.id,
    sameRetry,
  );
  check(
    "changed amount with the same key is rejected",
    (
      await request(
        "/api/finance",
        { ...gift.input, amount: "101" },
        "fundraising",
      )
    ).status === 409,
  );
  check(
    "fundraising cannot approve a contribution",
    (await review(gift.id, "fundraising")).status === 403,
  );
  const approvals = await Promise.all([review(gift.id), review(gift.id)]);
  check(
    "concurrent approval retries both resolve safely",
    approvals.every((r) => r.status === 200),
    approvals,
  );
  const lines = await sql.query(
    "SELECT count(*)::int AS count,sum(delta_cents)::text AS value FROM finance_postings WHERE request_id=$1",
    [gift.id],
  );
  check(
    "contribution posts exactly once in cents",
    lines[0].count === 1 && Number(lines[0].value) === 10025,
  );
  const self = await create("budget", "100", nutri, {}, "admin");
  check(
    "requester cannot approve own entry",
    (await review(self.id, "admin")).status === 400,
  );
  check(
    "different finance officer can review it",
    (await review(self.id, "finance")).status === 200,
  );
  const allocation = await create(
    "allocation",
    "80",
    general,
    { to_fund_id: nutri },
    "finance",
  );
  check(
    "approved allocation posts both sides",
    (await review(allocation.id)).status === 200,
  );
  const conserved = await sql.query(
    "SELECT sum(delta_cents)::text AS sum FROM finance_postings WHERE request_id=$1",
    [allocation.id],
  );
  check(
    "allocation conserves contribution value",
    Number(conserved[0].sum) === 0,
  );
  const illegal = await create(
    "allocation",
    "1",
    nutri,
    { to_fund_id: other },
    "finance",
  );
  check(
    "restricted funding cannot move to another programme",
    (await review(illegal.id)).status === 400,
  );
  const budget = await create("budget", "50", nutri, {}, "finance");
  check(
    "budget is independently approved",
    (await review(budget.id)).status === 200,
  );
  const expense = await create(
    "expense",
    "25",
    nutri,
    { service_id: service.body.id },
    "coordinator",
  );
  check(
    "eligible expense posts after review",
    (await review(expense.id, "finance")).status === 200,
  );
  const overBudget = await create("expense", "30", nutri, {}, "coordinator");
  check(
    "expenditure exceeding annual budget is held",
    (await review(overBudget.id)).status === 400,
  );
  const noBalance = await create("expense", "500", nutri, {}, "coordinator");
  check(
    "expenditure exceeding balance is held",
    (await review(noBalance.id)).status === 400,
  );
  const relabel = await request(
    "/api/operations",
    { ...servicePayload, id: service.body.id, program_id: welfare },
    "coordinator",
  );
  check(
    "posted service provenance cannot be relabelled",
    relabel.status === 400,
  );
  const repeated = await request(
    "/api/finance",
    { ...gift.input, client_reference: randomUUID() },
    "fundraising",
  );
  check("duplicate external receipt is rejected", repeated.status === 409);
  check(
    "unsupported currency is rejected",
    (
      await request(
        "/api/finance",
        { ...gift.input, client_reference: randomUUID(), currency: "EUR" },
        "fundraising",
      )
    ).status === 400,
  );
  const raised = await create("budget", "200", nutri, {}, "finance");
  await review(raised.id);
  const a = await create("expense", "40", nutri, {}, "coordinator"),
    b = await create("expense", "40", nutri, {}, "coordinator");
  const pair = await Promise.all([review(a.id), review(b.id)]);
  check(
    "concurrent expenses cannot overspend the fund",
    pair.filter((r) => r.status === 200).length === 1,
    pair,
  );
  const nbal = await sql.query(
    "SELECT sum(delta_cents)::text AS balance FROM finance_postings WHERE fund_id=$1",
    [nutri],
  );
  check("fund balance remains nonnegative", Number(nbal[0].balance) === 1500);
  const high = await create("cash_donation", "5000", general, {
    person_id: donor,
    settlement_confirmed: true,
  });
  check(
    "finance authority limit is enforced",
    (await review(high.id, "finance")).status === 400,
  );
  const item = await create("in_kind", "200", nutri, {
    person_id: donor,
    quantity: 2,
    item_name: run + " aids",
  });
  check(
    "in-kind receipt is reviewed separately",
    (await review(item.id)).status === 200,
  );
  const itemCash = await sql.query(
    "SELECT count(*)::int AS count FROM finance_postings WHERE request_id=$1",
    [item.id],
  );
  check("estimated asset value does not inflate cash", itemCash[0].count === 0);
  const issue = await create(
    "distribution",
    "0",
    nutri,
    { item_id: item.id, quantity: 1, service_id: service.body.id },
    "coordinator",
  );
  check(
    "distribution links stock to beneficiary service",
    (await review(issue.id)).status === 200,
  );
  const excessive = await create(
    "distribution",
    "0",
    nutri,
    { item_id: item.id, quantity: 2, service_id: service.body.id },
    "coordinator",
  );
  check(
    "stock cannot go below zero",
    (await review(excessive.id)).status === 400,
  );
  const sale = await create(
    "asset_sale",
    "70",
    nutri,
    { item_id: item.id, quantity: 1, settlement_confirmed: true },
    "finance",
  );
  check(
    "asset sale preserves source and creates cash",
    (await review(sale.id)).status === 200,
  );
  const source = await sql.query(
    "SELECT donor_id,origin_asset_id FROM finance_lots WHERE id=$1",
    [sale.id],
  );
  check(
    "sale lot retains original donor and asset",
    source[0].donor_id === donor && source[0].origin_asset_id === item.id,
  );
  await sql.query(
    "INSERT INTO person_engagements(person_id,role,status,starts_on) VALUES($1,'donor','Active','2026-01-01')",
    [users.finance.person],
  );
  const personal = await create("cash_donation", "10", general, {
    person_id: users.finance.person,
    settlement_confirmed: true,
  });
  check(
    "a reviewer cannot approve their own donor identity",
    (await review(personal.id, "finance")).status === 400,
  );
  const contact = await request(
    "/api/operations",
    {
      action: "update_contact",
      id: donor,
      name: run + " updated contact",
      email: run + "-fundraising@example.test",
      phone: "",
      notes: "Shared contact correction.",
      communication_consent: true,
      reason: "Contact confirmed their update preference.",
    },
    "fundraising",
  );
  check(
    "shared contact and preference changes are persisted",
    contact.status === 200,
    contact.body,
  );
  const history = await sql.query(
    "SELECT details FROM audit_log WHERE record_id=$1 AND action='Updated shared contact and communication preferences'",
    [donor],
  );
  check(
    "contact changes retain before and after evidence",
    history.length === 1 &&
      history[0].details.before.communication_consent === false &&
      history[0].details.after.communication_consent === true,
  );
  const protectedContact = await request(
    "/api/operations",
    {
      action: "update_contact",
      id: beneficiary,
      name: "Blocked change",
      email: "",
      phone: "",
      notes: "",
      communication_consent: false,
      reason: "This change should be blocked.",
    },
    "fundraising",
  );
  check(
    "fundraising cannot edit an unrelated beneficiary",
    protectedContact.status === 400,
  );
  const authority = await sql.query(
    "SELECT officer_limit_cents FROM finance_policy WHERE id=1",
  );
  check(
    "non-admin cannot change delegation",
    (
      await request(
        "/api/finance",
        {
          action: "policy",
          limit: String(Number(authority[0].officer_limit_cents) / 100),
        },
        "finance",
      )
    ).status === 403,
  );
  check(
    "admin can retain the delegated limit with audit",
    (
      await request(
        "/api/finance",
        {
          action: "policy",
          limit: String(Number(authority[0].officer_limit_cents) / 100),
        },
        "admin",
      )
    ).status === 200,
  );
  const fundraisingData = await request("/api/finance", null, "fundraising");
  check(
    "fundraising does not receive beneficiary service details",
    fundraisingData.body.services.length === 0 &&
      fundraisingData.body.postings.every(
        (p) => !p.beneficiary && !p.service_title,
      ),
  );
  const coordinatorData = await request("/api/finance", null, "coordinator");
  check(
    "coordinator only gets own requests and no donor lookup",
    coordinatorData.body.people.length === 0 &&
      coordinatorData.body.requests.every(
        (r) => r.submitted_by === users.coordinator.id,
      ),
  );
  const ops = await request("/api/operations", null, "fundraising");
  check(
    "one person can have employee volunteer and donor engagements",
    ["employee", "volunteer", "donor"].every((role) =>
      ops.body.engagements.some(
        (e) => e.person_id === donor && e.role === role,
      ),
    ),
  );
  const hours = await request(
    "/api/operations",
    {
      action: "hours",
      engagement_id: weekendEngagement,
      service_date: weekend,
      hours: 3,
      description: "Weekend resource coordination.",
    },
    "fundraising",
  );
  check(
    "fundraising employee can submit weekend volunteer hours",
    hours.status === 200,
    hours.body,
  );
  const wrongDay = await request(
    "/api/operations",
    {
      action: "hours",
      engagement_id: users.fundraising.engagement,
      service_date: weekend,
      hours: 3,
      description: "Incorrect weekday engagement.",
    },
    "fundraising",
  );
  check(
    "weekday engagement cannot authorize weekend work",
    wrongDay.status === 400,
  );
  check(
    "unreviewed hours remain excluded from reporting",
    (
      await sql.query("SELECT status FROM service_hours WHERE id=$1", [
        hours.body.id,
      ])
    )[0].status === "Submitted",
  );
  check(
    "independent coordinator approves service hours",
    (
      await request(
        "/api/operations",
        {
          action: "review_hours",
          id: hours.body.id,
          decision: "Approved",
          note: "Date and engagement checked.",
        },
        "coordinator",
      )
    ).status === 200,
  );
  const tooMany1 = await request(
    "/api/operations",
    {
      action: "hours",
      engagement_id: users.fundraising.engagement,
      service_date: date,
      hours: 20,
      description: "Weekday coordination work.",
    },
    "fundraising",
  );
  check(
    "valid weekday employee hours can be submitted",
    tooMany1.status === 200,
  );
  check(
    "combined daily hours cannot exceed 24",
    (
      await request(
        "/api/operations",
        {
          action: "hours",
          engagement_id: users.fundraising.engagement,
          service_date: date,
          hours: 5,
          description: "Additional work on same date.",
        },
        "fundraising",
      )
    ).status === 400,
  );
  const publicBody = {
    client_reference: randomUUID(),
    name: run + " public giver",
    email: publicEmail,
    amount: "12.34",
    fund_code: "nutrition",
    consent: true,
    communication_consent: false,
  };
  const checkout = await request("/api/giving", publicBody);
  check(
    "public checkout persists a contribution",
    checkout.status === 200,
    checkout.body,
  );
  const replay = await request("/api/giving", publicBody);
  check(
    "public checkout retry keeps one reference",
    replay.status === 200 && replay.body.reference === checkout.body.reference,
  );
  check(
    "public retry cannot change designation",
    (await request("/api/giving", { ...publicBody, fund_code: "transport" }))
      .status === 409,
  );
  const saved = await sql.query(
    "SELECT r.*,p.email FROM finance_requests r JOIN people p ON p.id=r.person_id WHERE r.reference=$1",
    [checkout.body.reference],
  );
  requests.push(saved[0].id);
  people.push(saved[0].person_id);
  check(
    "public preview retains amount designation source and review state",
    Number(saved[0].amount_cents) === 1234 &&
      saved[0].source === "website_preview" &&
      saved[0].settlement_confirmed === false &&
      saved[0].status === "Submitted",
  );
  const intake = await request("/api/intake", {
    client_reference: randomUUID(),
    kind: "support",
    name: run + " support",
    email: intakeEmail,
    category: "Nutrition planning",
    consent: true,
    website: "",
  });
  check(
    "email appointment request persists",
    intake.status === 200,
    intake.body,
  );
  const pi = await sql.query("SELECT id FROM people WHERE email=$1", [
    intakeEmail,
  ]);
  people.push(pi[0].id);
  const incoming = await request("/api/operations", null, "coordinator");
  check(
    "website request appears in the coordination queue",
    incoming.body.intakes.some((i) => i.email === intakeEmail),
  );
  const insights = await request("/api/insights", null, "admin");
  check(
    "dashboard queries return consolidated measures",
    insights.status === 200 &&
      Number.isInteger(insights.body.services.completed) &&
      Number.isInteger(insights.body.financial.pending),
  );
  console.log("Business integration checks passed: " + checks);
} finally {
  // Only this run's identities and exact request IDs are removed; all existing data is retained.
  const discovered = await sql.query(
    "SELECT id FROM people WHERE email=ANY($1::text[])",
    [[publicEmail, intakeEmail]],
  );
  for (const row of discovered)
    if (!people.includes(row.id)) people.push(row.id);
  const userIds = Object.values(users).map((u) => u.id);
  const requestRows = await sql.query(
    "SELECT id FROM finance_requests WHERE submitted_by=ANY($1::uuid[]) OR person_id=ANY($2::uuid[])",
    [userIds, people],
  );
  const reqIds = requestRows.map((r) => r.id);
  await raw.transaction([
    raw.query(
      "DELETE FROM inventory_movements WHERE request_id=ANY($1::uuid[])",
      [reqIds],
    ),
    raw.query(
      "DELETE FROM finance_postings WHERE request_id=ANY($1::uuid[]) OR lot_id=ANY($1::uuid[])",
      [reqIds],
    ),
    raw.query("DELETE FROM finance_lots WHERE id=ANY($1::uuid[])", [reqIds]),
    raw.query("DELETE FROM inventory_items WHERE id=ANY($1::uuid[])", [reqIds]),
    raw.query("DELETE FROM fund_budgets WHERE fund_id=ANY($1::uuid[])", [
      funds,
    ]),
    raw.query("DELETE FROM finance_requests WHERE id=ANY($1::uuid[])", [
      reqIds,
    ]),
    raw.query(
      "DELETE FROM audit_log WHERE user_id=ANY($1::uuid[]) OR record_id=ANY($2::uuid[])",
      [userIds, reqIds],
    ),
    raw.query("DELETE FROM service_hours WHERE submitted_by=ANY($1::uuid[])", [
      userIds,
    ]),
    raw.query(
      "DELETE FROM submissions WHERE person_id=ANY($1::uuid[]) OR email=ANY($2::text[])",
      [people, [publicEmail, intakeEmail]],
    ),
    raw.query("DELETE FROM service_records WHERE created_by=ANY($1::uuid[])", [
      userIds,
    ]),
    raw.query("DELETE FROM records WHERE person_id=ANY($1::uuid[])", [people]),
    raw.query(
      "DELETE FROM person_engagements WHERE person_id=ANY($1::uuid[])",
      [people],
    ),
    raw.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [userIds]),
    raw.query("DELETE FROM people WHERE id=ANY($1::uuid[])", [people]),
    raw.query("DELETE FROM funds WHERE id=ANY($1::uuid[])", [funds]),
    raw.query("DELETE FROM rate_limits WHERE key LIKE ANY($1::text[])", [
      ["auth:", "giving:", "intake:"]
        .map(
          (p) =>
            createHash("sha256")
              .update(p + run)
              .digest("hex") + ":%",
        )
        .concat(
          Object.keys(users).map(
            (r) =>
              createHash("sha256")
                .update("login:" + run + "-" + r)
                .digest("hex") + ":%",
          ),
        ),
    ]),
  ]);
  console.log("Scoped business integration fixtures removed.");
}
