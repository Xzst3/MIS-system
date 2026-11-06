export const roles = [
  "admin",
  "finance",
  "coordinator",
  "fundraising",
  "volunteer",
];
export const access = {
  admin: [
    "overview",
    "clients",
    "referrals",
    "donors",
    "partners",
    "volunteers",
    "tasks",
    "reports",
    "settings",
    "finance",
    "people",
    "services",
    "transparency",
  ],
  finance: [
    "overview",
    "finance",
    "transparency",
    "donors",
    "tasks",
    "reports",
    "services",
  ],
  coordinator: [
    "overview",
    "clients",
    "referrals",
    "partners",
    "tasks",
    "reports",
    "people",
    "services",
    "finance",
  ],
  fundraising: [
    "overview",
    "donors",
    "volunteers",
    "tasks",
    "reports",
    "people",
    "finance",
    "transparency",
    "services",
  ],
  volunteer: ["overview", "partners", "tasks", "services"],
};
export const canAccess = (role, section) =>
  (access[role] || []).includes(section);
export const canWrite = (role, section) =>
  canAccess(role, section) && (role !== "volunteer" || section === "tasks");
