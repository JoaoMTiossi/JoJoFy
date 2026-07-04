import { api } from "./client";
import { Contact } from "./contacts";

export interface ListItem {
  id: string;
  name: string;
  createdAt: string;
  _count: { members: number };
}

export const listsApi = {
  list: () => api.get<ListItem[]>("/lists").then((r) => r.data),
  create: (name: string) => api.post<ListItem>("/lists", { name }).then((r) => r.data),
  members: (id: string) => api.get<Contact[]>(`/lists/${id}/members`).then((r) => r.data),
  addMember: (id: string, contactId: string) => api.post(`/lists/${id}/members`, { contactId }),
  removeMember: (id: string, contactId: string) => api.delete(`/lists/${id}/members/${contactId}`),
  remove: (id: string) => api.delete(`/lists/${id}`),
};
