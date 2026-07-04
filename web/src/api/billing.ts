import { api } from "./client";

export interface LedgerEntry {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
}

export interface ChannelPriceItem {
  id: string;
  channelType: "WHATSAPP" | "EMAIL";
  credits: number;
}

export const billingApi = {
  balance: () => api.get<{ balance: number; lowBalance: boolean; threshold: number }>("/billing/balance").then((r) => r.data),
  ledger: () => api.get<LedgerEntry[]>("/billing/ledger").then((r) => r.data),
  prices: () => api.get<ChannelPriceItem[]>("/billing/prices").then((r) => r.data),
  recharge: (credits: number) => api.post("/billing/recharge", { credits }).then((r) => r.data),
};
