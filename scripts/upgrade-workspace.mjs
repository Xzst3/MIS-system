import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const raw = neon(process.env.DATABASE_URL);
// This maintenance script uses stable IDs; transport retries cannot duplicate a business record.
const sql = {
  query: async (...args) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await raw.query(...args);
      } catch (e) {
        if (!e.sourceError || attempt === 3) throw e;
        await new Promise((resolve) =>
          setTimeout(resolve, 700 * (attempt + 1)),
        );
      }
    }
  },
};
const batch = "ecf-connected-workspace-2026-11-06";
const ids = {
  people: [],
  engagements: [],
  services: [],
  hours: [],
  requests: [],
};
function uuid(key) {
  const b = createHash("sha256")
    .update(batch + "/" + key)
    .digest()
    .subarray(0, 16);
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = b.toString("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    h.slice(12, 16),
    h.slice(16, 20),
    h.slice(20),
  ].join("-");
}
const accounts = JSON.parse(
  readFileSync(".local/virtual-account-seed.json", "utf8"),
);
if (!accounts.some((a) => a.username === "finance")) {
  const existing = await sql.query(
    "SELECT id FROM users WHERE username='finance'",
  );
  if (existing.length)
    throw new Error(
      "Finance username already exists outside the private virtual-account manifest. No credential was changed.",
    );
  const account = {
    username: "finance",
    name: "Jordan Ellis",
    role: "finance",
    password: "ECF-" + randomBytes(12).toString("base64url"),
  };
  accounts.push(account);
  writeFileSync(
    ".local/virtual-account-seed.json",
    JSON.stringify(accounts, null, 2),
  );
}
for (const a of accounts) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash =
    salt + ":" + scryptSync(a.password, salt, 64).toString("hex");
  await sql.query(
    "INSERT INTO users(name,username,role,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(username) DO NOTHING",
    [a.name, a.username, a.role, passwordHash],
  );
}
writeFileSync(
  ".local/TEST_ACCOUNTS.md",
  "# Private virtual accounts\n\nLogin: https://mis-ecru-sigma.vercel.app/login\n\n| Username | Password | Role |\n| --- | --- | --- |\n" +
    accounts
      .map(
        (a) => "| " + a.username + " | " + a.password + " | " + a.role + " |",
      )
      .join("\n") +
    "\n",
);
const users = Object.fromEntries(
  (
    await sql.query("SELECT * FROM users WHERE username=ANY($1)", [
      accounts.map((a) => a.username),
    ])
  ).map((a) => [a.username, a]),
);
async function person(key, name, email = null, type = "person", notes = "") {
  let rows = email
    ? await sql.query("SELECT id FROM people WHERE lower(email)=lower($1)", [
        email,
      ])
    : await sql.query("SELECT id FROM people WHERE id=$1", [
        uuid("person/" + key),
      ]);
  if (!rows.length) {
    const id = uuid("person/" + key);
    rows = await sql.query(
      "INSERT INTO people(id,name,email,entity_type,notes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET updated_at=people.updated_at RETURNING id",
      [id, name, email, type, notes],
    );
    ids.people.push(id);
  }
  return rows[0].id;
}
async function engagement(
  key,
  personId,
  role,
  days = [1, 2, 3, 4, 5, 6, 7],
  status = "Active",
) {
  const id = uuid("engagement/" + key);
  ids.engagements.push(id);
  await sql.query(
    "INSERT INTO person_engagements(id,person_id,role,status,starts_on,weekdays,onboarding_complete,screening_complete,training_complete,qualification_expires_on,notes) SELECT $1,$2,$3,$4,'2026-01-01',$5,$6,$6,$6,CASE WHEN $6 THEN '2027-12-31'::date ELSE NULL END,$7 WHERE NOT EXISTS(SELECT 1 FROM person_engagements WHERE person_id=$2 AND role=$3 AND status='Active') ON CONFLICT DO NOTHING",
    [
      id,
      personId,
      role,
      status,
      days,
      ["employee", "volunteer"].includes(role) && status === "Active",
      "Engagement reviewed for the current coordination programme.",
    ],
  );
  return id;
}
const legacy = await sql.query(
  "SELECT * FROM records WHERE kind IN ('clients','donors','volunteers') ORDER BY created_at",
);
const byName = {};
for (const r of legacy) {
  const p = await person(
    "legacy/" + r.id,
    r.name,
    r.email,
    r.kind === "donors" && /Fund|Co\./.test(r.name) ? "organization" : "person",
    r.detail,
  );
  byName[r.name] = p;
  await sql.query(
    "UPDATE records SET person_id=$1 WHERE id=$2 AND person_id IS NULL",
    [p, r.id],
  );
  await engagement(
    "legacy/" + r.id,
    p,
    r.kind === "clients"
      ? "beneficiary"
      : r.kind === "donors"
        ? "donor"
        : "volunteer",
    r.kind === "volunteers" ? [6, 7] : undefined,
    r.kind === "volunteers" && r.status !== "Active" && r.name !== "Amelia Lee"
      ? "Pending"
      : "Active",
  );
}
for (const [username, name] of [
  ["admin", "Alex Morgan"],
  ["coordinator", "Casey Rivera"],
  ["finance", "Jordan Ellis"],
  ["fundraising", "Sophie Miller"],
  ["volunteer", "Amelia Lee"],
]) {
  const p = byName[name] || (await person("account/" + username, name));
  await sql.query(
    "UPDATE users SET person_id=$1,name=$2 WHERE id=$3 AND (person_id IS NULL OR person_id=$1)",
    [p, name, users[username].id],
  );
  users[username].person_id = p;
  await engagement(
    "account/" + username,
    p,
    username === "volunteer" ? "volunteer" : "employee",
    username === "volunteer" ? [6, 7] : [1, 2, 3, 4, 5],
  );
}
await engagement(
  "sophie/weekend",
  users.fundraising.person_id,
  "volunteer",
  [6, 7],
);
await engagement("sophie/donor", users.fundraising.person_id, "donor");
const programs = Object.fromEntries(
  (await sql.query("SELECT * FROM programs")).map((p) => [p.code, p]),
);
const funds = Object.fromEntries(
  (await sql.query("SELECT * FROM funds")).map((f) => [f.code, f]),
);
const serviceDefs = [
  [
    "margaret-guidance",
    "Margaret Wilson",
    "welfare",
    "Guidance",
    "Benefits questions and next steps",
    "2026-10-27",
    "coordinator",
    "Completed",
    "Community Benefits Network",
    "Questions organized for the introductory conversation.",
    "Benefits information shared and next steps agreed.",
  ],
  [
    "margaret-referral",
    "Margaret Wilson",
    "welfare",
    "Referral",
    "Benefits network introduction",
    "2026-11-09",
    "coordinator",
    "Planned",
    "Community Benefits Network",
    "Confirm the introductory call time.",
    "",
  ],
  [
    "evelyn-meals",
    "Evelyn Brooks",
    "nutrition",
    "Referral",
    "Community meal support connection",
    "2026-10-21",
    "coordinator",
    "Completed",
    "Neighborhood Meal Connection",
    "Confirm available meal support information.",
    "Meal programme information received and a next-step conversation arranged.",
  ],
  [
    "robert-transport",
    "Robert Chen",
    "transport",
    "Transport",
    "Accompanied appointment journey",
    "2026-10-26",
    "coordinator",
    "Completed",
    "Evergreen Transport Collective",
    "Coordinate collection, waiting and return.",
    "Return journey completed and follow-up needs checked.",
  ],
  [
    "patricia-financial",
    "Patricia Garcia",
    "financial",
    "Guidance",
    "Prepare questions for a financial professional",
    "2026-09-15",
    "coordinator",
    "Completed",
    "Independent professional directory",
    "Organize the questions and checklist.",
    "Checklist shared and external professional information provided.",
  ],
  [
    "james-healthcare",
    "James Thompson",
    "healthcare",
    "Appointment coordination",
    "Healthcare appointment preparation",
    "2026-11-06",
    "coordinator",
    "In progress",
    "Independent healthcare provider",
    "Check appointment details and transport preferences.",
    "",
  ],
  [
    "william-wellbeing",
    "William Davis",
    "wellbeing",
    "Referral",
    "Community connection follow-up",
    "2026-08-14",
    "coordinator",
    "Completed",
    "Community support group",
    "Share community support information.",
    "Group information received and preferred contact method confirmed.",
  ],
  [
    "robert-distribution",
    "Robert Chen",
    "transport",
    "Distribution",
    "Mobility support handover",
    "2026-10-31",
    "volunteer",
    "Completed",
    "Community collection point",
    "Confirm access needs before handover.",
    "Mobility support aid handed over and receipt confirmed.",
  ],
  [
    "sophie-outreach",
    "Margaret Wilson",
    "welfare",
    "Administrative assistance",
    "Community information pack preparation",
    "2026-10-31",
    "fundraising",
    "Completed",
    "Foundation outreach",
    "Prepare the approved information pack.",
    "Accessible information pack prepared and the next contact agreed.",
  ],
];
const services = {};
for (const [
  key,
  name,
  program,
  type,
  title,
  date,
  assigned,
  status,
  provider,
  notes,
  outcome,
] of serviceDefs) {
  if (!byName[name]) continue;
  const id = uuid("service/" + key);
  services[key] = id;
  ids.services.push(id);
  await sql.query(
    "INSERT INTO service_records(id,beneficiary_id,program_id,service_type,title,service_date,assigned_to,status,provider,notes,outcome,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO NOTHING",
    [
      id,
      byName[name],
      programs[program].id,
      type,
      title,
      date,
      users[assigned].id,
      status,
      provider,
      notes,
      outcome,
      users.coordinator.id,
    ],
  );
}
async function financial(key, kind, amount, fund, options = {}) {
  const id = uuid("finance/" + key);
  ids.requests.push(id);
  const reference = "ECF-2026-" + key.toUpperCase();
  await sql.query(
    `INSERT INTO finance_requests(id,reference,client_reference,kind,amount_cents,event_date,fund_id,to_fund_id,person_id,service_id,item_id,quantity,item_name,external_reference,settlement_confirmed,description,submitted_by)
 VALUES($1,$2,$1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT(id) DO NOTHING`,
    [
      id,
      reference,
      kind,
      amount,
      options.date || "2026-10-28",
      funds[fund].id,
      options.to ? funds[options.to].id : null,
      options.donor ? byName[options.donor] : null,
      options.service ? services[options.service] : null,
      options.item || null,
      options.quantity || null,
      options.item_name || null,
      ["cash_donation", "expense", "asset_sale"].includes(kind)
        ? "REF-" + key.toUpperCase()
        : null,
      true,
      options.description ||
        "Resource allocation for the approved service programme.",
      users[options.submitter || "fundraising"].id,
    ],
  );
  if (!options.pending) {
    const status = await sql.query(
      "SELECT status FROM finance_requests WHERE id=$1",
      [id],
    );
    if (status[0].status === "Submitted")
      await sql.query("SELECT ecf_review_finance($1,$2,$3,$4)", [
        id,
        users.admin.id,
        "approve",
        "Purpose, supporting reference and available resources reviewed.",
      ]);
  }
  return id;
}
for (const code of [
  "nutrition",
  "financial",
  "wellbeing",
  "healthcare",
  "welfare",
  "planning",
  "transport",
  "operations",
])
  await financial(
    "budget-" + code,
    "budget",
    code === "operations" ? 300000 : 150000,
    code,
    {
      date: "2026-01-01",
      submitter: "finance",
      description: "Annual resource envelope for " + funds[code].name + ".",
    },
  );
await financial("gift-olivia", "cash_donation", 25000, "nutrition", {
  donor: "Olivia Parker",
  date: "2026-10-27",
  description: "Individual gift designated for nutrition navigation.",
});
await financial("gift-greenfield", "cash_donation", 500000, "general", {
  donor: "Greenfield Community Fund",
  date: "2026-10-25",
  description:
    "Community grant supporting the foundation’s coordination programme.",
});
await financial("gift-daniel", "cash_donation", 10000, "general", {
  donor: "Daniel Anderson",
  date: "2026-09-12",
  description: "Individual gift for general foundation support.",
});
await financial("gift-sarah", "cash_donation", 50000, "general", {
  donor: "Sarah Williams",
  date: "2026-08-06",
  description: "Individual gift for accessible information and guidance.",
});
await financial("gift-maple", "cash_donation", 100000, "general", {
  donor: "Maple & Co.",
  date: "2026-06-16",
  description: "Community giving contribution for the foundation programme.",
});
byName["Sophie Miller"] = users.fundraising.person_id;
await financial("gift-sophie", "cash_donation", 7500, "general", {
  donor: "Sophie Miller",
  date: "2026-10-30",
  description:
    "Personal contribution supporting community information resources.",
});
for (const [code, amount] of [
  ["nutrition", 150000],
  ["transport", 100000],
  ["operations", 100000],
  ["welfare", 30000],
  ["healthcare", 20000],
  ["wellbeing", 30000],
])
  await financial("allocate-" + code, "allocation", amount, "general", {
    to: code,
    submitter: "finance",
    description:
      "Allocate general support to " +
      funds[code].name +
      " under the programme plan.",
  });
await financial("expense-meals", "expense", 12000, "nutrition", {
  service: "evelyn-meals",
  submitter: "coordinator",
  description:
    "External meal-support consultation fee associated with Evelyn’s service connection.",
});
await financial("expense-transport", "expense", 8500, "transport", {
  service: "robert-transport",
  submitter: "coordinator",
  description:
    "Transport and accompaniment cost for the completed appointment journey.",
});
await financial("expense-rent", "expense", 45000, "operations", {
  submitter: "finance",
  description: "Premises rent supporting the foundation’s coordination team.",
});
await financial("expense-team", "expense", 40000, "operations", {
  submitter: "finance",
  description: "Staff coordination time allocated to foundation operations.",
});
const aids = await financial("items-mobility", "in_kind", 32000, "transport", {
  donor: "Maple & Co.",
  quantity: 4,
  item_name: "Mobility support aids",
  description:
    "Four mobility support aids received for transport programme use.",
});
await financial("issue-mobility", "distribution", 0, "transport", {
  item: aids,
  quantity: 1,
  service: "robert-distribution",
  submitter: "coordinator",
  description:
    "One mobility support aid allocated to the beneficiary handover record.",
});
const car = await financial("asset-vehicle", "in_kind", 800000, "general", {
  donor: "Maple & Co.",
  quantity: 1,
  item_name: "Community vehicle",
  description:
    "Vehicle donated to support the foundation through sale proceeds.",
});
await financial("sale-vehicle", "asset_sale", 550000, "general", {
  item: car,
  quantity: 1,
  submitter: "finance",
  description:
    "Sale proceeds from the donated community vehicle. Original donor and asset retained.",
});
await financial("pending-transport", "expense", 6000, "transport", {
  service: "robert-transport",
  submitter: "coordinator",
  pending: true,
  date: "2026-11-06",
  description:
    "Additional transport coordination invoice awaiting an independent review.",
});
await financial("pending-healthcare", "expense", 24000, "healthcare", {
  service: "james-healthcare",
  submitter: "coordinator",
  pending: true,
  date: "2026-11-06",
  description:
    "Provider coordination request awaiting review against the available fund balance.",
});
for (const [key, username, role, date, hours, serviceKey, approved] of [
  ["sophie-weekday", "fundraising", "employee", "2026-10-30", 7.5, null, true],
  [
    "sophie-weekend",
    "fundraising",
    "volunteer",
    "2026-10-31",
    3,
    "sophie-outreach",
    true,
  ],
  ["amelia-weekend", "volunteer", "volunteer", "2026-10-31", 2.5, null, false],
]) {
  const e = await sql.query(
    "SELECT id FROM person_engagements WHERE person_id=$1 AND role=$2 AND status='Active' ORDER BY created_at LIMIT 1",
    [users[username].person_id, role],
  );
  if (!e.length) continue;
  const id = uuid("hours/" + key);
  ids.hours.push(id);
  await sql.query(
    "INSERT INTO service_hours(id,engagement_id,service_id,service_date,hours,description,submitted_by,status,reviewed_by,reviewed_at,review_note) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO NOTHING",
    [
      id,
      e[0].id,
      serviceKey ? services[serviceKey] : null,
      date,
      hours,
      role === "volunteer"
        ? "Community resource pack and outreach coordination."
        : "Weekday coordination and relationship work.",
      users[username].id,
      approved ? "Approved" : "Submitted",
      approved ? users.coordinator.id : null,
      approved ? "2026-11-02T09:00:00Z" : null,
      approved ? "Hours and engagement checked." : "",
    ],
  );
}
mkdirSync(".local", { recursive: true });
writeFileSync(
  ".local/operations-seed-manifest.json",
  JSON.stringify({ batch, ...ids }, null, 2),
);
console.log(
  "Connected workspace ready. Original records and login passwords retained. Private account list: .local/TEST_ACCOUNTS.md.",
);
console.table(
  await sql.query(
    "SELECT kind,status,count(*)::int AS count FROM finance_requests GROUP BY kind,status ORDER BY kind,status",
  ),
);
console.table(
  await sql.query(
    "SELECT role,status,count(*)::int AS count FROM person_engagements GROUP BY role,status ORDER BY role,status",
  ),
);
