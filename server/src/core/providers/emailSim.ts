import { nanoid } from "nanoid";
import { ChannelProvider, OutboundPayload, ProviderSendResult } from "./types";

export class EmailSimProvider implements ChannelProvider {
  async send(_payload: OutboundPayload): Promise<ProviderSendResult> {
    return { providerId: `email_sim_${nanoid(12)}` };
  }
}
