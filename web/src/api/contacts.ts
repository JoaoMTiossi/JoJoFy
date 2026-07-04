import { api } from "./client";

export interface AttributeDef {
  id: string;
  name: string;
  type: "TEXT" | "NUMBER" | "DATE" | "SELECT";
  options?: string | null;
}

export interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  attributeValues: { id: string; value: string; def: AttributeDef }[];
}

export const contactsApi = {
  list: (q?: string) => api.get<Contact[]>("/contacts", { params: q ? { q } : undefined }).then((r) => r.data),
  get: (id: string) => api.get(`/contacts/${id}`).then((r) => r.data),
  create: (data: { name: string; phone?: string; email?: string; attributes?: Record<string, string> }) =>
    api.post<Contact>("/contacts", data).then((r) => r.data),
  update: (id: string, data: Partial<{ name: string; phone: string; email: string; attributes: Record<string, string> }>) =>
    api.patch<Contact>(`/contacts/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/contacts/${id}`),
  listAttributeDefs: () => api.get<AttributeDef[]>("/contacts/attributes").then((r) => r.data),
  createAttributeDef: (data: { name: string; type: AttributeDef["type"]; options?: string[] }) =>
    api.post<AttributeDef>("/contacts/attributes", data).then((r) => r.data),
  importCsv: (data: { csv: string; mapping: { name: string; phone?: string; email?: string; attributes?: Record<string, string> }; listId?: string }) =>
    api.post("/contacts/import", data).then((r) => r.data),
  createOptOut: (id: string, data: { channelType: "WHATSAPP" | "EMAIL"; reason?: string }) =>
    api.post(`/contacts/${id}/optout`, data).then((r) => r.data),
};
