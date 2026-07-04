import { api } from "./client";

export interface SupervisionData {
  queues: { id: string; name: string; strategy: string; maxPerAgent: number; memberCount: number }[];
  agents: { id: string; name: string; status: string; activeCount: number }[];
  conversations: any[];
  slaOverdueCount: number;
}

export const supervisionApi = {
  get: () => api.get<SupervisionData>("/supervision").then((r) => r.data),
};
