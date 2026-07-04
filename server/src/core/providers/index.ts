import { ChannelProvider } from "./types";
import { WhatsappSimProvider } from "./whatsappSim";
import { EmailSimProvider } from "./emailSim";

const providers: Record<string, ChannelProvider> = {
  WHATSAPP: new WhatsappSimProvider(),
  EMAIL: new EmailSimProvider(),
};

export function getProvider(channelType: string): ChannelProvider {
  const provider = providers[channelType];
  if (!provider) throw new Error(`Nenhum provedor configurado para o canal ${channelType}`);
  return provider;
}
