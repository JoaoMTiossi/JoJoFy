import { api } from "./client";

export interface QuickReplyItem {
  id: string;
  shortcut: string;
  body: string;
}

export const quickRepliesApi = {
  list: () => api.get<QuickReplyItem[]>("/quick-replies").then((r) => r.data),
  create: (data: { shortcut: string; body: string }) => api.post<QuickReplyItem>("/quick-replies", data).then((r) => r.data),
  remove: (id: string) => api.delete(`/quick-replies/${id}`),
};
