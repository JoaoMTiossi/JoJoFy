import { api } from "./client";

export interface DashboardData {
  messagesByChannel: Record<string, number>;
  messagesByDay: Record<string, number>;
  deliveryRate: number;
  readRate: number;
  balance: number;
  lowBalance: boolean;
  openConversations: number;
}

export interface BotReport {
  flowCount: number;
  totalSessions: number;
  done: number;
  transferred: number;
  active: number;
  transferRate: number;
  completionRate: number;
  abandonNodeCounts: Record<string, number>;
}

export interface AttendanceReport {
  totalConversations: number;
  resolvedCount: number;
  tmaMinutes: number;
  tmeMinutes: number;
  byAgent: Record<string, number>;
  byQueue: Record<string, number>;
}

export const reportsApi = {
  dashboard: () => api.get<DashboardData>("/reports/dashboard").then((r) => r.data),
  campaigns: () => api.get("/reports/campaigns").then((r) => r.data),
  bot: () => api.get<BotReport>("/reports/bot").then((r) => r.data),
  attendance: () => api.get<AttendanceReport>("/reports/attendance").then((r) => r.data),
  exportCsv: (type: "campaigns" | "messages" | "contacts") =>
    api.get(`/reports/export`, { params: { type }, responseType: "blob" }).then((r) => r.data as Blob),
};
