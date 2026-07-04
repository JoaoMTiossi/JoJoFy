import { api } from "./client";

export const simulatorApi = {
  sendInbound: (data: { contactId: string; channelId: string; text: string }) =>
    api.post("/simulator/inbound", data).then((r) => r.data),
};
