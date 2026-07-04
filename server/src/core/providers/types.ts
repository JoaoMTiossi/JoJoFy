export interface OutboundPayload {
  messageId: string;
  channelType: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  body: { text?: string; subject?: string; html?: string; buttons?: unknown };
}

export interface ProviderSendResult {
  providerId: string;
}

/**
 * Interface que qualquer provedor de canal deve implementar. O resto do
 * sistema não sabe que os provedores são simulados — plugar Meta/SES depois
 * é só implementar esta interface (decisão registrada na arquitetura).
 */
export interface ChannelProvider {
  send(payload: OutboundPayload): Promise<ProviderSendResult>;
}
