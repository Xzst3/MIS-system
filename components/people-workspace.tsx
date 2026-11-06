"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Plus,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import type { User } from "@/lib/types";
import type {
  Person,
  Engagement,
  Service,
  Hours,
  OperationsData,
} from "@/lib/operations-types";
import {
  BusinessModal,
  LoadState,
  Status,
  Empty,
  today,
  dateText,
  send,
  useRemote,
} from "./business-ui";
import { Metric } from "./finance-workspace";
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function PeopleWorkspace({ user, view }: { user: User; view: string }) {
  const params = useSearchParams();
  const [intake, setIntake] = useState<
    OperationsData["intakes"][number] | null
  >(null);
  const remote = useRemote<OperationsData>("/api/operations");
  const { data } = remote;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(
    view === "donors"
      ? "donor"
      : view === "volunteers"
        ? "volunteer"
        : view === "clients"
          ? "beneficiary"
          : "",
  );
  const [tab, setTab] = useState(
    view === "services" || view === "referrals" ? "services" : "people",
  );
  const [person, setPerson] = useState<Person | null>(null);
  const [createPerson, setCreatePerson] = useState(false);
  const [editContact, setEditContact] = useState<Person | null>(null);
  const [engagement, setEngagement] = useState<{
    person: Person;
    value?: Engagement;
  } | null>(null);
  const [engagementRole, setEngagementRole] = useState("volunteer");
  const [service, setService] = useState<Service | null | undefined>(undefined);
  const [hoursForm, setHoursForm] = useState(false);
  const [reviewHours, setReviewHours] = useState<Hours | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const target = params.get("tab");
    if (target && ["people", "services", "hours", "requests"].includes(target))
      setTab(target);
  }, [params]);
  const manage = ["admin", "coordinator"].includes(user.role);
  const canPeople = ["admin", "coordinator", "fundraising"].includes(user.role);
  async function save(
    event: React.FormEvent<HTMLFormElement>,
    action: string,
    extras: Record<string, unknown> = {},
  ) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        ...Object.fromEntries(f),
        ...extras,
        action,
      };
      if (action === "person" || action === "update_contact")
        body.communication_consent = f.get("communication_consent") === "on";
      if (action === "engagement") {
        body.weekdays = f.getAll("weekdays").map(Number);
        for (const field of [
          "onboarding_complete",
          "screening_complete",
          "training_complete",
        ])
          body[field] = f.get(field) === "on";
        body.ends_on = f.get("ends_on") || null;
        body.qualification_expires_on =
          f.get("qualification_expires_on") || null;
      }
      if (action === "service") body.assigned_to = f.get("assigned_to") || null;
      if (action === "hours") body.service_id = f.get("service_id") || null;
      if (action === "service" && intake) body.intake_id = intake.id;
      await send("/api/operations", body);
      setIntake(null);
      setCreatePerson(false);
      setEditContact(null);
      setEngagement(null);
      setService(undefined);
      setHoursForm(false);
      setReviewHours(null);
      setMessage("Saved. Linked records and histories are updated.");
      await remote.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <LoadState
        error={remote.error}
        loading={remote.loading}
        onRetry={remote.refresh}
      />
    );
  const own = data.people.find((p) => p.account_id === user.id);
  const ownEngagements = data.engagements.filter(
    (e) =>
      e.person_id === own?.id &&
      ["employee", "volunteer"].includes(e.role) &&
      e.status === "Active",
  );
  const people = data.people.filter(
    (p) =>
      (!filter ||
        data.engagements.some(
          (e) => e.person_id === p.id && e.role === filter,
        )) &&
      (!query ||
        (p.name + " " + p.email + " " + p.username)
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const services = data.services.filter(
    (s) =>
      (view !== "referrals" || s.service_type === "Referral") &&
      (!query ||
        (s.title + " " + s.beneficiary + " " + s.program_name)
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  const beneficiaries = data.people.filter((p) =>
    data.engagements.some(
      (e) =>
        e.person_id === p.id &&
        e.role === "beneficiary" &&
        e.status === "Active",
    ),
  );
  const selected = person
    ? data.people.find((p) => p.id === person.id) || person
    : null;
  const allowedRoles =
    user.role === "fundraising"
      ? ["donor", "volunteer"]
      : user.role === "coordinator"
        ? ["beneficiary", "employee", "volunteer"]
        : ["beneficiary", "donor", "employee", "volunteer"];
  return (
    <div>
      <LoadState
        error={remote.error}
        loading={false}
        onRetry={remote.refresh}
      />
      {message && (
        <div className="business-success" role="status">
          <CheckCircle2 size={20} />
          {message}
        </div>
      )}
      <div className="business-toolbar">
        <p>
          {manage
            ? "One person, a complete support journey and distinct engagements."
            : "Your business engagements stay linked to one person profile. They do not change your login permissions."}
        </p>
        <div>
          {canPeople && tab === "people" && (
            <button
              className="button button-dark"
              onClick={() => {
                setError("");
                setCreatePerson(true);
              }}
            >
              <Plus size={18} /> Add a person
            </button>
          )}
          {manage && tab === "services" && (
            <button
              className="button button-dark"
              onClick={() => {
                setError("");
                setService(null);
              }}
            >
              <Plus size={18} /> New service record
            </button>
          )}
          {tab === "hours" && (
            <button
              className="button button-dark"
              onClick={() => {
                setError("");
                setHoursForm(true);
              }}
            >
              <Plus size={18} /> Record my hours
            </button>
          )}
        </div>
      </div>
      <div
        className="business-tabs"
        role="tablist"
        aria-label="People and service sections"
      >
        {canPeople && (
          <button
            role="tab"
            aria-selected={tab === "requests"}
            onClick={() => setTab("requests")}
          >
            Website requests{" "}
            <span>{data.intakes.filter((i) => !i.reviewed_at).length}</span>
          </button>
        )}
        {canPeople && (
          <button
            role="tab"
            aria-selected={tab === "people"}
            onClick={() => setTab("people")}
          >
            People & engagements
          </button>
        )}
        <button
          role="tab"
          aria-selected={tab === "services"}
          onClick={() => setTab("services")}
        >
          {manage ? "Service records" : "My services"}
        </button>
        <button
          role="tab"
          aria-selected={tab === "hours"}
          onClick={() => setTab("hours")}
        >
          Service hours{" "}
          {manage && (
            <span>
              {data.hours.filter((h) => h.status === "Submitted").length}
            </span>
          )}
        </button>
      </div>
      {tab === "requests" ? (
        <>
          <div className="business-info">
            These are requests for a conversation, not confirmed appointment
            slots. Contact the person by email and record the agreed next step.
          </div>
          <div className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Interest / date</th>
                  <th>Status</th>
                  <th>Next step</th>
                </tr>
              </thead>
              <tbody>
                {data.intakes.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.name}</strong>
                      <small>{i.email}</small>
                    </td>
                    <td>
                      {i.category}
                      <small>{dateText(i.created_at)}</small>
                    </td>
                    <td>
                      <Status value={i.reviewed_at ? "Completed" : "New"} />
                    </td>
                    <td>
                      {manage && i.person_id && !i.service_id ? (
                        <button
                          className="business-detail-button"
                          onClick={() => {
                            setIntake(i);
                            setService(null);
                            setError("");
                          }}
                        >
                          Create service record <ArrowUpRight size={17} />
                        </button>
                      ) : (
                        <button
                          className="business-detail-button"
                          onClick={() => {
                            const p = data.people.find(
                              (p) => p.id === i.person_id,
                            );
                            if (p) setPerson(p);
                          }}
                        >
                          View person <ArrowUpRight size={17} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.intakes.length && (
              <Empty>No website requests in this view yet.</Empty>
            )}
          </div>
        </>
      ) : tab === "people" ? (
        <>
          <div className="business-info">
            <Users size={23} />
            <span>
              A person can be an employee on weekdays, a volunteer at weekends
              and a donor at any time. Each engagement keeps its own dates,
              availability and eligibility; it does not enroll anyone in
              payroll.
            </span>
          </div>
          <div className="business-filters">
            <label className="business-search">
              <Search size={19} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search people"
                placeholder="Search a name, email or username"
              />
            </label>
            <select
              aria-label="Filter by engagement"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">All engagements</option>
              {["beneficiary", "donor", "employee", "volunteer"].map((r) => (
                <option key={r} value={r}>
                  {r[0].toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>Person / organization</th>
                  <th>Engagements</th>
                  <th>Contact preference</th>
                  <th>Profile</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <small>
                        {p.email || "No email recorded"}
                        {p.username ? " · @" + p.username : ""}
                      </small>
                    </td>
                    <td>
                      <div className="engagement-chips">
                        {data.engagements
                          .filter((e) => e.person_id === p.id)
                          .map((e) => (
                            <span key={e.id} title={e.status}>
                              {e.role}
                              <i
                                className={
                                  e.status === "Active" ? "active" : ""
                                }
                              />
                            </span>
                          ))}
                      </div>
                    </td>
                    <td>
                      {p.communication_consent
                        ? "Updates permitted"
                        : "Request-related contact only"}
                    </td>
                    <td>
                      <button
                        className="business-detail-button"
                        aria-label={"View " + p.name}
                        onClick={() => {
                          setError("");
                          setPerson(p);
                        }}
                      >
                        View profile <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!people.length && (
              <Empty>
                No matching profiles. Reuse an existing person before adding
                another engagement.
              </Empty>
            )}
          </div>
        </>
      ) : tab === "services" ? (
        <>
          <div className="business-metrics">
            <Metric
              label="People supported"
              value={String(
                new Set(
                  data.services
                    .filter((s) => s.status === "Completed")
                    .map((s) => s.beneficiary_id),
                ).size,
              )}
              note="Distinct beneficiaries with completed services"
              icon={<Users />}
            />
            <Metric
              label="Open services"
              value={String(
                data.services.filter((s) =>
                  ["Planned", "In progress"].includes(s.status),
                ).length,
              )}
              note="Planned or in progress"
              icon={<Clock3 />}
            />
            <Metric
              label="Completed services"
              value={String(
                data.services.filter((s) => s.status === "Completed").length,
              )}
              note="An outcome is recorded"
              icon={<CheckCircle2 />}
            />
            <Metric
              label="Approved volunteer hours"
              value={String(
                data.hours
                  .filter(
                    (h) =>
                      h.status === "Approved" &&
                      h.engagement_role === "volunteer",
                  )
                  .reduce((n, h) => n + h.hours, 0),
              )}
              note="Unreviewed hours excluded"
              icon={<UserRound />}
            />
          </div>
          <div className="business-filters">
            <label className="business-search">
              <Search size={19} />
              <input
                aria-label="Search service records"
                placeholder="Search beneficiary, programme or service"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>Beneficiary / service</th>
                  <th>Programme / date</th>
                  <th>Assigned to</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.beneficiary}</strong>
                      <small>{s.title}</small>
                    </td>
                    <td>
                      {s.program_name}
                      <small>
                        {s.service_type} · {dateText(s.service_date)}
                      </small>
                    </td>
                    <td>{s.assignee || "Not assigned"}</td>
                    <td>
                      <Status value={s.status} />
                    </td>
                    <td>
                      <button
                        className="business-detail-button"
                        aria-label={"View service " + s.title}
                        onClick={() => {
                          setError("");
                          setService(s);
                        }}
                      >
                        View <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!services.length && (
              <Empty>No service records in this view yet.</Empty>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="business-info">
            <Clock3 size={22} />
            <span>
              Record the engagement you actually served under. Employee and
              volunteer hours remain separate, and only independently approved
              entries enter service reporting.
            </span>
          </div>
          <div className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>Person / engagement</th>
                  <th>Date / work</th>
                  <th>Hours</th>
                  <th>Status</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {data.hours.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <strong>{h.person}</strong>
                      <small>{h.engagement_role}</small>
                    </td>
                    <td>
                      {dateText(h.service_date)}
                      <small>{h.service_title || h.description}</small>
                    </td>
                    <td>{h.hours}</td>
                    <td>
                      <Status value={h.status} />
                    </td>
                    <td>
                      {h.status === "Submitted" &&
                      manage &&
                      h.submitted_by !== user.id ? (
                        <button
                          className="business-detail-button"
                          onClick={() => {
                            setError("");
                            setReviewHours(h);
                          }}
                        >
                          Review <ArrowUpRight size={17} />
                        </button>
                      ) : (
                        <span>
                          {h.reviewer || "Awaiting another reviewer"}
                          <small>{h.review_note}</small>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.hours.length && (
              <Empty>No service hours have been submitted.</Empty>
            )}
          </div>
        </>
      )}
      {createPerson && (
        <BusinessModal
          title="Add a shared person profile"
          onClose={() => {
            if (!busy) setCreatePerson(false);
          }}
        >
          <form onSubmit={(e) => save(e, "person")}>
            <fieldset disabled={busy}>
              <p className="business-info">
                Search for an existing profile first. Add another engagement to
                the same person when roles overlap.
              </p>
              <div className="business-form-grid">
                <label className="field">
                  Full name / organization
                  <input name="name" required minLength={2} maxLength={100} />
                </label>
                <label className="field">
                  Profile type
                  <select name="entity_type">
                    <option value="person">Person</option>
                    <option value="organization">Organization donor</option>
                  </select>
                </label>
                <label className="field">
                  Email
                  <input name="email" type="email" maxLength={254} />
                </label>
                <label className="field">
                  Phone
                  <input name="phone" maxLength={40} />
                </label>
                <label className="field">
                  First engagement
                  <select name="role">
                    {allowedRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                Shared coordination notes
                <textarea
                  name="notes"
                  maxLength={1000}
                  placeholder="Keep protected personnel or screening details out of shared contact notes."
                />
              </label>
              <label className="check-field">
                <input name="communication_consent" type="checkbox" />
                Foundation updates permitted by this person
              </label>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <button className="button button-dark">
                Create profile <ArrowRight size={18} />
              </button>
            </fieldset>
          </form>
        </BusinessModal>
      )}
      {selected && (
        <BusinessModal
          title={selected.name}
          onClose={() => {
            setPerson(null);
            setError("");
          }}
        >
          <div className="person-reference">
            <UserRound size={25} />
            <span>
              <strong>{selected.email || "No email recorded"}</strong>
              <small>Person reference: {selected.id}</small>
            </span>
          </div>
          {selected.notes && <p>{selected.notes}</p>}
          {canPeople && (
            <button
              className="text-link"
              onClick={() => {
                setPerson(null);
                setEditContact(selected);
                setError("");
              }}
            >
              Edit contact details & preferences <ArrowUpRight size={17} />
            </button>
          )}
          <div className="business-section-intro">
            <h3>Distinct roles. One person.</h3>
          </div>
          <div className="engagement-list">
            {data.engagements
              .filter((e) => e.person_id === selected.id)
              .map((e) => (
                <div className="engagement-card" key={e.id}>
                  <div>
                    <strong>{e.role[0].toUpperCase() + e.role.slice(1)}</strong>
                    <Status value={e.status} />
                  </div>
                  <p>
                    {dateText(e.starts_on)}
                    {e.ends_on ? " – " + dateText(e.ends_on) : " onwards"}
                  </p>
                  <div className="weekday-chips">
                    {days.map((day, i) => (
                      <span
                        key={day}
                        className={e.weekdays.includes(i + 1) ? "selected" : ""}
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                  {["employee", "volunteer"].includes(e.role) && (
                    <small>
                      Onboarding {e.onboarding_complete ? "✓" : "pending"} ·
                      Screening {e.screening_complete ? "✓" : "pending"} ·
                      Training {e.training_complete ? "✓" : "pending"}
                      {e.qualification_expires_on
                        ? " · Valid through " +
                          dateText(e.qualification_expires_on)
                        : ""}
                    </small>
                  )}
                  {allowedRoles.includes(e.role) && (
                    <button
                      className="text-link"
                      onClick={() => {
                        setPerson(null);
                        setEngagementRole(e.role);
                        setEngagement({ person: selected, value: e });
                      }}
                    >
                      Review engagement <ArrowUpRight size={15} />
                    </button>
                  )}
                </div>
              ))}
          </div>
          <div className="business-action-row">
            <button
              className="button button-outline"
              onClick={() => {
                setPerson(null);
                setEngagementRole(allowedRoles[0]);
                setEngagement({ person: selected });
              }}
            >
              Add another engagement <Plus size={17} />
            </button>
            {data.engagements.some(
              (e) => e.person_id === selected.id && e.role === "donor",
            ) && (
              <Link
                className="button button-outline"
                href={
                  "/workspace/finance?person=" +
                  encodeURIComponent(selected.name)
                }
              >
                View giving history <ArrowUpRight size={17} />
              </Link>
            )}
          </div>
          {user.role === "admin" && !selected.account_id && (
            <form
              className="account-link-form"
              onSubmit={(e) =>
                save(e, "link_account", { person_id: selected.id })
              }
            >
              <label className="field">
                Link an existing login account
                <select name="account_id" required>
                  <option value="">Choose an unlinked account</option>
                  {data.accounts
                    .filter((a) => !a.person_id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        @{a.username} · {a.name}
                      </option>
                    ))}
                </select>
              </label>
              <button className="button button-outline">Link account</button>
            </form>
          )}
          {data.services.some((s) => s.beneficiary_id === selected.id) && (
            <>
              <div className="business-section-intro">
                <h3>Support journey</h3>
              </div>
              <div className="person-timeline">
                {data.services
                  .filter((s) => s.beneficiary_id === selected.id)
                  .slice()
                  .reverse()
                  .map((s) => (
                    <article key={s.id}>
                      <small>
                        {dateText(s.service_date)} · {s.program_name}
                      </small>
                      <h3>{s.title}</h3>
                      <Status value={s.status} />
                      <p>{s.outcome || s.notes}</p>
                    </article>
                  ))}
              </div>
            </>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </BusinessModal>
      )}
      {editContact && (
        <BusinessModal
          title={"Edit " + editContact.name}
          onClose={() => {
            if (!busy) setEditContact(null);
          }}
        >
          <form
            onSubmit={(e) => save(e, "update_contact", { id: editContact.id })}
          >
            <fieldset disabled={busy}>
              <div className="business-form-grid">
                <label className="field">
                  Full name / organization
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={editContact.name}
                  />
                </label>
                <label className="field">
                  Email
                  <input
                    name="email"
                    type="email"
                    maxLength={254}
                    defaultValue={editContact.email || ""}
                  />
                </label>
                <label className="field">
                  Phone
                  <input
                    name="phone"
                    maxLength={40}
                    defaultValue={editContact.phone}
                  />
                </label>
              </div>
              <label className="field">
                Shared coordination notes
                <textarea
                  name="notes"
                  maxLength={1000}
                  defaultValue={editContact.notes}
                />
              </label>
              <label className="check-field">
                <input
                  name="communication_consent"
                  type="checkbox"
                  defaultChecked={editContact.communication_consent}
                />
                Foundation updates permitted by this person
              </label>
              <label className="field">
                Reason for this change
                <textarea
                  name="reason"
                  required
                  minLength={5}
                  maxLength={500}
                  placeholder="Record the correction or how the person updated their preferences."
                />
              </label>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <button className="button button-dark">
                Save contact details <CheckCircle2 size={18} />
              </button>
            </fieldset>
          </form>
        </BusinessModal>
      )}
      {engagement && (
        <BusinessModal
          title={engagement.person.name + " · engagement"}
          onClose={() => {
            if (!busy) setEngagement(null);
          }}
        >
          <form
            onSubmit={(e) =>
              save(e, "engagement", {
                person_id: engagement.person.id,
                ...(engagement.value ? { id: engagement.value.id } : {}),
              })
            }
          >
            <fieldset disabled={busy}>
              <div className="business-form-grid">
                <label className="field">
                  Role
                  <select
                    name="role"
                    value={engagementRole}
                    onChange={(e) => setEngagementRole(e.target.value)}
                    disabled={!!engagement.value}
                  >
                    {allowedRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {engagement.value && (
                    <input type="hidden" name="role" value={engagementRole} />
                  )}
                </label>
                <label className="field">
                  Status
                  <select
                    name="status"
                    defaultValue={engagement.value?.status || "Pending"}
                  >
                    {["Pending", "Active", "Ended"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Starts on
                  <input
                    name="starts_on"
                    type="date"
                    required
                    defaultValue={
                      engagement.value?.starts_on.slice(0, 10) || today()
                    }
                  />
                </label>
                <label className="field">
                  Ends on (optional)
                  <input
                    name="ends_on"
                    type="date"
                    defaultValue={engagement.value?.ends_on?.slice(0, 10)}
                  />
                </label>
              </div>
              <div className="field">
                Available days
                <div className="weekday-checkboxes" key={engagementRole}>
                  {days.map((day, i) => (
                    <label key={day}>
                      <input
                        type="checkbox"
                        name="weekdays"
                        value={i + 1}
                        defaultChecked={
                          engagement.value
                            ? engagement.value.weekdays.includes(i + 1)
                            : engagementRole === "employee"
                              ? i < 5
                              : engagementRole === "volunteer"
                                ? i >= 5
                                : true
                        }
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>
              {["employee", "volunteer"].includes(engagementRole) && (
                <>
                  <div className="business-info">
                    Active service assignments require completed onboarding,
                    screening and training, plus valid dates and weekday
                    availability.
                  </div>
                  {[
                    ["onboarding_complete", "Onboarding complete"],
                    ["screening_complete", "Screening complete"],
                    ["training_complete", "Training / qualification verified"],
                  ].map(([name, label]) => (
                    <label className="check-field" key={name}>
                      <input
                        name={name}
                        type="checkbox"
                        defaultChecked={Boolean(
                          engagement.value?.[name as keyof Engagement],
                        )}
                      />
                      {label}
                    </label>
                  ))}
                  <label className="field">
                    Qualification valid through (if applicable)
                    <input
                      name="qualification_expires_on"
                      type="date"
                      defaultValue={engagement.value?.qualification_expires_on?.slice(
                        0,
                        10,
                      )}
                    />
                  </label>
                </>
              )}
              <label className="field">
                Engagement notes / evidence reference
                <textarea
                  name="notes"
                  maxLength={1000}
                  defaultValue={engagement.value?.notes}
                />
              </label>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <button className="button button-dark">
                Save engagement <CheckCircle2 size={18} />
              </button>
            </fieldset>
          </form>
        </BusinessModal>
      )}
      {service !== undefined && (
        <BusinessModal
          title={service ? "Service record" : "New beneficiary service"}
          onClose={() => {
            if (!busy) setService(undefined);
          }}
        >
          {manage ? (
            <form
              onSubmit={(e) =>
                save(e, "service", service ? { id: service.id } : {})
              }
            >
              <fieldset disabled={busy}>
                <div className="business-form-grid">
                  <label className="field">
                    Beneficiary
                    <select
                      name="beneficiary_id"
                      defaultValue={
                        service?.beneficiary_id || intake?.person_id || ""
                      }
                      required
                    >
                      <option value="">Choose a beneficiary</option>
                      {beneficiaries.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Programme
                    <select
                      name="program_id"
                      defaultValue={service?.program_id}
                      required
                    >
                      {data.programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Service type
                    <select
                      name="service_type"
                      defaultValue={service?.service_type || "Guidance"}
                    >
                      {[
                        "Guidance",
                        "Referral",
                        "Appointment coordination",
                        "Transport",
                        "Administrative assistance",
                        "Distribution",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Service date
                    <input
                      type="date"
                      name="service_date"
                      defaultValue={
                        service?.service_date.slice(0, 10) || today()
                      }
                      required
                    />
                  </label>
                  <label className="field">
                    Assigned team member
                    <select
                      name="assigned_to"
                      defaultValue={service?.assigned_to || ""}
                    >
                      <option value="">Not assigned yet</option>
                      {data.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Status
                    <select
                      name="status"
                      defaultValue={service?.status || "Planned"}
                    >
                      {["Planned", "In progress", "Completed", "Cancelled"].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
                <label className="field">
                  Service title
                  <input
                    name="title"
                    minLength={3}
                    maxLength={150}
                    required
                    defaultValue={
                      service?.title ||
                      (intake ? "Initial conversation: " + intake.category : "")
                    }
                  />
                </label>
                <label className="field">
                  External provider / destination
                  <input
                    name="provider"
                    maxLength={150}
                    defaultValue={service?.provider}
                  />
                </label>
                <label className="field">
                  Coordination notes
                  <textarea
                    name="notes"
                    maxLength={1000}
                    defaultValue={
                      service?.notes ||
                      (intake
                        ? "Email conversation requested through the public portal. Contact the person to agree the next step."
                        : "")
                    }
                  />
                </label>
                <label className="field">
                  Outcome / next step
                  <textarea
                    name="outcome"
                    maxLength={1000}
                    defaultValue={service?.outcome}
                    placeholder="Required before marking the service Completed."
                  />
                </label>
                {error && (
                  <div className="form-error" role="alert">
                    {error}
                  </div>
                )}
                <button className="button button-dark">
                  Save service record <CheckCircle2 size={18} />
                </button>
              </fieldset>
            </form>
          ) : (
            <>
              <h3>{service?.title}</h3>
              <p>
                {service?.beneficiary} · {dateText(service?.service_date || "")}
              </p>
              <dl className="business-definition">
                <dt>Programme</dt>
                <dd>{service?.program_name}</dd>
                <dt>Provider</dt>
                <dd>{service?.provider || "To be confirmed"}</dd>
                <dt>Instructions</dt>
                <dd>{service?.notes || "No additional instructions."}</dd>
                <dt>Outcome</dt>
                <dd>{service?.outcome || "Awaiting follow-up"}</dd>
              </dl>
            </>
          )}
        </BusinessModal>
      )}
      {hoursForm && (
        <BusinessModal
          title="Record my service hours"
          onClose={() => {
            if (!busy) setHoursForm(false);
          }}
        >
          {ownEngagements.length ? (
            <form onSubmit={(e) => save(e, "hours")}>
              <fieldset disabled={busy}>
                <label className="field">
                  Engagement
                  <select name="engagement_id" required>
                    {ownEngagements.map((e) => (
                      <option value={e.id} key={e.id}>
                        {e.role} ·{" "}
                        {e.weekdays.map((d) => days[d - 1]).join(", ")}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="business-form-grid">
                  <label className="field">
                    Date
                    <input
                      name="service_date"
                      type="date"
                      required
                      max={today()}
                      defaultValue={today()}
                    />
                  </label>
                  <label className="field">
                    Hours
                    <input
                      name="hours"
                      type="number"
                      min="0.25"
                      max="24"
                      step="0.25"
                      required
                    />
                  </label>
                </div>
                <label className="field">
                  Related assigned service (optional)
                  <select name="service_id">
                    <option value="">Other approved engagement work</option>
                    {data.services
                      .filter((s) => s.assigned_to === user.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} · {dateText(s.service_date)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  Work completed
                  <textarea
                    name="description"
                    minLength={5}
                    maxLength={1000}
                    required
                  />
                </label>
                {error && (
                  <div className="form-error" role="alert">
                    {error}
                  </div>
                )}
                <button className="button button-dark">
                  Submit for review <ArrowRight size={18} />
                </button>
              </fieldset>
            </form>
          ) : (
            <Empty>
              Ask your coordinator to link your person profile and activate an
              eligible employee or volunteer engagement first.
            </Empty>
          )}
        </BusinessModal>
      )}
      {reviewHours && (
        <BusinessModal
          title="Review service hours"
          onClose={() => {
            if (!busy) setReviewHours(null);
          }}
        >
          <p>
            <strong>{reviewHours.person}</strong> ·{" "}
            {reviewHours.engagement_role} · {reviewHours.hours} hours
          </p>
          <p>
            {dateText(reviewHours.service_date)} · {reviewHours.description}
          </p>
          <form
            onSubmit={(e) => save(e, "review_hours", { id: reviewHours.id })}
          >
            <label className="field">
              Decision
              <select name="decision">
                <option>Approved</option>
                <option>Rejected</option>
              </select>
            </label>
            <label className="field">
              Review note
              <textarea name="note" required minLength={3} maxLength={1000} />
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="button button-dark" disabled={busy}>
              Record decision <CheckCircle2 size={18} />
            </button>
          </form>
        </BusinessModal>
      )}
    </div>
  );
}
