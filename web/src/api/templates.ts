import { api } from "./client";

export interface TemplateItem {
  id: string;
  channelId: string;
  channelType: "WHATSAPP" | "EMAIL";
  name: string;
  body: string;
  buttons: string | null;
  subject: string | null;
  html: string | null;
  status: "DRAFT" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export const templatesApi = {
  list: (channelType?: string) => api.get<TemplateItem[]>("/templates", { params: channelType ? { channelType } : undefined }).then((r) => r.data),
  create: (data: {
    channelId: string;
    name: string;
    body: string;
    buttons?: { label: string }[];
    subject?: string;
    html?: string;
  }) => api.post<TemplateItem>("/templates", data).then((r) => r.data),
  remove: (id: string) => api.delete(`/templates/${id}`),
};
