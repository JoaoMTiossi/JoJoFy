import { api } from "./client";

export interface ChannelItem {
  id: string;
  type: "WHATSAPP" | "EMAIL";
  name: string;
  config: string;
}

export const channelsApi = {
  list: () => api.get<ChannelItem[]>("/channels").then((r) => r.data),
};
