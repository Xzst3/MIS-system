export type Role = "admin" | "coordinator" | "fundraising" | "volunteer";
export type User = { id: string; name: string; username: string; role: Role };
export type RecordRow = {
  id: string;
  name: string;
  email?: string;
  category: string;
  status: string;
  detail: string;
  amount?: number;
  assigned_to?: string;
  created_at?: string;
};
export type Dataset = {
  clients: RecordRow[];
  donors: RecordRow[];
  referrals: RecordRow[];
  partners: RecordRow[];
  volunteers: RecordRow[];
  tasks: RecordRow[];
};
