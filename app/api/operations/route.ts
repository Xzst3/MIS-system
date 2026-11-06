import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currentUser, sameOrigin } from "@/lib/auth";
import { database } from "@/lib/db";
const day = z.iso.date();
const engagementSchema = z.object({
  person_id: z.uuid(),
  role: z.enum(["employee", "volunteer", "donor", "beneficiary"]),
  status: z.enum(["Pending", "Active", "Ended"]).default("Pending"),
  starts_on: day,
  ends_on: day.nullable().optional(),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  onboarding_complete: z.boolean().default(false),
  screening_complete: z.boolean().default(false),
  training_complete: z.boolean().default(false),
  qualification_expires_on: day.nullable().optional(),
  notes: z.string().trim().max(1000).default(""),
});
const canManage = (role: string) =>
  ["admin", "coordinator", "fundraising"].includes(role);
export async function GET() {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const sql = database();
  const filter =
    user.role === "volunteer"
      ? "p.id=(SELECT person_id FROM users WHERE id=$1)"
      : user.role === "finance"
        ? "(p.id=(SELECT person_id FROM users WHERE id=$1) OR EXISTS(SELECT 1 FROM person_engagements e WHERE e.person_id=p.id AND e.role='donor'))"
        : user.role === "fundraising"
          ? "(p.id=(SELECT person_id FROM users WHERE id=$1) OR EXISTS(SELECT 1 FROM person_engagements e WHERE e.person_id=p.id AND e.role IN ('donor','volunteer')))"
          : user.role === "coordinator"
            ? "EXISTS(SELECT 1 FROM person_engagements e WHERE e.person_id=p.id AND e.role IN ('employee','volunteer','beneficiary'))"
            : "true";
  const own = !["admin", "coordinator"].includes(user.role);
  const people = await sql.query(
    `SELECT p.id,p.name,p.email,p.phone,p.entity_type,p.communication_consent,${user.role === "finance" ? "'' AS notes" : "p.notes"},u.username,u.id AS account_id FROM people p LEFT JOIN users u ON u.person_id=p.id WHERE p.merged_into IS NULL AND ${filter} ORDER BY p.name`,
    own ? [user.id] : [],
  );
  const ids = people.map((p) => p.id);
  const engagementFilter = ["admin", "coordinator"].includes(user.role)
    ? "true"
    : user.role === "fundraising"
      ? "(role IN ('donor','volunteer') OR person_id=(SELECT person_id FROM users WHERE id=$2))"
      : user.role === "finance"
        ? "(role='donor' OR person_id=(SELECT person_id FROM users WHERE id=$2))"
        : "true";
  const [engagements, services, hours, programs, accounts, intakes] =
    await Promise.all([
      sql.query(
        `SELECT * FROM person_engagements WHERE person_id=ANY($1::uuid[]) AND ${engagementFilter} ORDER BY created_at`,
        ["fundraising", "finance"].includes(user.role) ? [ids, user.id] : [ids],
      ),
      sql.query(
        `SELECT s.*,p.name AS beneficiary,u.name AS assignee,pr.name AS program_name FROM service_records s JOIN people p ON p.id=s.beneficiary_id JOIN programs pr ON pr.id=s.program_id LEFT JOIN users u ON u.id=s.assigned_to ${own ? "WHERE s.assigned_to=$1" : ""} ORDER BY s.service_date DESC`,
        own ? [user.id] : [],
      ),
      sql.query(
        `SELECT h.*,p.name AS person,e.role AS engagement_role,u.name AS submitter,v.name AS reviewer,s.title AS service_title FROM service_hours h JOIN person_engagements e ON e.id=h.engagement_id JOIN people p ON p.id=e.person_id JOIN users u ON u.id=h.submitted_by LEFT JOIN users v ON v.id=h.reviewed_by LEFT JOIN service_records s ON s.id=h.service_id ${own ? "WHERE h.submitted_by=$1" : ""} ORDER BY h.created_at DESC`,
        own ? [user.id] : [],
      ),
      sql.query("SELECT * FROM programs WHERE service_area=true ORDER BY code"),
      ["admin", "coordinator"].includes(user.role)
        ? sql.query(
            "SELECT id,name,username,person_id FROM users WHERE active=true ORDER BY name",
          )
        : Promise.resolve([]),
      ["admin", "coordinator", "fundraising"].includes(user.role)
        ? sql.query(
            `SELECT id,kind,name,email,category,person_id,service_id,reviewed_at,created_at FROM submissions WHERE ${user.role === "fundraising" ? "kind='volunteer'" : "kind IN ('support','resource')"} ORDER BY created_at DESC LIMIT 300`,
          )
        : Promise.resolve([]),
    ]);
  return NextResponse.json(
    {
      people,
      engagements,
      services,
      hours: hours.map((h) => ({ ...h, hours: Number(h.hours) })),
      programs,
      accounts,
      intakes,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const body = await request.json();
    const sql = database();
    const need = (allowed: string[]) => {
      if (!allowed.includes(user.role))
        throw new Error("Your role cannot perform this action.");
    };
    if (body.action === "update_contact") {
      if (!canManage(user.role))
        throw new Error("Your role cannot manage shared contacts.");
      const d = z
        .object({
          id: z.uuid(),
          name: z.string().trim().min(2).max(100),
          email: z.union([z.email().max(254), z.literal("")]).default(""),
          phone: z.string().trim().max(40).default(""),
          notes: z.string().trim().max(1000).default(""),
          communication_consent: z.boolean(),
          reason: z.string().trim().min(5).max(500),
        })
        .parse(body);
      const scope =
        user.role === "admin"
          ? ["employee", "volunteer", "donor", "beneficiary"]
          : user.role === "coordinator"
            ? ["employee", "volunteer", "beneficiary"]
            : ["donor", "volunteer"];
      const allowed = await sql.query(
        "SELECT id FROM person_engagements WHERE person_id=$1 AND role=ANY($2::text[])",
        [d.id, scope],
      );
      if (!allowed.length)
        throw new Error("Your role cannot edit this contact.");
      await sql.query(
        `WITH previous AS (SELECT * FROM people WHERE id=$1 AND merged_into IS NULL FOR UPDATE), changed AS (
        UPDATE people p SET name=$2,email=$3,phone=$4,notes=$5,communication_consent=$6,updated_at=NOW() FROM previous b WHERE p.id=b.id RETURNING p.id,to_jsonb(b) AS before,to_jsonb(p) AS after
      ) INSERT INTO audit_log(user_id,action,record_id,details) SELECT $7,'Updated shared contact and communication preferences',id,jsonb_build_object('before',before,'after',after,'reason',$8::text) FROM changed`,
        [
          d.id,
          d.name,
          d.email.toLowerCase() || null,
          d.phone,
          d.notes,
          d.communication_consent,
          user.id,
          d.reason,
        ],
      );
      return NextResponse.json({ ok: true });
    }
    if (body.action === "person") {
      if (!canManage(user.role))
        throw new Error("Your role cannot manage people.");
      const data = z
        .object({
          name: z.string().trim().min(2).max(100),
          entity_type: z.enum(["person", "organization"]).default("person"),
          email: z.union([z.email().max(254), z.literal("")]).default(""),
          phone: z.string().trim().max(40).default(""),
          notes: z.string().trim().max(1000).default(""),
          communication_consent: z.boolean().default(false),
          role: z.enum(["employee", "volunteer", "donor", "beneficiary"]),
        })
        .parse(body);
      if (
        user.role === "fundraising" &&
        !["donor", "volunteer"].includes(data.role)
      )
        throw new Error(
          "Your role can create donor and volunteer profiles only.",
        );
      if (user.role === "coordinator" && data.role === "donor")
        throw new Error("Ask fundraising to add the donor engagement.");
      if (data.entity_type === "organization" && data.role !== "donor")
        throw new Error(
          "Employee, volunteer and beneficiary engagements require a person.",
        );
      const id = randomUUID();
      await sql.transaction([
        sql.query(
          "INSERT INTO people(id,name,entity_type,email,phone,notes,communication_consent) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            id,
            data.name,
            data.entity_type,
            data.email.toLowerCase() || null,
            data.phone,
            data.notes,
            data.communication_consent,
          ],
        ),
        sql.query(
          "INSERT INTO person_engagements(person_id,role,status) VALUES($1,$2,$3)",
          [
            id,
            data.role,
            ["donor", "beneficiary"].includes(data.role) ? "Active" : "Pending",
          ],
        ),
        sql.query(
          "INSERT INTO audit_log(user_id,action,record_id) VALUES($1,'Created shared person profile',$2)",
          [user.id, id],
        ),
      ]);
      return NextResponse.json({ ok: true, id });
    }
    if (body.action === "engagement") {
      if (!canManage(user.role))
        throw new Error("Your role cannot manage engagements.");
      const d = engagementSchema.parse(body);
      if (
        user.role === "fundraising" &&
        !["donor", "volunteer"].includes(d.role)
      )
        throw new Error(
          "Your role can manage donor and volunteer engagements only.",
        );
      if (user.role === "coordinator" && d.role === "donor")
        throw new Error("Ask fundraising to manage donor engagements.");
      if (d.ends_on && d.ends_on < d.starts_on)
        throw new Error("End date must follow the start date.");
      const person = await sql.query(
        "SELECT entity_type FROM people WHERE id=$1 AND merged_into IS NULL",
        [d.person_id],
      );
      if (!person.length) throw new Error("Person not found.");
      if (person[0].entity_type === "organization" && d.role !== "donor")
        throw new Error("This engagement requires a person.");
      if (
        ["employee", "volunteer"].includes(d.role) &&
        d.status === "Active" &&
        (!d.onboarding_complete ||
          !d.screening_complete ||
          !d.training_complete)
      )
        throw new Error(
          "Complete onboarding, screening and training before activating a workforce engagement.",
        );
      const id = body.id ? z.uuid().parse(body.id) : randomUUID();
      const params = [
        id,
        d.person_id,
        d.role,
        d.status,
        d.starts_on,
        d.ends_on || null,
        [...new Set(d.weekdays)],
        d.onboarding_complete,
        d.screening_complete,
        d.training_complete,
        d.qualification_expires_on || null,
        d.notes,
      ];
      if (body.id) {
        const existing = await sql.query(
          "SELECT person_id,role FROM person_engagements WHERE id=$1",
          [id],
        );
        if (
          !existing.length ||
          existing[0].person_id !== d.person_id ||
          existing[0].role !== d.role
        )
          throw new Error(
            "Engagement identity cannot be changed. Add a separate engagement instead.",
          );
      }
      await sql.transaction([
        sql.query(
          `INSERT INTO person_engagements(id,person_id,role,status,starts_on,ends_on,weekdays,onboarding_complete,screening_complete,training_complete,qualification_expires_on,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,starts_on=EXCLUDED.starts_on,ends_on=EXCLUDED.ends_on,weekdays=EXCLUDED.weekdays,onboarding_complete=EXCLUDED.onboarding_complete,screening_complete=EXCLUDED.screening_complete,training_complete=EXCLUDED.training_complete,qualification_expires_on=EXCLUDED.qualification_expires_on,notes=EXCLUDED.notes`,
          params,
        ),
        sql.query(
          "INSERT INTO audit_log(user_id,action,record_id) VALUES($1,$2,$3)",
          [user.id, "Updated " + d.role + " engagement", id],
        ),
      ]);
      return NextResponse.json({ ok: true, id });
    }
    if (body.action === "link_account") {
      need(["admin"]);
      const d = z
        .object({ person_id: z.uuid(), account_id: z.uuid() })
        .parse(body);
      const p = await sql.query(
        "SELECT id FROM people WHERE id=$1 AND entity_type='person' AND merged_into IS NULL",
        [d.person_id],
      );
      if (!p.length) throw new Error("Choose a person profile.");
      const a = await sql.query("SELECT person_id FROM users WHERE id=$1", [
        d.account_id,
      ]);
      if (!a.length || (a[0].person_id && a[0].person_id !== d.person_id))
        throw new Error(
          "This account already has a different person reference. Merge the reviewed profiles first.",
        );
      await sql.transaction([
        sql.query("UPDATE users SET person_id=$1 WHERE id=$2", [
          d.person_id,
          d.account_id,
        ]),
        sql.query(
          "INSERT INTO audit_log(user_id,action,record_id) VALUES($1,'Linked login account to shared person',$2)",
          [user.id, d.person_id],
        ),
      ]);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "service") {
      need(["admin", "coordinator"]);
      const d = z
        .object({
          id: z.uuid().optional(),
          beneficiary_id: z.uuid(),
          program_id: z.uuid(),
          service_type: z.enum([
            "Guidance",
            "Referral",
            "Appointment coordination",
            "Transport",
            "Administrative assistance",
            "Distribution",
          ]),
          title: z.string().trim().min(3).max(150),
          service_date: day,
          assigned_to: z.uuid().nullable().optional(),
          status: z.enum(["Planned", "In progress", "Completed", "Cancelled"]),
          provider: z.string().trim().max(150).default(""),
          notes: z.string().trim().max(1000).default(""),
          outcome: z.string().trim().max(1000).default(""),
        })
        .parse(body);
      const b = await sql.query(
        "SELECT id FROM person_engagements WHERE person_id=$1 AND role='beneficiary' AND status='Active'",
        [d.beneficiary_id],
      );
      if (!b.length)
        throw new Error("An active beneficiary profile is required.");
      if (d.status === "Completed" && d.outcome.length < 3)
        throw new Error("Describe the outcome before completing the service.");
      if (
        d.status === "Completed" &&
        d.service_date >
          new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })
      )
        throw new Error("A completed service cannot have a future date.");
      if (d.assigned_to) {
        const eligible = await sql.query(
          `SELECT e.id FROM users u JOIN person_engagements e ON e.person_id=u.person_id WHERE u.id=$1 AND u.active=true AND e.role IN ('employee','volunteer') AND e.status='Active' AND e.onboarding_complete AND e.screening_complete AND e.training_complete AND e.starts_on<=$2 AND (e.ends_on IS NULL OR e.ends_on>=$2) AND (e.qualification_expires_on IS NULL OR e.qualification_expires_on>=$2) AND EXTRACT(ISODOW FROM $2::date)::int=ANY(e.weekdays)`,
          [d.assigned_to, d.service_date],
        );
        if (!eligible.length)
          throw new Error(
            "The assignee has no eligible employee or volunteer engagement on this service date. Check availability and training.",
          );
      }
      const id = d.id || randomUUID();
      const intakeId = body.intake_id ? z.uuid().parse(body.intake_id) : null;
      if (intakeId) {
        const intake = await sql.query(
          "SELECT id FROM submissions WHERE id=$1 AND person_id=$2 AND kind IN ('support','resource') AND service_id IS NULL",
          [intakeId, d.beneficiary_id],
        );
        if (!intake.length)
          throw new Error(
            "This request is already linked or belongs to another person.",
          );
      }
      if (d.id) {
        const exists = await sql.query(
          "SELECT id FROM service_records WHERE id=$1",
          [id],
        );
        if (!exists.length) throw new Error("Service record not found.");
      }
      await sql.transaction([
        sql.query(
          `INSERT INTO service_records(id,beneficiary_id,program_id,service_type,title,service_date,assigned_to,status,provider,notes,outcome,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT(id) DO UPDATE SET beneficiary_id=EXCLUDED.beneficiary_id,program_id=EXCLUDED.program_id,service_type=EXCLUDED.service_type,title=EXCLUDED.title,service_date=EXCLUDED.service_date,assigned_to=EXCLUDED.assigned_to,status=EXCLUDED.status,provider=EXCLUDED.provider,notes=EXCLUDED.notes,outcome=EXCLUDED.outcome,updated_at=NOW()`,
          [
            id,
            d.beneficiary_id,
            d.program_id,
            d.service_type,
            d.title,
            d.service_date,
            d.assigned_to || null,
            d.status,
            d.provider,
            d.notes,
            d.outcome,
            user.id,
          ],
        ),
        sql.query(
          "INSERT INTO audit_log(user_id,action,record_id) VALUES($1,'Updated beneficiary service record',$2)",
          [user.id, id],
        ),
        ...(intakeId
          ? [
              sql.query(
                "UPDATE submissions SET service_id=$1,reviewed_at=NOW() WHERE id=$2",
                [id, intakeId],
              ),
            ]
          : []),
      ]);
      return NextResponse.json({ ok: true, id });
    }
    if (body.action === "hours") {
      const d = z
        .object({
          engagement_id: z.uuid(),
          service_id: z.uuid().nullable().optional(),
          service_date: day,
          hours: z.coerce.number().positive().max(24),
          description: z.string().trim().min(5).max(1000),
        })
        .parse(body);
      const result = await sql.query(
        `SELECT e.*,u.person_id AS actor_person FROM person_engagements e CROSS JOIN users u WHERE e.id=$1 AND u.id=$2 AND e.role IN ('employee','volunteer') AND e.status='Active' AND e.onboarding_complete AND e.screening_complete AND e.training_complete AND e.starts_on<=$3 AND (e.ends_on IS NULL OR e.ends_on>=$3) AND (e.qualification_expires_on IS NULL OR e.qualification_expires_on>=$3) AND EXTRACT(ISODOW FROM $3::date)::int=ANY(e.weekdays)`,
        [d.engagement_id, user.id, d.service_date],
      );
      if (!result.length)
        throw new Error(
          "No eligible engagement on this date. Check active dates, weekday availability and qualifications.",
        );
      if (result[0].person_id !== result[0].actor_person)
        throw new Error(
          "Submit hours for your own employee or volunteer engagement.",
        );
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Shanghai",
      });
      if (d.service_date > today)
        throw new Error("Hours must describe work already completed.");
      if (d.service_id) {
        const s = await sql.query(
          "SELECT id FROM service_records WHERE id=$1 AND assigned_to=$2 AND service_date=$3 AND status<>'Cancelled'",
          [d.service_id, user.id, d.service_date],
        );
        if (!s.length)
          throw new Error("Choose a service assigned to you on this date.");
      }
      const id = randomUUID();
      // The lock and the following insert share one transaction; concurrent submissions cannot exceed 24 hours.
      const rows = await sql.transaction([
        sql.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          String(result[0].person_id) + ":" + d.service_date,
        ]),
        sql.query(
          `INSERT INTO service_hours(id,engagement_id,service_id,service_date,hours,description,submitted_by) SELECT $1,$2,$3,$4,$5,$6,$7 WHERE (SELECT COALESCE(sum(h.hours),0) FROM service_hours h JOIN person_engagements e ON e.id=h.engagement_id WHERE e.person_id=$8 AND h.service_date=$4 AND h.status<>'Rejected')+$5<=24 RETURNING id`,
          [
            id,
            d.engagement_id,
            d.service_id || null,
            d.service_date,
            d.hours,
            d.description,
            user.id,
            result[0].person_id,
          ],
        ),
        sql.query(
          "INSERT INTO audit_log(user_id,action,record_id) SELECT $1,'Submitted service hours',id FROM service_hours WHERE id=$2",
          [user.id, id],
        ),
      ]);
      if (!rows[1].length)
        throw new Error(
          "Total employee and volunteer hours cannot exceed 24 on the same date.",
        );
      return NextResponse.json({ ok: true, id });
    }
    if (body.action === "review_hours") {
      need(["admin", "coordinator"]);
      const d = z
        .object({
          id: z.uuid(),
          decision: z.enum(["Approved", "Rejected"]),
          note: z.string().trim().min(3).max(1000),
        })
        .parse(body);
      const r = await sql.query(
        `WITH reviewed AS (UPDATE service_hours SET status=$1,reviewed_by=$2,reviewed_at=NOW(),review_note=$3 WHERE id=$4 AND status='Submitted' AND submitted_by<>$2 AND engagement_id NOT IN(SELECT id FROM person_engagements WHERE person_id=(SELECT person_id FROM users WHERE id=$2)) RETURNING id) INSERT INTO audit_log(user_id,action,record_id) SELECT $2,$5,id FROM reviewed RETURNING record_id`,
        [d.decision, user.id, d.note, d.id, d.decision + " service hours"],
      );
      if (!r.length)
        throw new Error(
          "A different authorized person must review submitted hours; this entry may already be reviewed.",
        );
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message || "Check the fields." },
        { status: 400 },
      );
    const e = error as Error & { code?: string };
    if (e.code === "23505")
      return NextResponse.json(
        {
          error:
            "This person or email is already linked. Find the existing profile and add an engagement instead.",
        },
        { status: 409 },
      );
    console.error("Operations update failed", e.code || "validation");
    return NextResponse.json(
      {
        error:
          e.code && e.code !== "P0001"
            ? "Unable to save this record. Please check the linked references."
            : e.message,
      },
      { status: 400 },
    );
  }
}
