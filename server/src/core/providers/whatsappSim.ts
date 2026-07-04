import { nanoid } from "nanoid";
import { ChannelProvider, OutboundPayload, ProviderSendResult } from "./types";

export class WhatsappSimProvider implements ChannelProvider {
  async send(_payload: OutboundPayload): Promise<ProviderSendResult> {
    return { providerId: `wa_sim_${nanoid(12)}` };
  }
}
