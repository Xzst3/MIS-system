"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  Globe,
  HandHeart,
  Heart,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  Waypoints,
  X,
} from "lucide-react";
import { Brand } from "./brand";
import { canAccess } from "@/lib/permissions.mjs";
import type { User } from "@/lib/types";
import { FinanceWorkspace, Metric } from "./finance-workspace";
import { PeopleWorkspace } from "./people-workspace";
import { ReportsWorkspace } from "./reports-workspace";
import { LoadState, dollars, send, useRemote } from "./business-ui";
const nav = [
  ["overview", "Overview", LayoutDashboard],
  ["clients", "Beneficiaries", Users],
  ["services", "Service journey", Activity],
  ["referrals", "Referrals", Waypoints],
  ["finance", "Finance & approvals", Wallet],
  ["transparency", "Funding transparency", ChartNoAxesCombined],
  ["people", "People & engagements", Users],
  ["donors", "Donor relationships", Heart],
  ["volunteers", "Volunteer coordination", HandHeart],
  ["partners", "Partner directory", Building2],
  ["tasks", "Tasks & follow-ups", ListTodo],
  ["reports", "Reports & impact", ChartNoAxesCombined],
  ["settings", "Team & permissions", Settings],
] as const;
const descriptions: Record<string, string> = {
  overview: "People, resources and the next steps that connect them.",
  clients: "A complete support journey starts with one person.",
  services:
    "Every appointment, referral and practical next step in one history.",
  referrals: "Connections with external services, followed through.",
  finance: "Record, review and trace the resources behind the work.",
  transparency: "From the original source to a fund, a service and an outcome.",
  people: "Shared identities, distinct engagements and clear responsibilities.",
  donors: "One relationship across gifts, interests and other roles.",
  volunteers:
    "Availability, eligibility and contribution linked to the same person.",
  reports: "Evidence of the work delivered and the resources it used.",
};
export function BusinessWorkspace({
  user,
  view,
}: {
  user: User;
  view: string;
}) {
  const [mobile, setMobile] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const sync = () => {
      setNarrow(query.matches);
      if (!query.matches) setMobile(false);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobile(false);
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", escape);
    };
  }, [mobile]);
  const [error, setError] = useState("");
  const title = nav.find((n) => n[0] === view)?.[1] || "Workspace";
  async function logout() {
    try {
      await send("/api/auth", { action: "logout" });
      window.location.assign("/login");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="workspace business-workspace">
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        id="business-sidebar"
        className={"sidebar " + (mobile ? "open" : "")}
        inert={narrow && !mobile ? true : undefined}
        aria-hidden={narrow && !mobile ? true : undefined}
      >
        <div className="business-sidebar-brand">
          <Brand />
          {mobile && (
            <button
              className="icon-button"
              aria-label="Close menu"
              onClick={() => setMobile(false)}
            >
              <X size={22} />
            </button>
          )}
        </div>
        <span className="workspace-label">FOUNDATION WORKSPACE</span>
        <nav aria-label="Workspace navigation">
          {nav
            .filter(([key]) => canAccess(user.role, key))
            .map(([key, label, Icon]) => (
              <Link
                href={"/workspace" + (key === "overview" ? "" : "/" + key)}
                key={key}
                className={view === key ? "active" : ""}
                aria-current={view === key ? "page" : undefined}
                onClick={() => setMobile(false)}
              >
                <Icon size={18} strokeWidth={1.4} />
                {label}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/" className="sidebar-public">
            <Globe size={17} />
            <span>Visit our public website</span>
            <ArrowUpRight size={15} />
          </Link>
          <div className="sidebar-profile">
            <span className="avatar">
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((s) => s[0])
                .join("")}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {user.role === "admin"
                  ? "Administrator"
                  : user.role === "finance"
                    ? "Finance officer"
                    : user.role}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <div className="crumb">
            <button
              className="workspace-mobile-menu"
              aria-label="Open workspace menu"
              aria-expanded={mobile}
              aria-controls="business-sidebar"
              onClick={() => setMobile(true)}
            >
              <Menu size={23} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <span className="workspace-date">
            <CalendarDays size={15} />{" "}
            {new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "Asia/Shanghai",
            })}
          </span>
        </header>
        <main className="workspace-content business-content" id="main">
          {error && (
            <div className="business-error" role="alert">
              {error}
            </div>
          )}
          <div className="business-heading">
            <div>
              <span className="eyebrow">THE PEOPLE BEHIND THE PURPOSE</span>
              <h1>
                {view === "overview"
                  ? `Good to see you, ${user.name.split(" ")[0]}.`
                  : title}
              </h1>
              <p>{descriptions[view]}</p>
            </div>
            <span className="business-live">
              <i />
              Shared foundation records
            </span>
          </div>
          {view === "reports" ? (
            <ReportsWorkspace user={user} />
          ) : view === "overview" ? (
            <BusinessOverview user={user} reports={false} />
          ) : view === "finance" || view === "transparency" ? (
            <FinanceWorkspace
              user={user}
              transparent={view === "transparency"}
            />
          ) : (
            <PeopleWorkspace user={user} view={view} />
          )}
          <footer className="business-footer">
            <ShieldCheck size={16} />
            <span>
              Role-based access · Attributable reviews · One connected service
              history
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
type Insights = {
  financial: {
    available: number;
    received: number;
    spent: number;
    pending: number;
    donors: number;
    returning_donors: number;
    in_kind_value: number;
  } | null;
  services: { beneficiaries: number; open: number; completed: number };
  programs: {
    id: string;
    name: string;
    completed: number;
    beneficiaries: number;
    spent: number | null;
    service_area: boolean;
  }[];
  months: {
    month: string;
    services: number;
    completed: number;
    received: number | null;
  }[];
  approved_volunteer_hours: number;
  submitted_hours: number;
  year: number;
};
function BusinessOverview({ user, reports }: { user: User; reports: boolean }) {
  const remote = useRemote<Insights>("/api/insights");
  const { data } = remote;
  if (!data)
    return (
      <LoadState
        error={remote.error}
        loading={remote.loading}
        onRetry={remote.refresh}
      />
    );
  const m = data.financial;
  const max = Math.max(1, ...data.months.map((m) => m.services));
  return (
    <>
      <LoadState
        error={remote.error}
        loading={false}
        onRetry={remote.refresh}
      />
      <div className="business-metrics">
        {m ? (
          <>
            <Metric
              label="People supported"
              value={String(data.services.beneficiaries)}
              note="Distinct people with completed services"
              icon={<Users />}
            />
            <Metric
              label="Completed services"
              value={String(data.services.completed)}
              note="With an outcome recorded"
              icon={<CheckCircle2 />}
            />
            <Metric
              label="Posted contributions"
              value={dollars(m.received)}
              note="Cash received and asset-sale proceeds"
              icon={<Heart />}
            />
            <Metric
              label="Pending approvals"
              value={String(m.pending)}
              note="Not included in posted totals"
              icon={<FileCheck2 />}
            />
          </>
        ) : (
          <>
            <Metric
              label="People supported"
              value={String(data.services.beneficiaries)}
              note={
                user.role === "volunteer"
                  ? "Across your assigned services"
                  : "Distinct beneficiaries with completed services"
              }
              icon={<Users />}
            />
            <Metric
              label="Open services"
              value={String(data.services.open)}
              note="Planned or in progress"
              icon={<Activity />}
            />
            <Metric
              label="Completed services"
              value={String(data.services.completed)}
              note="With an outcome recorded"
              icon={<CheckCircle2 />}
            />
            <Metric
              label="Approved volunteer hours"
              value={String(data.approved_volunteer_hours)}
              note="Unreviewed hours excluded"
              icon={<HandHeart />}
            />
          </>
        )}
      </div>
      <div className="business-overview-grid">
        <section className="business-panel business-questions">
          <div className="business-panel-heading">
            <span className="eyebrow">FOLLOW THE WHOLE JOURNEY</span>
            <h2>Ask a practical question.</h2>
            <p>Open the records behind the answer.</p>
          </div>
          {(m
            ? [
                [
                  "What did we sell in the previous two months?",
                  "Compare complete months and open each asset-sale record.",
                  "/workspace/reports?report=sales&period=previous_2_months",
                  ChartNoAxesCombined,
                ],
                [
                  "Where did a contribution go?",
                  "Follow its original source, fund transfers and expenditure.",
                  "/workspace/transparency?tab=trace",
                  Heart,
                ],
                [
                  "What is waiting for approval?",
                  `${m.pending} financial requests are awaiting an independent decision.`,
                  "/workspace/finance?tab=approvals",
                  FileCheck2,
                ],
                [
                  "What support reached people?",
                  `${data.services.completed} completed services, with outcomes recorded.`,
                  canAccess(user.role, "clients")
                    ? "/workspace/services"
                    : "/workspace/reports",
                  Users,
                ],
                [
                  "What happened to donated items?",
                  "View available stock, approved distributions and sale proceeds.",
                  "/workspace/finance?tab=inventory",
                  Building2,
                ],
              ]
            : [
                [
                  "What needs a follow-up?",
                  `${data.services.open} services are planned or in progress.`,
                  "/workspace/services",
                  Activity,
                ],
                [
                  "Which hours still need review?",
                  `${data.submitted_hours} entries have not entered approved reporting.`,
                  "/workspace/services?tab=hours",
                  FileCheck2,
                ],
                [
                  "How do my engagements fit together?",
                  "Check employee and volunteer dates, availability and eligibility.",
                  "/workspace/services?tab=hours",
                  HandHeart,
                ],
              ]
          ).map(([title, copy, href, Icon]) => {
            const I = Icon as typeof Heart;
            return (
              <Link
                className="business-question"
                key={String(title)}
                href={String(href)}
              >
                <span className="business-question-icon">
                  <I size={23} strokeWidth={1.4} />
                </span>
                <span>
                  <strong>{String(title)}</strong>
                  <small>{String(copy)}</small>
                </span>
                <ArrowUpRight size={21} />
              </Link>
            );
          })}
        </section>
        <section className="business-panel">
          <div className="business-panel-heading">
            <span className="eyebrow">TIME MAKES THE PICTURE CLEARER</span>
            <h2>Six months of next steps.</h2>
            <p>
              Service dates, rather than the time someone entered the record.
            </p>
          </div>
          <div
            className="insight-chart"
            role="img"
            aria-label={data.months
              .map(
                (m) =>
                  m.month +
                  ": " +
                  m.services +
                  " services, " +
                  m.completed +
                  " completed",
              )
              .join("; ")}
          >
            {data.months.map((month) => (
              <div key={month.month}>
                <span>{month.services}</span>
                <div className="insight-bars">
                  <i
                    style={{
                      height: Math.max(2, (month.services / max) * 150),
                    }}
                  />
                  <i
                    style={{
                      height: Math.max(2, (month.completed / max) * 150),
                    }}
                  />
                </div>
                <small>
                  {new Date(month.month + "-15T12:00:00Z").toLocaleDateString(
                    "en-US",
                    { month: "short" },
                  )}
                </small>
              </div>
            ))}
          </div>
          <div className="insight-legend">
            <span>
              <i />
              Services recorded
            </span>
            <span>
              <i />
              Completed services
            </span>
          </div>
          <div className="impact-mini">
            <div>
              <strong>{data.services.completed}</strong>
              <span>Completed services</span>
            </div>
            <div>
              <strong>{data.approved_volunteer_hours}</strong>
              <span>Approved volunteer hours</span>
            </div>
          </div>
        </section>
      </div>
      {m && (
        <section className="business-panel">
          <div className="business-panel-heading">
            <span className="eyebrow">RESOURCES AND RELATIONSHIPS</span>
            <h2>Keep the different measures clear.</h2>
          </div>
          <div className="resource-summary">
            <div>
              <span>{data.year} expenditure</span>
              <strong>{dollars(m.spent)}</strong>
              <small>Approved and posted expenses</small>
            </div>
            <div>
              <span>In-kind value</span>
              <strong>{dollars(m.in_kind_value)}</strong>
              <small>Estimated receipt value; excluded from cash</small>
            </div>
            <div>
              <span>Available funds</span>
              <strong>{dollars(m.available)}</strong>
              <small>Posted ledger balance across all funds</small>
            </div>
            <div>
              <span>Returning donors</span>
              <strong>
                {m.returning_donors} / {m.donors}
              </strong>
              <small>At least two posted cash or in-kind gifts</small>
            </div>
          </div>
        </section>
      )}
      {data.programs.length > 0 && (
        <section className="business-panel">
          <div className="business-panel-heading">
            <span className="eyebrow">PEOPLE AT THE CENTRE</span>
            <h2>Support and resources, by programme.</h2>
            <p>
              People can appear in more than one programme. Add the
              foundation-wide distinct count only once.
            </p>
          </div>
          <div className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>Programme</th>
                  <th>People reached</th>
                  <th>Completed services</th>
                  {m && <th>Posted expenditure · all time</th>}
                  <th>Explore</th>
                </tr>
              </thead>
              <tbody>
                {data.programs.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <small>
                        {p.service_area
                          ? "Service area"
                          : "Shared costs, including salaries and premises"}
                      </small>
                    </td>
                    <td>{p.beneficiaries}</td>
                    <td>{p.completed}</td>
                    {m && <td>{dollars(p.spent || 0)}</td>}
                    <td>
                      <Link
                        className="business-detail-button"
                        href={
                          m
                            ? "/workspace/finance?tab=funds"
                            : "/workspace/services"
                        }
                      >
                        View <ArrowUpRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {reports && (
        <div className="business-info">
          <CheckCircle2 size={21} />
          <span>
            Financial totals use posted transactions only. Service counts use
            dated service records; outcomes are entered by the coordination
            team. Employee hours, volunteer hours and estimated asset values
            remain separate.
          </span>
        </div>
      )}
    </>
  );
}
