"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Heart,
  Waypoints,
  Building2,
  HandHeart,
  ListTodo,
  ChartNoAxesCombined,
  Settings,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Plus,
  Search,
  Bell,
  LogOut,
  Globe,
  Download,
  CalendarDays,
  ChevronDown,
  Check,
  X,
  Menu,
  ShieldCheck,
  Info,
  Inbox,
  CheckCircle2,
  Eye,
  RefreshCw,
  Copy,
} from "lucide-react";
import { Brand } from "./brand";
import { canAccess, canWrite, roles } from "@/lib/permissions.mjs";
import { demoData, demoUser, emptyData } from "@/lib/demo-data";
import type { Dataset, RecordRow, Role, User } from "@/lib/types";
const navigation = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "clients", label: "Clients & cases", icon: Users },
  { key: "referrals", label: "Referrals", icon: Waypoints },
  { key: "donors", label: "Donors & giving", icon: Heart },
  { key: "partners", label: "Partner directory", icon: Building2 },
  { key: "volunteers", label: "Volunteers", icon: HandHeart },
  { key: "tasks", label: "Tasks & follow-ups", icon: ListTodo },
  { key: "reports", label: "Reports & insights", icon: ChartNoAxesCombined },
  { key: "settings", label: "Team & permissions", icon: Settings },
];
const titles: Record<
  string,
  { title: string; description: string; singular: string }
> = {
  clients: {
    title: "Clients & cases",
    description: "A clearer view of every support pathway.",
    singular: "client",
  },
  donors: {
    title: "Donors & giving",
    description: "Care for the people who make our work possible.",
    singular: "donor",
  },
  referrals: {
    title: "Referrals",
    description: "Keep the right connections moving forward.",
    singular: "referral",
  },
  partners: {
    title: "Partner directory",
    description: "Build a thoughtful network of external support.",
    singular: "partner",
  },
  volunteers: {
    title: "Volunteers",
    description: "People sharing their time, skills and purpose.",
    singular: "volunteer",
  },
  tasks: {
    title: "Tasks & follow-ups",
    description: "Small steps that keep meaningful work moving.",
    singular: "task",
  },
  reports: {
    title: "Reports & insights",
    description: "Understand the work behind the next step.",
    singular: "report",
  },
  settings: {
    title: "Team & permissions",
    description: "The right access for every member of the team.",
    singular: "team member",
  },
};
const statuses = [
  "New",
  "Active",
  "Pending",
  "In progress",
  "Completed",
  "Pledged",
  "Received",
  "Contacted",
  "Archived",
];
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
const dateLabel = (s?: string) =>
  s
    ? new Date(s).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "Asia/Shanghai",
      })
    : "—";
type Kind = keyof Dataset;
type Account = User & { active: boolean; activated: boolean };
export function Workspace({
  user,
  view,
  demo = false,
}: {
  user: User;
  view: string;
  demo?: boolean;
}) {
  const [data, setData] = useState<Dataset>(
    demo ? structuredClone(demoData) : emptyData,
  );
  const [role, setRole] = useState<Role>(user.role);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [mobile, setMobile] = useState(false);
  const [create, setCreate] = useState<Kind | null>(null);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [selected, setSelected] = useState<{
    kind: Kind;
    record: RecordRow;
  } | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [assignees, setAssignees] = useState<
    Pick<User, "id" | "name" | "role">[]
  >(demo ? [demoUser] : []);
  const [invite, setInvite] = useState(false);
  const [invitation, setInvitation] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = demo ? "/demo" : "/workspace";
  const href = (section: string) =>
    base + (section === "overview" ? "" : "/" + section);
  const showToast = (message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 5000);
  };
  async function load() {
    if (demo) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/records", { cache: "no-store" });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok)
        throw new Error("We could not load the workspace. Please refresh.");
      setData(await response.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }
  async function loadAccounts() {
    if (demo) {
      setAccounts([
        { ...demoUser, role: "admin", active: true, activated: true },
      ]);
      return;
    }
    try {
      const r = await fetch("/api/users", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setAccounts(await r.json());
    } catch {
      setError("Unable to load team accounts.");
    }
  }
  useEffect(() => {
    if (demo) {
      try {
        const saved = localStorage.getItem("ecf-demo-data-v1");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Object.keys(emptyData).every((k) => Array.isArray(parsed[k])))
            setData(parsed);
        }
        const savedRole = localStorage.getItem("ecf-demo-role");
        if (savedRole && roles.includes(savedRole)) setRole(savedRole as Role);
      } catch {
        /* Demo storage is optional. */
      }
      setLoaded(true);
    } else {
      load();
      setLoaded(true);
      if (user.role !== "volunteer")
        fetch("/api/assignees")
          .then((r) => (r.ok ? r.json() : []))
          .then(setAssignees)
          .catch(() => {});
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (demo && loaded) {
      try {
        localStorage.setItem("ecf-demo-data-v1", JSON.stringify(data));
        localStorage.setItem("ecf-demo-role", role);
      } catch {
        /* Demo still works without storage. */
      }
    }
  }, [data, role, loaded, demo]);
  useEffect(() => {
    if (view === "settings" && role === "admin") loadAccounts();
  }, [view, role]);
  const visibleData = Object.fromEntries(
    Object.entries(data).map(([key, rows]) => [
      key,
      canAccess(role, key)
        ? role === "volunteer" && key === "tasks"
          ? rows.filter((r: RecordRow) => r.assigned_to === user.id)
          : rows
        : [],
    ]),
  ) as Dataset;
  const allowed = canAccess(role, view);
  const kind = view in emptyData ? (view as Kind) : null;
  const filtered = kind
    ? visibleData[kind].filter(
        (r) =>
          (status === "All statuses" || r.status === status) &&
          (r.name + " " + r.category + " " + r.email + " " + r.detail)
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
    : [];
  const active = visibleData.clients.filter(
    (r) => !["Completed", "Archived"].includes(r.status),
  ).length;
  const received = visibleData.donors
    .filter((r) => r.status === "Received")
    .reduce((n, r) => n + Number(r.amount || 0), 0);
  const pledged = visibleData.donors
    .filter((r) => r.status === "Pledged")
    .reduce((n, r) => n + Number(r.amount || 0), 0);
  const pending = visibleData.referrals.filter(
    (r) => !["Completed", "Archived"].includes(r.status),
  ).length;
  const openTasks = visibleData.tasks.filter(
    (r) => !["Completed", "Archived"].includes(r.status),
  );
  async function changeStatus(
    record: RecordRow,
    recordKind: Kind,
    next: string,
  ) {
    if (!canWrite(role, recordKind)) return;
    setError("");
    if (demo) {
      setData((d) => ({
        ...d,
        [recordKind]: d[recordKind].map((r) =>
          r.id === record.id ? { ...r, status: next } : r,
        ),
      }));
      if (selected?.record.id === record.id)
        setSelected({ ...selected, record: { ...record, status: next } });
      showToast("Demo record updated in this browser.");
      return;
    }
    try {
      const r = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, kind: recordKind, status: next }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setData((d) => ({
        ...d,
        [recordKind]: d[recordKind].map((row) =>
          row.id === record.id ? { ...row, status: next } : row,
        ),
      }));
      if (selected?.record.id === record.id)
        setSelected({ ...selected, record: { ...record, status: next } });
      showToast("Status updated.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update this record.",
      );
    }
  }
  async function saveRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!create) return;
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const payload = {
      kind: create,
      ...(editing ? { id: editing.id, operation: "edit" } : {}),
      name: String(form.get("name")),
      email: String(form.get("email") || ""),
      category: String(form.get("category")),
      status: String(form.get("status")),
      detail: String(form.get("detail") || ""),
      amount: create === "donors" ? Number(form.get("amount") || 0) : null,
      assigned_to: form.get("assigned_to") || null,
    };
    try {
      if (demo) {
        const record = {
          ...payload,
          id: editing?.id || crypto.randomUUID(),
          created_at: editing?.created_at || new Date().toISOString(),
        } as RecordRow;
        setData((d) => ({
          ...d,
          [create]: editing
            ? d[create].map((r) => (r.id === editing.id ? record : r))
            : [record, ...d[create]],
        }));
        showToast("Demo record saved in this browser.");
      } else {
        const r = await fetch("/api/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        await load();
        showToast("Record saved.");
      }
      setCreate(null);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save this record.");
    } finally {
      setBusy(false);
    }
  }
  function exportData() {
    const rows = kind ? filtered : [],
      summary = !kind;
    const cells = (value: unknown) => {
      let str = String(value ?? "");
      if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
      return '"' + str.replaceAll('"', '""') + '"';
    };
    const csv = summary
      ? [
          ["Metric", "Value"],
          ["Active cases", active],
          ["Pending referrals", pending],
          ["Received gifts USD", received],
          ["Unpaid pledges USD", pledged],
          ["Open tasks", openTasks.length],
        ]
      : [
          [
            "Name",
            "Email",
            "Category",
            "Status",
            "Amount USD",
            "Notes",
            "Created",
          ],
          ...rows.map((r) => [
            r.name,
            r.email || "",
            r.category,
            r.status,
            r.amount ?? "",
            r.detail,
            r.created_at || "",
          ]),
        ];
    const blob = new Blob(
      ["\uFEFF" + csv.map((row) => row.map(cells).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8;" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ecf-${demo ? "demo-" : ""}${view}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV export downloaded.");
  }
  async function inviteAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      username: form.get("username"),
      role: form.get("role"),
    };
    try {
      if (demo) {
        showToast("Demo only. No account was created or invitation sent.");
        setInvite(false);
      } else {
        const r = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        setInvitation(result.invitation);
        setInvite(false);
        await loadAccounts();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create invitation.");
    } finally {
      setBusy(false);
    }
  }
  async function reissueInvitation(account: Account) {
    if (demo) {
      showToast("Demo only. No real invitation was created.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reinvite", id: account.id }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setInvitation(result.invitation);
      showToast("New private activation link created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create invitation.");
    } finally {
      setBusy(false);
    }
  }
  async function disableAccount(account: Account) {
    if (demo) {
      showToast("Demo only. No real account was changed.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", id: account.id }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      await loadAccounts();
      showToast("Account deactivated and existing sessions ended.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to deactivate account.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    if (demo) {
      window.location.assign("/login");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!r.ok) throw new Error();
      window.location.assign("/login");
    } catch {
      setError("Unable to sign out. Please try again.");
      setBusy(false);
    }
  }
  const metrics =
    role === "volunteer"
      ? [
          {
            label: "My open tasks",
            value: openTasks.length,
            icon: ListTodo,
            note: "Assigned to you",
          },
          {
            label: "Tasks completed",
            value: visibleData.tasks.filter((r) => r.status === "Completed")
              .length,
            icon: CheckCircle2,
            note: "A step forward",
          },
          {
            label: "Active partners",
            value: visibleData.partners.filter((r) => r.status === "Active")
              .length,
            icon: Building2,
            note: "In our directory",
          },
          {
            label: "Your access",
            value: "Volunteer",
            icon: ShieldCheck,
            note: "Only your assigned tasks",
          },
        ]
      : role === "fundraising"
        ? [
            {
              label: "Recorded gifts",
              value: money(received),
              icon: Heart,
              note: "Marked as received",
            },
            {
              label: "Unpaid pledges",
              value: money(pledged),
              icon: Heart,
              note: "Not yet received",
            },
            {
              label: "Donor records",
              value: visibleData.donors.length,
              icon: Users,
              note: "People behind the purpose",
            },
            {
              label: "Volunteer profiles",
              value: visibleData.volunteers.length,
              icon: HandHeart,
              note: "In our community",
            },
          ]
        : [
            {
              label: "Active client cases",
              value: active,
              icon: Users,
              note: "Open support pathways",
            },
            {
              label: "Pending referrals",
              value: pending,
              icon: Waypoints,
              note: "Connections in progress",
            },
            {
              label: role === "admin" ? "Recorded gifts" : "Active partners",
              value:
                role === "admin"
                  ? money(received)
                  : visibleData.partners.filter((r) => r.status === "Active")
                      .length,
              icon: role === "admin" ? Heart : Building2,
              note:
                role === "admin"
                  ? "Marked as received"
                  : "In our support network",
            },
            {
              label: "Open follow-ups",
              value: openTasks.length,
              icon: ListTodo,
              note: "Next steps to take",
            },
          ];
  function recordTable(rows: RecordRow[], recordKind: Kind, compact = false) {
    return rows.length ? (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                {recordKind === "tasks"
                  ? "TASK"
                  : recordKind === "referrals"
                    ? "CLIENT / REFERRAL"
                    : "NAME"}
              </th>
              <th>
                {recordKind === "donors" ? "GIVING TYPE" : "SUPPORT AREA"}
              </th>
              <th>STATUS</th>
              {!compact && (
                <th>{recordKind === "donors" ? "AMOUNT" : "ADDED"}</th>
              )}
              <th>
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="table-person">
                    <span className="avatar">{initials(r.name)}</span>
                    <div>
                      <strong>{r.name}</strong>
                      <small>
                        {recordKind === "clients"
                          ? "Client support pathway"
                          : r.email || `Ref. ${r.id.slice(0, 8)}`}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="table-category">{r.category}</span>
                </td>
                <td>
                  <Badge status={r.status} />
                </td>
                {!compact && (
                  <td>
                    {recordKind === "donors"
                      ? money(Number(r.amount || 0))
                      : dateLabel(r.created_at)}
                  </td>
                )}
                <td>
                  <button
                    className="details-link"
                    aria-label={"View " + r.name}
                    onClick={() => setSelected({ kind: recordKind, record: r })}
                  >
                    <ArrowUpRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title={
          loading
            ? "Loading records…"
            : query || status !== "All statuses"
              ? "No matching records."
              : "A fresh start."
        }
        description={
          loading
            ? "Bringing your workspace together."
            : query || status !== "All statuses"
              ? "Try a different search or status."
              : "New records and public requests will appear here."
        }
      />
    );
  }
  return (
    <div className="workspace">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Brand />
          {mobile && (
            <button
              className="icon-button"
              aria-label="Close menu"
              onClick={() => setMobile(false)}
            >
              <X size={18} />
            </button>
          )}
        </div>
        <span className="workspace-label">FOUNDATION WORKSPACE</span>
        <nav aria-label="Workspace navigation">
          {navigation
            .filter((n) => canAccess(role, n.key))
            .map((n) => (
              <Link
                className={view === n.key ? "active" : ""}
                key={n.key}
                href={href(n.key)}
                aria-current={view === n.key ? "page" : undefined}
                onClick={() => setMobile(false)}
              >
                <n.icon size={16} strokeWidth={1.4} />
                {n.label}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/" className="sidebar-public">
            <Globe size={15} />
            <span>Visit our public website</span>
            <ArrowUpRight size={13} />
          </Link>
          <div className="sidebar-profile">
            <span className="avatar">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{role === "admin" ? "Administrator" : role}</small>
            </div>
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={signOut}
              disabled={busy}
            >
              <LogOut size={14} />
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
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={10} />
            <strong>
              {view === "overview" ? "Overview" : titles[view]?.title}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="workspace-date">
              <CalendarDays
                size={12}
                style={{ verticalAlign: "-2px", marginRight: 6 }}
              />
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "Asia/Shanghai",
              })}
            </span>
            <Link
              className="topbar-icon"
              href={href("tasks")}
              aria-label="View follow-up tasks"
            >
              <Bell size={16} strokeWidth={1.4} />
            </Link>
            <span className="avatar" title={user.name}>
              {initials(user.name)}
            </span>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <Info size={12} /> Demo workspace · Fictional records saved only
              in this browser.
            </span>
            <div>
              <select
                aria-label="Preview a team role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {roles.map((r: string) => (
                  <option key={r} value={r}>
                    {r === "admin"
                      ? "Administrator"
                      : r[0].toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
              <button
                className="demo-reset"
                onClick={() => {
                  setData(structuredClone(demoData));
                  showToast("Demo restored to the original examples.");
                }}
              >
                Reset demo
              </button>
              <Link href="/login">
                Real sign in <ArrowUpRight size={10} />
              </Link>
            </div>
          </div>
        )}
        <main className="workspace-content" id="main">
          {error && (
            <div className="workspace-error" role="alert">
              {error}{" "}
              <button
                className="icon-button"
                style={{ display: "inline-flex" }}
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={12} />
              </button>
            </div>
          )}
          {!allowed ? (
            <div className="dashboard-locked">
              <ShieldCheck size={35} />
              <h2>A workspace shaped for your role.</h2>
              <p>
                This section is available to other team roles. Choose an
                available section to continue.
              </p>
              <Link className="button button-dark" href={base}>
                Go to my overview
              </Link>
            </div>
          ) : (
            <>
              <div className="dashboard-heading">
                <div>
                  <div className="workspace-title-status">
                    <h1>
                      {view === "overview"
                        ? `Welcome back, ${user.name.split(" ")[0]}.`
                        : titles[view]?.title}
                    </h1>
                    {view === "overview" && (
                      <span>LET’S MAKE A LITTLE GOOD</span>
                    )}
                  </div>
                  <p>
                    {view === "overview"
                      ? "Here’s what’s happening across your foundation today."
                      : titles[view]?.description}
                  </p>
                </div>
                <div className="dashboard-actions">
                  {view !== "settings" && role !== "volunteer" && (
                    <button
                      className="button button-outline"
                      onClick={exportData}
                    >
                      <Download size={13} /> Export
                    </button>
                  )}
                  {kind && canWrite(role, kind) && role !== "volunteer" ? (
                    <button
                      className="button button-dark"
                      onClick={() => {
                        setError("");
                        setCreate(kind);
                      }}
                    >
                      <Plus size={14} /> Add {titles[kind].singular}
                    </button>
                  ) : view === "overview" && role !== "volunteer" ? (
                    <button
                      className="button button-dark"
                      onClick={() => {
                        setError("");
                        setCreate(
                          role === "fundraising" ? "donors" : "clients",
                        );
                      }}
                    >
                      <Plus size={14} />{" "}
                      {role === "fundraising"
                        ? "Add a donor"
                        : "New support case"}
                    </button>
                  ) : view === "settings" ? (
                    <button
                      className="button button-dark"
                      onClick={() => setInvite(true)}
                    >
                      <Plus size={14} /> Invite teammate
                    </button>
                  ) : null}
                </div>
              </div>
              {view === "overview" ? (
                <>
                  <div className="metric-grid">
                    {metrics.map((m) => (
                      <div className="metric-card" key={m.label}>
                        <div className="metric-top">
                          <span>{m.label}</span>
                          <span>
                            <m.icon size={15} strokeWidth={1.4} />
                          </span>
                        </div>
                        <div
                          className="metric-value"
                          style={
                            m.value === "Volunteer"
                              ? { fontSize: 25 }
                              : undefined
                          }
                        >
                          {m.value}
                        </div>
                        <div className="metric-bottom">
                          <span
                            className="pulse-dot"
                            style={{
                              width: 4,
                              height: 4,
                              background: "#8c9d72",
                              boxShadow: "none",
                            }}
                          />
                          {m.note}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="dashboard-grid">
                    <div>
                      <div className="panel">
                        <div className="panel-head">
                          <div>
                            <h2>
                              {role === "fundraising"
                                ? "Giving activity"
                                : "Our work, at a glance"}
                            </h2>
                            <p>
                              {demo
                                ? "Illustrative activity from the demo records"
                                : "New records over the past six months"}
                            </p>
                          </div>
                          <span style={{ fontSize: 9, color: "#8d987e" }}>
                            Last 6 months{" "}
                            <ChevronDown
                              size={11}
                              style={{ verticalAlign: "middle" }}
                            />
                          </span>
                        </div>
                        <ActivityChart
                          rows={
                            role === "fundraising"
                              ? visibleData.donors
                              : role === "volunteer"
                                ? visibleData.tasks
                                : visibleData.clients
                          }
                        />
                      </div>
                      <div className="panel">
                        <div className="panel-head">
                          <div>
                            <h2>
                              {role === "fundraising"
                                ? "Recent supporters"
                                : role === "volunteer"
                                  ? "Your assigned tasks"
                                  : "Recent client pathways"}
                            </h2>
                            <p>
                              {role === "fundraising"
                                ? "Every gift begins with a connection."
                                : role === "volunteer"
                                  ? "Your next steps, in one place."
                                  : "People at the heart of our work."}
                            </p>
                          </div>
                          <Link
                            href={href(
                              role === "fundraising"
                                ? "donors"
                                : role === "volunteer"
                                  ? "tasks"
                                  : "clients",
                            )}
                          >
                            View all <ArrowUpRight size={12} />
                          </Link>
                        </div>
                        {recordTable(
                          (role === "fundraising"
                            ? visibleData.donors
                            : role === "volunteer"
                              ? visibleData.tasks
                              : visibleData.clients
                          ).slice(0, 4),
                          role === "fundraising"
                            ? "donors"
                            : role === "volunteer"
                              ? "tasks"
                              : "clients",
                          true,
                        )}
                      </div>
                    </div>
                    <div className="dashboard-right">
                      <div className="panel">
                        <div className="panel-head">
                          <div>
                            <h2>A little follow-through</h2>
                            <p>
                              {openTasks.length} open{" "}
                              {openTasks.length === 1 ? "task" : "tasks"} on
                              your radar
                            </p>
                          </div>
                          <Link href={href("tasks")} aria-label="All tasks">
                            <ArrowUpRight size={15} />
                          </Link>
                        </div>
                        <div className="tasks-list">
                          {openTasks.length ? (
                            openTasks.slice(0, 3).map((t) => (
                              <div className="task-item" key={t.id}>
                                <button
                                  className="task-checkbox"
                                  aria-label={"Complete " + t.name}
                                  onClick={() =>
                                    changeStatus(t, "tasks", "Completed")
                                  }
                                />
                                <div>
                                  <strong>{t.name}</strong>
                                  <p>{t.category}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div
                              className="empty-state"
                              style={{ padding: "28px 5px" }}
                            >
                              <CheckCircle2 size={23} />
                              <p>
                                {loading
                                  ? "Loading…"
                                  : "You’re all caught up. New follow-ups will appear here."}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="panel">
                          <div className="panel-head">
                            <h2>Recent connections</h2>
                          </div>
                          <div className="mini-activity">
                            {[
                              ...visibleData.referrals.map((r) => ({
                                ...r,
                                type: "Referral",
                              })),
                              ...visibleData.donors.map((r) => ({
                                ...r,
                                type: "Giving",
                              })),
                              ...visibleData.volunteers.map((r) => ({
                                ...r,
                                type: "Volunteer",
                              })),
                              ...visibleData.tasks
                                .filter((r) => r.status === "Completed")
                                .map((r) => ({ ...r, type: "Task" })),
                            ]
                              .sort((a, b) =>
                                (b.created_at || "").localeCompare(
                                  a.created_at || "",
                                ),
                              )
                              .slice(0, 3)
                              .map((r) => (
                                <div className="mini-activity-item" key={r.id}>
                                  <span className="activity-icon">
                                    {r.type === "Giving" ? (
                                      <Heart size={12} />
                                    ) : r.type === "Referral" ? (
                                      <Waypoints size={12} />
                                    ) : (
                                      <HandHeart size={12} />
                                    )}
                                  </span>
                                  <div>
                                    <p>
                                      {r.name}
                                      <br />
                                      <span style={{ color: "#9aa58c" }}>
                                        {r.type} · {r.status}
                                      </span>
                                    </p>
                                    <small>{dateLabel(r.created_at)}</small>
                                  </div>
                                </div>
                              ))}
                            {!Object.values(visibleData).some(
                              (rows) => rows.length,
                            ) && (
                              <p style={{ fontSize: 11, paddingBottom: 15 }}>
                                A fresh start. Your team’s activity will appear
                                here.
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="foundation-note">
                          <span>OUR PURPOSE, EVERY DAY</span>
                          <h3>
                            Behind every task,
                            <br />
                            there’s a person.
                          </h3>
                          <p>
                            Thank you for making the next chapter a little
                            clearer for someone else.
                          </p>
                          <Link href="/about">
                            A reminder of why we’re here{" "}
                            <ArrowUpRight size={13} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : kind ? (
                <div className="panel">
                  <div className="table-toolbar">
                    <input
                      className="search-input"
                      aria-label={"Search " + titles[kind].title}
                      placeholder={`Search ${titles[kind].title.toLowerCase()}…`}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <select
                      aria-label="Filter by status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option>All statuses</option>
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  {recordTable(filtered, kind)}
                  <div className="table-count">
                    {filtered.length}{" "}
                    {filtered.length === 1 ? "record" : "records"} shown
                    {kind === "donors"
                      ? " · Pledges and received gifts are tracked separately."
                      : role === "volunteer" && kind === "tasks"
                        ? " · Only tasks assigned to you."
                        : ""}
                    {!demo ? " · Latest 500 records per section." : ""}
                  </div>
                </div>
              ) : view === "reports" ? (
                <>
                  <div className="metric-grid">
                    {metrics.map((m) => (
                      <div className="metric-card" key={m.label}>
                        <div className="metric-top">
                          {m.label}
                          <m.icon size={16} />
                        </div>
                        <div className="metric-value">{m.value}</div>
                        <p style={{ fontSize: 10 }}>{m.note}</p>
                      </div>
                    ))}
                  </div>
                  <div className="report-grid">
                    <Report
                      title={
                        role === "fundraising"
                          ? "Giving by category"
                          : "Clients by support area"
                      }
                      rows={
                        role === "fundraising"
                          ? visibleData.donors
                          : visibleData.clients
                      }
                      field="category"
                    />
                    <Report
                      title="Task progress"
                      rows={visibleData.tasks}
                      field="status"
                    />
                    {canAccess(role, "donors") && (
                      <div className="panel">
                        <div className="panel-head">
                          <h2>Giving, with clarity</h2>
                        </div>
                        <div className="report-list">
                          <div className="report-row">
                            <span>Received gifts</span>
                            <strong>{money(received)}</strong>
                          </div>
                          <div className="report-row">
                            <span>Unpaid pledges</span>
                            <strong>{money(pledged)}</strong>
                          </div>
                          <div className="notice" style={{ marginBottom: 0 }}>
                            Received amounts reflect manual staff records. This
                            system does not process or reconcile payments.
                          </div>
                        </div>
                      </div>
                    )}
                    {canAccess(role, "referrals") && (
                      <Report
                        title="Referral progress"
                        rows={visibleData.referrals}
                        field="status"
                      />
                    )}
                  </div>
                </>
              ) : view === "settings" ? (
                <>
                  <div className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>Our team</h2>
                        <p>
                          Invite teammates, assign a role and manage access.
                        </p>
                      </div>
                      <span className="badge">Administrator only</span>
                    </div>
                    <div className="account-list">
                      {accounts.map((account) => (
                        <div className="account-row" key={account.id}>
                          <span className="avatar">
                            {initials(account.name)}
                          </span>
                          <div>
                            <strong>{account.name}</strong>
                            <small>@{account.username}</small>
                          </div>
                          <span className="badge">{account.role}</span>
                          <small style={{ color: "#8a977d", fontSize: 9 }}>
                            {!account.active
                              ? "Deactivated"
                              : account.activated
                                ? "Active"
                                : "Invitation pending"}
                          </small>
                          {account.active && (
                            <button
                              onClick={() => reissueInvitation(account)}
                              disabled={busy}
                            >
                              Reset invite
                            </button>
                          )}
                          {account.id !== user.id && account.active && (
                            <button
                              onClick={() => disableAccount(account)}
                              disabled={busy}
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p
                      style={{
                        fontSize: 10,
                        padding: "15px 23px 20px",
                        color: "#8d9980",
                      }}
                    >
                      Invitations expire after 24 hours. Share invitation links
                      privately. Accounts use usernames, not email addresses.
                    </p>
                  </div>
                  {invitation && (
                    <div className="invitation-box">
                      <p>
                        Private invitation created. Share this link with the
                        intended teammate only.
                      </p>
                      <a href={invitation}>{invitation}</a>
                      <button
                        className="icon-button"
                        aria-label="Copy invitation link"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(invitation)
                            .then(() => showToast("Private invitation copied."))
                            .catch(() =>
                              showToast("Select and copy the invitation link."),
                            )
                        }
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  )}
                  <div className="panel">
                    <div className="panel-head">
                      <h2>Access, with intention</h2>
                    </div>
                    <div className="permission-grid">
                      {[
                        [
                          "Administrator",
                          "All records, team invitations, account access and reports.",
                        ],
                        [
                          "Coordinator",
                          "Clients, referrals, partner directory, tasks and coordination reports.",
                        ],
                        [
                          "Fundraising",
                          "Donors, giving, volunteer profiles, tasks and fundraising reports.",
                        ],
                        [
                          "Volunteer",
                          "Read-only partner directory and status updates for assigned tasks.",
                        ],
                      ].map(([t, d]) => (
                        <div key={t}>
                          <h3>{t}</h3>
                          <p>{d}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
              <div className="workspace-footnote">
                <ShieldCheck size={11} />
                {demo
                  ? "All names, organizations and activity in this demo are fictional."
                  : "Shared foundation database · Access is checked on the server for every request."}
              </div>
            </>
          )}
        </main>
      </div>
      {create && (
        <Modal
          title={(editing ? "Edit " : "Add ") + titles[create].singular}
          onClose={() => {
            setCreate(null);
            setEditing(null);
            setError("");
          }}
        >
          <form onSubmit={saveRecord}>
            <label className="field">
              {create === "tasks"
                ? "Task title"
                : create === "referrals"
                  ? "Client or referral name"
                  : "Full name / organization"}
              <input
                name="name"
                defaultValue={editing?.name || ""}
                required
                minLength={2}
                maxLength={100}
                autoFocus
              />
            </label>
            {create !== "tasks" && create !== "referrals" && (
              <label className="field">
                Email address
                <input
                  name="email"
                  type="email"
                  maxLength={254}
                  defaultValue={editing?.email || ""}
                />
              </label>
            )}
            <div className="detail-grid">
              <label className="field">
                {create === "donors"
                  ? "Giving category"
                  : "Support area / category"}
                <input
                  name="category"
                  defaultValue={editing?.category || ""}
                  required
                  maxLength={100}
                  placeholder={
                    create === "donors"
                      ? "Individual giving"
                      : "e.g. Benefits navigation"
                  }
                />
              </label>
              <label className="field">
                Status
                <select
                  name="status"
                  defaultValue={
                    editing?.status || (create === "donors" ? "Pledged" : "New")
                  }
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            {create === "donors" && (
              <label className="field">
                Amount (USD)
                <input
                  type="number"
                  name="amount"
                  defaultValue={editing?.amount || 0}
                  min="0"
                  max="1000000"
                  step="0.01"
                  required
                />
                <span className="field-hint">
                  Manual record only. Selecting “Received” does not process a
                  payment.
                </span>
              </label>
            )}
            {create === "tasks" && (
              <label className="field">
                Assign to
                <select
                  name="assigned_to"
                  defaultValue={editing?.assigned_to || ""}
                >
                  <option value="">Unassigned</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                </select>
                <span className="field-hint">
                  Volunteers can only see tasks assigned to them.
                </span>
              </label>
            )}
            <label className="field">
              Coordination notes
              <textarea
                name="detail"
                defaultValue={editing?.detail || ""}
                maxLength={1000}
                rows={3}
                placeholder="Keep notes brief, factual and relevant."
              />
              <span className="field-hint">
                Avoid medical records, financial account details and sensitive
                documents.
              </span>
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="button button-dark" disabled={busy}>
              {busy ? "Saving…" : demo ? "Save demo record" : "Save record"}
              <Check size={15} />
            </button>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal title={selected.record.name} onClose={() => setSelected(null)}>
          <div className="detail-grid">
            <div className="detail-field">
              <label>Category</label>
              <p>{selected.record.category}</p>
            </div>
            <div className="detail-field">
              <label>Created</label>
              <p>{dateLabel(selected.record.created_at)}</p>
            </div>
            {selected.record.email && (
              <div className="detail-field">
                <label>Email</label>
                <p>{selected.record.email}</p>
              </div>
            )}
            {selected.kind === "donors" && (
              <div className="detail-field">
                <label>Recorded amount (USD)</label>
                <p>{money(Number(selected.record.amount || 0))}</p>
              </div>
            )}
          </div>
          <div className="detail-notes">
            {selected.record.detail || "No coordination notes yet."}
          </div>
          <label className="field">
            Status
            {canWrite(role, selected.kind) ? (
              <select
                aria-label="Update record status"
                value={
                  data[selected.kind].find((r) => r.id === selected.record.id)
                    ?.status || selected.record.status
                }
                onChange={(e) =>
                  changeStatus(selected.record, selected.kind, e.target.value)
                }
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            ) : (
              <Badge status={selected.record.status} />
            )}
          </label>
          <div className="field-hint">
            Record reference: {selected.record.id}
          </div>
          {role !== "volunteer" && canWrite(role, selected.kind) && (
            <button
              className="button button-dark"
              style={{ width: "100%", marginTop: 22 }}
              onClick={() => {
                setEditing(selected.record);
                setCreate(selected.kind);
                setSelected(null);
                setError("");
              }}
            >
              Edit details <ArrowUpRight size={15} />
            </button>
          )}
        </Modal>
      )}
      {invite && (
        <Modal title="Invite a teammate" onClose={() => setInvite(false)}>
          <form onSubmit={inviteAccount}>
            <label className="field">
              Full name
              <input name="name" required minLength={2} maxLength={100} />
            </label>
            <label className="field">
              Username
              <input
                name="username"
                type="text"
                required
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9][a-zA-Z0-9._-]+"
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
            <label className="field">
              Team role
              <select name="role" defaultValue="volunteer">
                <option value="volunteer">Volunteer</option>
                <option value="coordinator">Coordinator</option>
                <option value="fundraising">Fundraising</option>
                <option value="admin">Administrator</option>
              </select>
              <span className="field-hint">
                Administrator access includes all records and account
                management.
              </span>
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="notice">
              This creates a private activation link. Share it only with the
              intended team member. It expires after 24 hours.
            </div>
            <button className="button button-dark" disabled={busy}>
              {busy ? "Creating…" : "Create invitation"}
              <ArrowUpRight size={16} />
            </button>
          </form>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span
      className={
        "badge " +
        (["Pending", "Pledged", "New"].includes(status)
          ? "orange"
          : ["In progress", "Contacted"].includes(status)
            ? "blue"
            : ["Archived"].includes(status)
              ? "gray"
              : "")
      }
    >
      {status}
    </span>
  );
}
function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <Inbox size={30} strokeWidth={1.2} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = before;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-head">
          <h2 id="dialog-title">{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ActivityChart({ rows }: { rows: RecordRow[] }) {
  const now = new Date();
  const months = Array.from(
    { length: 6 },
    (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1),
  );
  const totals = months.map((d) =>
    rows.filter(
      (r) =>
        r.created_at &&
        new Date(r.created_at).getUTCFullYear() === d.getFullYear() &&
        new Date(r.created_at).getUTCMonth() === d.getMonth(),
    ),
  );
  const max = Math.max(4, ...totals.map((r) => r.length));
  if (!rows.length)
    return (
      <div className="chart-empty">
        <p>No activity yet.</p>
        <p style={{ fontSize: 10, marginTop: 6 }}>
          Your monthly activity will grow here.
        </p>
      </div>
    );
  return (
    <>
      <div className="chart-legend">
        <span>
          <i className="legend-dot" /> Records opened
        </span>
        <span>
          <i className="legend-dot orange" /> Completed / received
        </span>
      </div>
      <div
        className="activity-chart"
        role="img"
        aria-label={
          "Six-month record activity: " +
          months
            .map(
              (m, i) =>
                m.toLocaleDateString("en-US", { month: "long" }) +
                " " +
                totals[i].length +
                " opened, " +
                totals[i].filter((r) =>
                  ["Completed", "Received"].includes(r.status),
                ).length +
                " completed or received",
            )
            .join("; ")
        }
      >
        <div className="chart-axis">
          {[
            max,
            Math.round(max * 0.75),
            Math.round(max * 0.5),
            Math.round(max * 0.25),
            0,
          ].map((n, i) => (
            <span key={i}>{n}</span>
          ))}
        </div>
        <div className="chart-bars">
          {months.map((month, i) => (
            <div className="chart-month" key={i}>
              <div className="bar-pair">
                <i style={{ height: `${(totals[i].length / max) * 100}%` }} />
                <i
                  style={{
                    height: `${(totals[i].filter((r) => ["Completed", "Received"].includes(r.status)).length / max) * 100}%`,
                  }}
                />
              </div>
              <span>
                {month.toLocaleDateString("en-US", { month: "short" })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
function Report({
  title,
  rows,
  field,
}: {
  title: string;
  rows: RecordRow[];
  field: "category" | "status";
}) {
  const grouped = rows.reduce<Record<string, number>>(
    (all, r) => ({ ...all, [r[field]]: (all[r[field]] || 0) + 1 }),
    {},
  );
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
      </div>
      {rows.length ? (
        <div className="report-list">
          {Object.entries(grouped)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => (
              <div className="report-row" key={name}>
                <span>{name}</span>
                <div className="report-track">
                  <i style={{ width: `${(count / rows.length) * 100}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
        </div>
      ) : (
        <Empty
          title="Nothing to report yet."
          description="Insights will appear as your team adds records."
        />
      )}
    </div>
  );
}
