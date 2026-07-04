import { api } from "./client";

export interface AgentStatusItem {
  status: "ONLINE" | "AWAY" | "OFFLINE";
  activeCount: number;
}

export const agentStatusApi = {
  get: () => api.get<AgentStatusItem>("/agent-status").then((r) => r.data),
  set: (status: AgentStatusItem["status"]) => api.put<AgentStatusItem>("/agent-status", { status }).then((r) => r.data),
};
