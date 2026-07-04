import { api } from "./client";

export interface CampaignItem {
  id: string;
  name: string;
  channelType: "WHATSAPP" | "EMAIL";
  status: "DRAFT" | "SCHEDULED" | "RUNNING" | "DONE" | "CANCELED";
  totalCount: number;
  sentCount: number;
  failedCount: number;
  scheduleAt: string | null;
  createdAt: string;
}

export interface CampaignReport {
  campaign: CampaignItem;
  totalRecipients: number;
  skipped: number;
  variantCounts: { A: number; B: number };
  messagesByStatus: Record<string, number>;
  totalMessages: number;
}

export const campaignsApi = {
  list: () => api.get<CampaignItem[]>("/campaigns").then((r) => r.data),
  get: (id: string) => api.get<CampaignReport>(`/campaigns/${id}`).then((r) => r.data),
  create: (data: {
    name: string;
    channelId: string;
    listId?: string;
    segmentId?: string;
    templateId: string;
    variantBId?: string;
    variantPct?: number;
    scheduleAt?: string;
  }) => api.post<CampaignItem>("/campaigns", data).then((r) => r.data),
  cancel: (id: string) => api.post(`/campaigns/${id}/cancel`),
};
