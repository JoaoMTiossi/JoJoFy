import { api } from "./client";

export interface WebhookItem {
  id: string;
  url: string;
  secret: string;
  events: string;
  active: boolean;
  createdAt: string;
}

export const webhooksApi = {
  list: () => api.get<WebhookItem[]>("/webhooks").then((r) => r.data),
  create: (data: { url: string; secret?: string; events: string[] }) =>
    api.post<WebhookItem>("/webhooks", data).then((r) => r.data),
  remove: (id: string) => api.delete(`/webhooks/${id}`),
  deliveries: (id: string) => api.get(`/webhooks/${id}/deliveries`).then((r) => r.data),
};
