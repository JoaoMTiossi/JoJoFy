import { api } from "./client";
import { Contact } from "./contacts";

export interface SegmentCondition {
  attr: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "exists" | "not_exists";
  value?: string | number;
}

export interface SegmentItem {
  id: string;
  name: string;
  filter: string;
  createdAt: string;
}

export const segmentsApi = {
  list: () => api.get<SegmentItem[]>("/segments").then((r) => r.data),
  create: (data: { name: string; filter: { logic: "AND"; conditions: SegmentCondition[] } }) =>
    api.post<SegmentItem>("/segments", data).then((r) => r.data),
  contacts: (id: string) => api.get<Contact[]>(`/segments/${id}/contacts`).then((r) => r.data),
  remove: (id: string) => api.delete(`/segments/${id}`),
};
