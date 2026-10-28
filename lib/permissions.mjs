export const roles = ["admin", "coordinator", "fundraising", "volunteer"];
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
  ],
  coordinator: [
    "overview",
    "clients",
    "referrals",
    "partners",
    "tasks",
    "reports",
  ],
  fundraising: ["overview", "donors", "volunteers", "tasks", "reports"],
  volunteer: ["overview", "partners", "tasks"],
};
export const canAccess = (role, section) =>
  (access[role] || []).includes(section);
export const canWrite = (role, section) =>
  canAccess(role, section) && (role !== "volunteer" || section === "tasks");
