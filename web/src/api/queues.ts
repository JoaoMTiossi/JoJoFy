import { api } from "./client";

export interface QueueItem {
  id: string;
  name: string;
  strategy: "ROUND_ROBIN" | "LEAST_BUSY";
  maxPerAgent: number;
  members: { userId: string }[];
  _count: { conversations: number };
}

export const queuesApi = {
  list: () => api.get<QueueItem[]>("/queues").then((r) => r.data),
  create: (data: { name: string; strategy?: string; maxPerAgent?: number }) => api.post<QueueItem>("/queues", data).then((r) => r.data),
  addMember: (id: string, userId: string) => api.post(`/queues/${id}/members`, { userId }),
  removeMember: (id: string, userId: string) => api.delete(`/queues/${id}/members/${userId}`),
  remove: (id: string) => api.delete(`/queues/${id}`),
};
