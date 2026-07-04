import { api } from "./client";

export interface ConversationItem {
  id: string;
  contactId: string;
  contact: { id: string; name: string; phone: string | null; email: string | null };
  channelType: "WHATSAPP" | "EMAIL";
  queueId: string | null;
  queue: { id: string; name: string } | null;
  agentId: string | null;
  agent: { id: string; name: string } | null;
  status: "OPEN" | "ASSIGNED" | "RESOLVED";
  firstResponseAt: string | null;
  resolvedAt: string | null;
  slaOverdue: boolean;
  reopenedCount: number;
  tags: { id: string; tag: string }[];
  createdAt: string;
}

export interface ConversationDetail extends ConversationItem {
  notes: { id: string; body: string; authorId: string; createdAt: string }[];
  messages: { id: string; direction: "IN" | "OUT"; status: string; body: string; createdAt: string; source: string }[];
}

export const conversationsApi = {
  list: (filters: { status?: string; queueId?: string; mine?: boolean; unassigned?: boolean } = {}) =>
    api
      .get<ConversationItem[]>("/conversations", {
        params: {
          status: filters.status,
          queueId: filters.queueId,
          mine: filters.mine ? "true" : undefined,
          unassigned: filters.unassigned ? "true" : undefined,
        },
      })
      .then((r) => r.data),
  get: (id: string) => api.get<ConversationDetail>(`/conversations/${id}`).then((r) => r.data),
  reply: (id: string, text: string) => api.post(`/conversations/${id}/messages`, { text }).then((r) => r.data),
  pull: (id: string) => api.post(`/conversations/${id}/pull`).then((r) => r.data),
  transfer: (id: string, data: { queueId?: string; agentId?: string }) => api.post(`/conversations/${id}/transfer`, data).then((r) => r.data),
  resolve: (id: string, reason?: string) => api.post(`/conversations/${id}/resolve`, { reason }).then((r) => r.data),
  addNote: (id: string, body: string) => api.post(`/conversations/${id}/notes`, { body }).then((r) => r.data),
  addTag: (id: string, tag: string) => api.post(`/conversations/${id}/tags`, { tag }).then((r) => r.data),
};
