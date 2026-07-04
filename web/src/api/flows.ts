import { api } from "./client";

export interface FlowNodeData {
  text?: string;
  prompt?: string;
  variable?: string;
  validation?: { type: "email" | "number" | "date" | "regex"; pattern?: string };
  invalidMessage?: string;
  attr?: string;
  op?: string;
  value?: string | number;
  actionType?: "update_attribute" | "add_tag" | "add_to_list" | "webhook";
  tag?: string;
  listId?: string;
  url?: string;
  queueId?: string;
  label?: string;
}

export interface FlowGraphNode {
  id: string;
  type: "message" | "question" | "condition" | "action" | "handoff";
  data: FlowNodeData;
  next: string[];
  position?: { x: number; y: number };
}

export interface FlowGraph {
  startNodeId: string;
  nodes: FlowGraphNode[];
}

export interface FlowItem {
  id: string;
  channelId: string;
  name: string;
  keywords: string | string[];
  isDefault: boolean;
  createdAt: string;
}

export interface FlowDetail extends Omit<FlowItem, "keywords"> {
  keywords: string[];
  draft: FlowGraph;
  published: FlowGraph | null;
}

export const flowsApi = {
  list: () => api.get<FlowItem[]>("/flows").then((r) => r.data),
  get: (id: string) => api.get<FlowDetail>(`/flows/${id}`).then((r) => r.data),
  create: (data: { channelId: string; name: string; keywords?: string[]; isDefault?: boolean; draft?: FlowGraph }) =>
    api.post<FlowDetail>("/flows", data).then((r) => r.data),
  update: (id: string, data: Partial<{ name: string; keywords: string[]; isDefault: boolean; draft: FlowGraph }>) =>
    api.patch<FlowDetail>(`/flows/${id}`, data).then((r) => r.data),
  publish: (id: string) => api.post(`/flows/${id}/publish`).then((r) => r.data),
  remove: (id: string) => api.delete(`/flows/${id}`),
};
