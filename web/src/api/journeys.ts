import { api } from "./client";

export type JourneyStep =
  | { type: "send"; templateId: string; channelId: string; next?: number }
  | { type: "wait"; durationMs: number }
  | { type: "condition"; conditionType: "replied" | "attribute"; attr?: string; op?: string; value?: string; ifTrueStepIndex: number; ifFalseStepIndex: number };

export interface JourneyItem {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED";
  listId: string | null;
  segmentId: string | null;
  createdAt: string;
}

export interface JourneyDetail extends JourneyItem {
  definition: { steps: JourneyStep[] };
  runsSummary: { total: number; running: number; done: number; replied: number };
}

export const journeysApi = {
  list: () => api.get<JourneyItem[]>("/journeys").then((r) => r.data),
  get: (id: string) => api.get<JourneyDetail>(`/journeys/${id}`).then((r) => r.data),
  create: (data: { name: string; definition: { steps: JourneyStep[] }; listId?: string; segmentId?: string }) =>
    api.post<JourneyItem>("/journeys", data).then((r) => r.data),
  update: (id: string, data: Partial<{ name: string; definition: { steps: JourneyStep[] } }>) =>
    api.patch<JourneyItem>(`/journeys/${id}`, data).then((r) => r.data),
  activate: (id: string) => api.post(`/journeys/${id}/activate`).then((r) => r.data),
};
